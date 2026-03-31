import React, { useState, useMemo } from "react";
import { Delivery, Dispatch, Inventory, StockMovement } from "@/entities/all";
import { logActivity } from "@/functions/logActivity";
import { CheckCircle2, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

export default function RouteOperario({ employees, products, dispatches, deliveries, inventory, devoluciones = [], onSaved }) {
  const [employeeId, setEmployeeId] = useState("");
  const [deliveryQty, setDeliveryQty] = useState({});
  const [newDispatches, setNewDispatches] = useState([{ product_reference: "", quantity: "", observations: "" }]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(true);

  const employee = employees.find(e => e.employee_id === employeeId);

  const employeeStats = useMemo(() => {
    if (!employeeId) return null;
    const empDisps = dispatches
      .filter(d => d.employee_id === employeeId)
      .map(d => ({ ...d, dispatch_date: (d.dispatch_date || '').slice(0, 10) }))
      .sort((a, b) => b.dispatch_date.localeCompare(a.dispatch_date));
    const empDelivs = deliveries
      .filter(d => d.employee_id === employeeId)
      .map(d => ({ ...d, delivery_date: (d.delivery_date || '').slice(0, 10) }))
      .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date));
    const getU = (d) => d.items?.length > 0 ? d.items.reduce((s, i) => s + (i.quantity || 0), 0) : (d.quantity || 0);

    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const last28Units = empDelivs.filter(d => d.delivery_date >= fourWeeksAgo).reduce((s, d) => s + getU(d), 0);
    const weeklyAvg = Math.round((last28Units / 4) * 10) / 10;

    const dDates = [...new Set(empDisps.map(d => d.dispatch_date))].sort((a, b) => b.localeCompare(a));
    const lastDDate = dDates[0] || null;
    const penDDate = dDates[1] || null;
    const lastEDate = empDelivs.length > 0 ? empDelivs[0].delivery_date : null;
    const noEntrego = lastDDate && (!lastEDate || lastDDate > lastEDate);
    const lastEUnits = noEntrego ? 0 : (lastEDate ? empDelivs.filter(d => d.delivery_date === lastEDate).reduce((s, d) => s + getU(d), 0) : null);
    const refDDate = noEntrego ? lastDDate : penDDate;
    const penDUnits = refDDate ? empDisps.filter(d => d.dispatch_date === refDDate).reduce((s, d) => s + (d.quantity || 0), 0) : null;
    const performancePct = (lastEUnits !== null && penDUnits > 0) ? Math.round((lastEUnits / penDUnits) * 100) : null;

    const openDevs = devoluciones.filter(d => d.employee_id === employeeId && d.status === 'abierta');

    return { weeklyAvg, performancePct, openDevs };
  }, [employeeId, dispatches, deliveries, devoluciones]);

  const pendingItems = useMemo(() => {
    if (!employeeId) return [];
    return products.map(p => {
      const dispatched = dispatches
        .filter(d => d.employee_id === employeeId && d.product_reference === p.reference)
        .reduce((s, d) => s + (d.quantity || 0), 0);
      const delivered = deliveries
        .filter(d => d.employee_id === employeeId && d.status !== "borrador")
        .reduce((s, d) => {
          if (d.items?.length > 0) {
            const item = d.items.find(i => i.product_reference === p.reference);
            return s + (item ? item.quantity || 0 : 0);
          }
          if (d.product_reference === p.reference) return s + (d.quantity || 0);
          return s;
        }, 0);
      const pend = dispatched - delivered;
      return pend > 0 ? { product: p, pending: pend } : null;
    }).filter(Boolean);
  }, [employeeId, products, dispatches, deliveries]);

  const getStock = (ref) => {
    const inv = inventory.find(i => i.product_reference === ref);
    return inv ? inv.current_stock : 0;
  };

  const updateDispatch = (i, field, val) => {
    const updated = [...newDispatches];
    updated[i] = { ...updated[i], [field]: val };
    setNewDispatches(updated);
  };

  const resetForm = () => {
    setEmployeeId("");
    setDeliveryQty({});
    setNewDispatches([{ product_reference: "", quantity: "", observations: "" }]);
  };

  const handleSave = async () => {
    if (!employeeId) { alert("Selecciona un operario."); return; }

    const validDeliveries = pendingItems
      .map(({ product, pending }) => {
        const qty = Math.min(parseInt(deliveryQty[product.reference] || "0"), pending);
        if (qty <= 0) return null;
        return { product_reference: product.reference, quantity: qty, unit_price: product.manufacturing_price || 0, total_amount: (product.manufacturing_price || 0) * qty };
      })
      .filter(Boolean);

    const validDispatches = newDispatches.filter(d => d.product_reference && parseInt(d.quantity) > 0);

    if (validDeliveries.length === 0 && validDispatches.length === 0) {
      alert("No hay nada para guardar. Ingresa entregas o despachos.");
      return;
    }

    for (const d of validDispatches) {
      const stock = getStock(d.product_reference);
      if (parseInt(d.quantity) > stock) {
        const p = products.find(p => p.reference === d.product_reference);
        alert(`Stock insuficiente para ${p?.name}. Disponible: ${stock}`);
        return;
      }
    }

    setSaving(true);
    const today = getColombiaToday();

    if (validDeliveries.length > 0) {
      const total_amount = validDeliveries.reduce((s, i) => s + i.total_amount, 0);
      const newDelivery = await Delivery.create({
        employee_id: employeeId,
        delivery_date: today,
        items: validDeliveries,
        total_amount,
        status: "pendiente",
      });
      try { await logActivity({ entity_type: 'Delivery', entity_id: newDelivery.id, action: 'created', description: `Entrega registrada desde Portal de Ruta - ${employee?.name || employeeId}`, employee_id: employeeId, employee_name: employee?.name || employeeId, amount: total_amount, new_data: { items: validDeliveries, total_amount } }); } catch {}
    }

    for (const d of validDispatches) {
      const qty = parseInt(d.quantity);
      const newDispatch = await Dispatch.create({
        employee_id: employeeId,
        product_reference: d.product_reference,
        quantity: qty,
        dispatch_date: today,
        status: "despachado",
        observations: d.observations || ""
      });
      const inv = inventory.find(i => i.product_reference === d.product_reference);
      if (inv) {
        await Inventory.update(inv.id, { current_stock: inv.current_stock - qty });
        await StockMovement.create({
          product_reference: d.product_reference,
          movement_type: "salida",
          quantity: qty,
          movement_date: today,
          reason: `Despacho en ruta a ${employee?.name || employeeId}`,
          previous_stock: inv.current_stock,
          new_stock: inv.current_stock - qty,
        });
      }
      const prod = products.find(p => p.reference === d.product_reference);
      try { await logActivity({ entity_type: 'Dispatch', entity_id: newDispatch.id, action: 'created', description: `Despacho registrado desde Portal de Ruta - ${prod?.name} (${qty} uds) a ${employee?.name || employeeId}`, employee_id: employeeId, employee_name: employee?.name || employeeId, new_data: { product_reference: d.product_reference, quantity: qty } }); } catch {}
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      resetForm();
      onSaved();
    }, 1500);
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-green-700">
        <CheckCircle2 className="w-14 h-14" />
        <p className="text-xl font-bold">¡Registrado!</p>
        <p className="text-sm text-slate-500">Entregas y despachos confirmados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selección de operario */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">Operario</label>
        <select
          value={employeeId}
          onChange={e => { setEmployeeId(e.target.value); setDeliveryQty({}); }}
          className="w-full border border-slate-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">— Seleccionar operario —</option>
          {employees.map(e => (
            <option key={e.employee_id} value={e.employee_id}>{e.name}</option>
          ))}
        </select>

        {employeeId && employeeStats && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 bg-blue-50 rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-slate-500">Prom. semanal</p>
                <p className="font-bold text-blue-700 text-lg">{employeeStats.weeklyAvg || '—'}</p>
                <p className="text-xs text-slate-400">uds/sem</p>
              </div>
              <div className={`flex-1 rounded-lg px-3 py-2 text-center ${
                employeeStats.performancePct === null ? 'bg-slate-50' :
                employeeStats.performancePct >= 85 ? 'bg-green-50' :
                employeeStats.performancePct >= 65 ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <p className="text-xs text-slate-500">Productividad</p>
                <p className={`font-bold text-lg ${
                  employeeStats.performancePct === null ? 'text-slate-400' :
                  employeeStats.performancePct >= 85 ? 'text-green-700' :
                  employeeStats.performancePct >= 65 ? 'text-amber-700' : 'text-red-700'
                }`}>{employeeStats.performancePct !== null ? `${employeeStats.performancePct}%` : '—'}</p>
                <p className="text-xs text-slate-400">último ciclo</p>
              </div>
            </div>
            {employeeStats.openDevs.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-orange-700 mb-1">⚠️ Devoluciones abiertas ({employeeStats.openDevs.length})</p>
                {employeeStats.openDevs.map(d => {
                  const pend = d.quantity_sent - (d.quantity_returned || 0);
                  const prod = products.find(p => p.reference === d.product_reference);
                  return (
                    <p key={d.id} className="text-xs text-orange-800">
                      {prod?.name || d.product_reference}: <span className="font-bold">{pend} pendientes</span>
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {employeeId && (
        <>
          {/* Sección: Entregas de despachos anteriores */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-green-50 border-b border-green-200">
              <p className="font-semibold text-green-800 text-sm">Entrega de despachos anteriores</p>
              <p className="text-xs text-green-600 mt-0.5">Se registran directamente como pendiente de pago.</p>
            </div>
            <div className="px-4 py-3">
              {pendingItems.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">Sin pendientes de entrega.</p>
              ) : (
                <div className="space-y-3">
                  {pendingItems.map(({ product, pending }) => {
                    const val = parseInt(deliveryQty[product.reference] || "0");
                    const over = val > pending;
                    return (
                      <div key={product.reference} className="space-y-1">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <p className="text-sm text-slate-800 font-medium">{product.name}</p>
                            <p className="text-xs text-slate-400">
                              Pendiente: <span className="font-semibold text-slate-700">{pending}</span> uds
                            </p>
                            {val > 0 && (
                              <p className="text-xs font-semibold mt-0.5">
                                <span className="text-green-700">Entrega: {val}</span>
                                <span className="text-slate-400"> → </span>
                                <span className={pending - val === 0 ? "text-emerald-700" : "text-orange-600"}>
                                  Quedan: {pending - val}
                                </span>
                              </p>
                            )}
                          </div>
                          <input
                            type="number" min="0" max={pending} placeholder="0"
                            value={deliveryQty[product.reference] || ""}
                            onChange={e => {
                              const raw = parseInt(e.target.value) || 0;
                              setDeliveryQty(prev => ({ ...prev, [product.reference]: String(Math.min(raw, pending)) }));
                            }}
                            className={`w-20 border rounded-lg px-2 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 ${
                              over ? "border-red-400 bg-red-50 text-red-700 focus:ring-red-400"
                                   : val > 0 ? "border-green-400 bg-green-50 text-green-800 focus:ring-green-400"
                                   : "border-slate-300 focus:ring-green-400"
                            }`}
                          />
                        </div>
                        {over && (
                          <p className="text-xs text-red-600 text-right pr-1 font-medium">⚠️ Máximo permitido: {pending}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sección: Nuevo despacho */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              className="w-full px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between"
              onClick={() => setDispatchOpen(o => !o)}
            >
              <div className="text-left">
                <p className="font-semibold text-blue-800 text-sm">Nuevo despacho</p>
                <p className="text-xs text-blue-600 mt-0.5">Se descuenta del inventario inmediatamente.</p>
              </div>
              {dispatchOpen ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
            </button>

            {dispatchOpen && (
              <div className="px-4 py-3 space-y-3">
                {newDispatches.map((item, i) => {
                  const stock = item.product_reference ? getStock(item.product_reference) : null;
                  const over = stock !== null && parseInt(item.quantity) > stock;
                  return (
                    <div key={i} className="space-y-2 p-3 bg-slate-50 rounded-lg">
                      <select
                        value={item.product_reference}
                        onChange={e => updateDispatch(i, "product_reference", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="">— Referencia —</option>
                        {products.map(p => (
                          <option key={p.reference} value={p.reference}>{p.name} (stock: {getStock(p.reference)})</option>
                        ))}
                      </select>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number" min="1" placeholder="Cantidad"
                          value={item.quantity}
                          onChange={e => {
                            const raw = parseInt(e.target.value) || 0;
                            const maxStock = item.product_reference ? getStock(item.product_reference) : 9999;
                            updateDispatch(i, "quantity", String(Math.min(raw, maxStock)));
                          }}
                          className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${over ? "border-orange-400 bg-orange-50 focus:ring-orange-400" : "border-slate-300 focus:ring-blue-400"}`}
                        />
                        {newDispatches.length > 1 && (
                          <button onClick={() => setNewDispatches(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {item.product_reference && stock !== null && (
                        <p className={`text-xs ${over ? "text-orange-600 font-semibold" : "text-slate-400"}`}>
                          {over ? `⚠️ Stock disponible: ${stock}` : `Stock disponible: ${stock}`}
                        </p>
                      )}
                      <textarea
                        placeholder="Observaciones (ej: falta cremallera, tela dañada, etc.)"
                        value={item.observations || ""}
                        onChange={e => updateDispatch(i, "observations", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none h-16 placeholder-slate-400"
                      />
                    </div>
                  );
                })}
                <button
                  onClick={() => setNewDispatches(prev => [...prev, { product_reference: "", quantity: "", observations: "" }])}
                  className="w-full py-2 border border-dashed border-blue-300 rounded-lg text-blue-600 text-sm flex items-center justify-center gap-1 hover:bg-blue-50"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar referencia
                </button>
              </div>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 text-base font-semibold"
          >
            {saving ? "Guardando..." : "Guardar todo"}
          </Button>
        </>
      )}
    </div>
  );
}