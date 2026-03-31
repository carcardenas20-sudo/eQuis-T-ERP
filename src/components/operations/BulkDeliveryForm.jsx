import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, PackageCheck, CheckCircle2 } from "lucide-react";

const getColombiaTodayString = () => {
  const now = new Date();
  const colombiaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  return colombiaTime.toISOString().split("T")[0];
};

export default function BulkDeliveryForm({ employees, products, allDispatches, allDeliveries, inventory, onSaved }) {
  const [bulkDate, setBulkDate] = useState(getColombiaTodayString());
  const [deliveryQty, setDeliveryQty] = useState({});  // { "empId_ref": qty }
  const [dispatchQty, setDispatchQty] = useState({});  // { "empId_ref": qty }
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [routeOrder, setRouteOrder] = useState(null);

  useEffect(() => {
    base44.entities.AppConfig.list().then(configs => {
      const config = configs.find(c => c.key === "pending_row_order");
      if (config) {
        try { setRouteOrder(JSON.parse(config.value)); } catch { setRouteOrder([]); }
      } else {
        setRouteOrder([]);
      }
    });
  }, []);

  const key = (empId, ref) => `${empId}_${ref}`;

  // Pendientes por empleado: despachado - entregado
  const pendingByEmployee = useMemo(() => {
    const result = {};
    employees.filter(e => e.is_active).forEach(emp => {
      const pending = {};
      products.forEach(product => {
        const dispatched = allDispatches
          .filter(d => d.employee_id === emp.employee_id && d.product_reference === product.reference)
          .reduce((s, d) => s + (d.quantity || 0), 0);
        const delivered = allDeliveries
          .filter(d => d.employee_id === emp.employee_id)
          .reduce((s, delivery) => {
            if (delivery.items?.length > 0) {
              const item = delivery.items.find(i => i.product_reference === product.reference);
              return s + (item ? item.quantity || 0 : 0);
            }
            if (delivery.product_reference === product.reference) return s + (delivery.quantity || 0);
            return s;
          }, 0);
        const pendingQty = dispatched - delivered;
        if (pendingQty > 0) pending[product.reference] = pendingQty;
      });
      if (Object.keys(pending).length > 0) {
        result[emp.employee_id] = { employee: emp, pending };
      }
    });
    return result;
  }, [employees, products, allDispatches, allDeliveries]);

  const getStock = (ref) => {
    const inv = (inventory || []).find(i => i.product_reference === ref);
    return inv ? inv.current_stock : 0;
  };

  const handleSave = async () => {
    // Recopilar entregas y despachos con cantidad > 0
    const deliveryEntries = [];
    const dispatchEntries = [];

    // Entregas: solo empleados con pendientes
    Object.values(pendingByEmployee).forEach(({ employee, pending }) => {
      Object.keys(pending).forEach(ref => {
        const dQty = parseInt(deliveryQty[key(employee.employee_id, ref)] || "0");
        if (dQty > 0) deliveryEntries.push({ employee, ref, qty: dQty });
      });
    });

    // Despachos: TODOS los empleados activos × TODAS las referencias con stock
    const allEmp = employees.filter(e => e.is_active);
    const allRefsWithStock = products.filter(p => p.is_active && getStock(p.reference) > 0);
    allEmp.forEach(employee => {
      allRefsWithStock.forEach(p => {
        const spQty = parseInt(dispatchQty[key(employee.employee_id, p.reference)] || "0");
        if (spQty > 0) dispatchEntries.push({ employee, ref: p.reference, qty: spQty });
      });
    });

    if (deliveryEntries.length === 0 && dispatchEntries.length === 0) {
      alert("No hay cantidades ingresadas para guardar.");
      return;
    }

    setSaving(true);

    // --- GUARDAR ENTREGAS agrupadas por empleado ---
    const byEmployeeDelivery = {};
    for (const entry of deliveryEntries) {
      const empId = entry.employee.employee_id;
      if (!byEmployeeDelivery[empId]) byEmployeeDelivery[empId] = { employee: entry.employee, items: [] };
      byEmployeeDelivery[empId].items.push({ ref: entry.ref, qty: entry.qty });
    }
    for (const empId of Object.keys(byEmployeeDelivery)) {
      const { employee, items } = byEmployeeDelivery[empId];
      const deliveryItems = items.map(({ ref, qty }) => {
        const product = products.find(p => p.reference === ref);
        const unit_price = product?.manufacturing_price || 0;
        return { product_reference: ref, quantity: qty, unit_price, total_amount: unit_price * qty };
      });
      const total_amount = deliveryItems.reduce((s, i) => s + i.total_amount, 0);
      const deliveryData = { employee_id: empId, delivery_date: bulkDate, items: deliveryItems, total_amount, status: "pendiente" };
      const newDelivery = await base44.entities.Delivery.create(deliveryData);
      const desc = deliveryItems.map(i => {
        const p = products.find(p => p.reference === i.product_reference);
        return `${p?.name || i.product_reference} (${i.quantity})`;
      }).join(", ");
      await base44.entities.ActivityLog.create({
        entity_type: "Delivery", entity_id: newDelivery.id, action: "created",
        description: `Entrega masiva - ${desc} - Total: $${total_amount.toLocaleString()}`,
        employee_id: empId, employee_name: employee.name, amount: total_amount, new_data: deliveryData,
      });
    }

    // --- GUARDAR DESPACHOS y actualizar inventario ---
    for (const entry of dispatchEntries) {
      const { employee, ref, qty } = entry;
      const newDispatch = await base44.entities.Dispatch.create({
        employee_id: employee.employee_id,
        product_reference: ref,
        quantity: qty,
        dispatch_date: bulkDate,
        status: "despachado",
      });
      // Actualizar inventario
      const invRecord = (inventory || []).find(i => i.product_reference === ref);
      if (invRecord) {
        const previousStock = invRecord.current_stock;
        const newStock = previousStock - qty;
        await base44.entities.Inventory.update(invRecord.id, { current_stock: newStock });
        await base44.entities.StockMovement.create({
          product_reference: ref, movement_type: "salida", quantity: qty,
          movement_date: bulkDate, reason: "despacho",
          notes: `Despacho masivo a ${employee.name}`,
          previous_stock: previousStock, new_stock: newStock,
        });
      }
      const product = products.find(p => p.reference === ref);
      await base44.entities.ActivityLog.create({
        entity_type: "Dispatch", entity_id: newDispatch.id, action: "created",
        description: `Despacho masivo - ${product?.name || ref} (${qty})`,
        employee_id: employee.employee_id, employee_name: employee.name,
        new_data: { employee_id: employee.employee_id, product_reference: ref, quantity: qty },
      });
    }

    setSaving(false);
    setSaved(true);
    setDeliveryQty({});
    setDispatchQty({});
    setTimeout(() => { setSaved(false); onSaved(); }, 1500);
  };

  // Todos los productos activos con stock > 0 (para despachos nuevos)
  const activeProductsWithStock = products.filter(p => p.is_active && getStock(p.reference) > 0);

  // Lista de empleados ordenada según la planilla de pendientes
  const allActiveEmployees = useMemo(() => {
    const active = employees.filter(e => e.is_active);
    if (!routeOrder || routeOrder.length === 0) return active;
    const ordered = [];
    routeOrder.forEach(id => {
      const emp = active.find(e => e.employee_id === id);
      if (emp) ordered.push(emp);
    });
    active.forEach(emp => {
      if (!ordered.find(e => e.employee_id === emp.employee_id)) ordered.push(emp);
    });
    return ordered;
  }, [employees, routeOrder]);

  // Lista ordenada de empleados CON pendientes (respetando el orden de ruta)
  const employeeList = useMemo(() => {
    return allActiveEmployees
      .filter(emp => pendingByEmployee[emp.employee_id])
      .map(emp => pendingByEmployee[emp.employee_id]);
  }, [allActiveEmployees, pendingByEmployee]);

  if (routeOrder === null) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  if (allActiveEmployees.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-slate-500">
          <PackageCheck className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="font-medium">No hay operarios activos.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PackageCheck className="w-5 h-5 text-green-600" />
          Registro Masivo — Entregas y Despachos
        </CardTitle>
        <div className="mt-3 flex items-center gap-3">
          <Label htmlFor="bulk-date" className="whitespace-nowrap">Fecha:</Label>
          <Input id="bulk-date" type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="w-44" />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          <span className="text-green-700 font-medium">Entrega</span>: solo referencias con pendientes. &nbsp;
          <span className="text-blue-700 font-medium">Despacho</span>: cualquier referencia disponible en inventario.
        </p>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {saved ? (
          <div className="flex flex-col items-center py-10 gap-3 text-green-700">
            <CheckCircle2 className="w-14 h-14" />
            <p className="text-xl font-bold">¡Guardado correctamente!</p>
          </div>
        ) : (
          <>
            {/* Vista móvil: tarjetas por empleado */}
            <div className="sm:hidden space-y-5">
              {allActiveEmployees.map(employee => {
                const pending = pendingByEmployee[employee.employee_id]?.pending || {};
                const hasPending = Object.keys(pending).length > 0;
                return (
                  <div key={employee.employee_id} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 font-semibold text-slate-800">{employee.name}</div>
                    <div className="p-3 space-y-3">
                      {/* Entregas: solo refs con pendiente */}
                      {hasPending && (
                        <div>
                          <p className="text-xs font-semibold text-green-700 mb-2">Entregas (pendientes)</p>
                          {products.filter(p => p.is_active && (pending[p.reference] || 0) > 0).map(p => {
                            const dk = key(employee.employee_id, p.reference);
                            return (
                              <div key={p.reference} className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex-1">
                                  <span className="text-sm text-slate-700">{p.name}</span>
                                  <span className="text-xs text-slate-400 ml-1">(pend: {pending[p.reference]})</span>
                                </div>
                                <Input
                                  type="number" min="0" max={pending[p.reference]} placeholder="0"
                                  value={deliveryQty[dk] || ""}
                                  onChange={e => setDeliveryQty(prev => ({ ...prev, [dk]: e.target.value }))}
                                  className="w-24 h-8 text-center text-sm border-green-300"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Despachos: todas las refs con stock */}
                      {activeProductsWithStock.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-blue-700 mb-2">Despachos (desde inventario)</p>
                          {activeProductsWithStock.map(p => {
                            const dk = key(employee.employee_id, p.reference);
                            return (
                              <div key={p.reference} className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex-1">
                                  <span className="text-sm text-slate-700">{p.name}</span>
                                  <span className="text-xs text-slate-400 ml-1">(stock: {getStock(p.reference)})</span>
                                </div>
                                <Input
                                  type="number" min="0" max={getStock(p.reference)} placeholder="0"
                                  value={dispatchQty[dk] || ""}
                                  onChange={e => setDispatchQty(prev => ({ ...prev, [dk]: e.target.value }))}
                                  className="w-24 h-8 text-center text-sm border-blue-300"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vista desktop: dos tablas separadas */}
            <div className="hidden sm:block space-y-6">

              {/* Tabla de ENTREGAS */}
              {employeeList.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-700 mb-2">Entregas (referencias con pendiente)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-green-50">
                          <th className="text-left px-3 py-2 font-semibold text-slate-700 border border-slate-200">Operario</th>
                          {products.filter(p => p.is_active && employeeList.some(({ pending }) => (pending[p.reference] || 0) > 0)).map(p => (
                            <th key={p.reference} className="px-3 py-2 font-semibold text-slate-700 border border-slate-200 text-center min-w-[100px]">
                              <div>{p.name}</div>
                              <div className="text-xs font-normal text-slate-400">{p.reference}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {employeeList.map(({ employee, pending }) => (
                          <tr key={employee.employee_id} className="hover:bg-green-50/50">
                            <td className="px-3 py-2 border border-slate-200 font-medium text-slate-800 whitespace-nowrap">{employee.name}</td>
                            {products.filter(p => p.is_active && employeeList.some(({ pending: pd }) => (pd[p.reference] || 0) > 0)).map(p => {
                              const pendingQty = pending[p.reference] || 0;
                              const dk = key(employee.employee_id, p.reference);
                              return (
                                <td key={p.reference} className="px-2 py-2 border border-slate-200 text-center">
                                  {pendingQty > 0 ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-xs text-slate-400">pend: {pendingQty}</span>
                                      <Input
                                        type="number" min="0" max={pendingQty} placeholder="0"
                                        value={deliveryQty[dk] || ""}
                                        onChange={e => setDeliveryQty(prev => ({ ...prev, [dk]: e.target.value }))}
                                        className="w-20 h-8 text-center text-sm border-green-300"
                                      />
                                    </div>
                                  ) : <span className="text-slate-200">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabla de DESPACHOS — todas las referencias con stock */}
              {activeProductsWithStock.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-700 mb-2">Despachos (todas las referencias disponibles en inventario)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="text-left px-3 py-2 font-semibold text-slate-700 border border-slate-200">Operario</th>
                          {activeProductsWithStock.map(p => (
                            <th key={p.reference} className="px-3 py-2 font-semibold text-slate-700 border border-slate-200 text-center min-w-[100px]">
                              <div>{p.name}</div>
                              <div className="text-xs font-normal text-slate-400">stock: {getStock(p.reference)}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allActiveEmployees.map(employee => (
                          <tr key={employee.employee_id} className="hover:bg-blue-50/50">
                            <td className="px-3 py-2 border border-slate-200 font-medium text-slate-800 whitespace-nowrap">{employee.name}</td>
                            {activeProductsWithStock.map(p => {
                              const stock = getStock(p.reference);
                              const dk = key(employee.employee_id, p.reference);
                              return (
                                <td key={p.reference} className="px-2 py-2 border border-slate-200 text-center">
                                  <Input
                                    type="number" min="0" max={stock} placeholder="0"
                                    value={dispatchQty[dk] || ""}
                                    onChange={e => setDispatchQty(prev => ({ ...prev, [dk]: e.target.value }))}
                                    className="w-20 h-8 text-center text-sm border-blue-300"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-6 w-full sm:w-auto">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Guardando..." : "Guardar entregas y despachos"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}