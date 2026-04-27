import React, { useState, useEffect } from "react";
import { Employee } from "@/api/entitiesProduccion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Phone, Calendar, Link as LinkIcon, Check, Eye, AlertTriangle, KeyRound, Users, ArrowRightLeft, Package } from "lucide-react";
import { Delivery, Dispatch, Payment } from "@/api/entitiesProduccion";
import { Producto } from "@/api/entitiesChaquetas";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

import EmployeeForm from "../components/employees/EmployeeForm";

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [copiedLink, setCopiedLink] = useState(null);
  const [pinModal, setPinModal] = useState(null);
  const [pinValue, setPinValue] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // Gestión de prendas (bajas y traslados)
  const [gestionModal, setGestionModal] = useState(null); // employee
  const [gestionData, setGestionData] = useState({ dispatches: [], deliveries: [], products: [] });
  const [gestionLoading, setGestionLoading] = useState(false);
  const [bajaModal, setBajaModal] = useState({ open: false, product: null, qty: '', motivo: '', obs: '' });
  const [trasladoModal, setTrasladoModal] = useState({ open: false, product: null, qty: '', destinoId: '', obs: '' });
  const [savingAccion, setSavingAccion] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await Employee.list();
      setEmployees(data || []);
    } catch (err) {
      console.error("Error cargando empleados:", err);
      setEmployees([]);
    }
    setLoading(false);
  };

  const openGestion = async (employee) => {
    setGestionModal(employee);
    setGestionLoading(true);
    const [dispatches, deliveries, products] = await Promise.all([
      Dispatch.list(),
      Delivery.list(),
      Producto.list(),
    ]);
    setGestionData({ dispatches: dispatches || [], deliveries: deliveries || [], products: (products || []).filter(p => p.reference) });
    setGestionLoading(false);
  };

  const getPendingItems = (employeeId) => {
    const { dispatches, deliveries, products } = gestionData;
    return products.map(p => {
      const dispatched = dispatches
        .filter(d => d.employee_id === employeeId && d.product_reference === p.reference)
        .reduce((s, d) => s + (d.quantity || 0), 0);
      const delivered = deliveries
        .filter(d => d.employee_id === employeeId && d.status !== 'borrador')
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
  };

  const handleBaja = async () => {
    const { product, qty, motivo, obs } = bajaModal;
    const cantidad = parseInt(qty);
    if (!cantidad || cantidad <= 0) { alert("Ingresa una cantidad válida."); return; }
    if (!motivo) { alert("Selecciona un motivo."); return; }
    setSavingAccion(true);
    const today = getColombiaToday();
    await Delivery.create({
      employee_id: gestionModal.employee_id,
      delivery_date: today,
      items: [{ product_reference: product.reference, quantity: cantidad, unit_price: 0, total_amount: 0 }],
      total_amount: 0,
      status: "baja",
      notes: `[BAJA] Motivo: ${motivo}${obs ? ' — ' + obs : ''}`,
    });
    setBajaModal({ open: false, product: null, qty: '', motivo: '', obs: '' });
    setSavingAccion(false);
    // Recargar datos del modal
    const [dispatches, deliveries] = await Promise.all([Dispatch.list(), Delivery.list()]);
    setGestionData(prev => ({ ...prev, dispatches, deliveries }));
  };

  const handleTraslado = async () => {
    const { product, qty, destinoId, obs } = trasladoModal;
    const cantidad = parseInt(qty);
    if (!cantidad || cantidad <= 0) { alert("Ingresa una cantidad válida."); return; }
    if (!destinoId) { alert("Selecciona el operario destino."); return; }
    setSavingAccion(true);
    const today = getColombiaToday();
    const destino = employees.find(e => e.employee_id === destinoId);
    await Delivery.create({
      employee_id: gestionModal.employee_id,
      delivery_date: today,
      items: [{ product_reference: product.reference, quantity: cantidad, unit_price: 0, total_amount: 0 }],
      total_amount: 0,
      status: "traslado",
      notes: `[TRASLADO] Transferido a ${destino?.name || destinoId}${obs ? ' — ' + obs : ''}`,
    });
    await Dispatch.create({
      employee_id: destinoId,
      product_reference: product.reference,
      quantity: cantidad,
      dispatch_date: today,
      status: "despachado",
      observations: `[TRASLADO] Recibido de ${gestionModal.name}${obs ? ' — ' + obs : ''}`,
    });
    setTrasladoModal({ open: false, product: null, qty: '', destinoId: '', obs: '' });
    setSavingAccion(false);
    const [dispatches, deliveries] = await Promise.all([Dispatch.list(), Delivery.list()]);
    setGestionData(prev => ({ ...prev, dispatches, deliveries }));
  };

  const handleSubmit = async (employeeData) => {
    try {
      if (editingEmployee) {
        await Employee.update(editingEmployee.id, employeeData);
        alert('Empleado actualizado correctamente.');
      } else {
        await Employee.create(employeeData);
        alert('Empleado creado correctamente.');
      }
      setShowForm(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (error) {
      console.error("Error saving employee:", error);
      alert("Error al guardar el empleado.");
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = async (employee) => {
    if (window.confirm(`¿Estás seguro de eliminar al empleado ${employee.name}?`)) {
      try {
        await Employee.delete(employee.id);
        loadEmployees();
      } catch (error) {
        console.error("Error deleting employee:", error);
        alert("Error al eliminar el empleado.");
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEmployee(null);
  };

  const handleCopyLink = (employeeId) => {
    const portalUrl = `${window.location.origin}/Op_EmployeePortal?employee_id=${employeeId}`;
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(employeeId);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const openPinModal = (employee) => {
    setPinValue(employee.portal_pin || '');
    setPinModal(employee);
  };

  const handleSavePin = async () => {
    if (!pinModal) return;
    const pin = pinValue.trim();
    if (pin && (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin))) {
      alert('El PIN debe ser numérico de 4 a 6 dígitos.');
      return;
    }
    setSavingPin(true);
    try {
      await Employee.update(pinModal.id, { portal_pin: pin || null });
      await loadEmployees();
      setPinModal(null);
    } catch (e) {
      alert('Error al guardar el PIN.');
    }
    setSavingPin(false);
  };

  const handleCleanDuplicates = async () => {
    // 1. Detectar duplicados por employee_id
    const byId = {};
    employees.forEach(e => {
      if (!byId[e.employee_id]) byId[e.employee_id] = [];
      byId[e.employee_id].push(e);
    });
    const duplicateGroups = Object.values(byId).filter(g => g.length > 1);

    if (duplicateGroups.length === 0) {
      alert("No se encontraron empleados duplicados.");
      return;
    }

    // 2. Cargar actividad para decidir cuál conservar
    const [allDeliveries, allDispatches, allPayments] = await Promise.all([
      Delivery.list(),
      Dispatch.list(),
      Payment.list(),
    ]);

    const activityCount = (empId) => {
      const d = (allDeliveries || []).filter(x => x.employee_id === empId).length;
      const s = (allDispatches || []).filter(x => x.employee_id === empId).length;
      const p = (allPayments || []).filter(x => x.employee_id === empId).length;
      return d + s + p;
    };

    // 3. Por cada grupo, conservar el de más actividad (o el más antiguo si empatan)
    const toDelete = [];
    const summary = [];
    for (const group of duplicateGroups) {
      const sorted = group
        .map(e => ({ ...e, _activity: activityCount(e.employee_id) }))
        .sort((a, b) => b._activity - a._activity || new Date(a.created_date) - new Date(b.created_date));

      const keep = sorted[0];
      const remove = sorted.slice(1);
      summary.push(`${keep.employee_id} "${keep.name}": conservar (${keep._activity} registros), eliminar ${remove.length} duplicado(s) (${remove.map(r => r._activity + ' registros').join(', ')})`);
      toDelete.push(...remove);
    }

    const msg = `Se encontraron ${duplicateGroups.length} grupo(s) de duplicados:\n\n${summary.join('\n')}\n\n¿Eliminar ${toDelete.length} duplicado(s)?`;
    if (!window.confirm(msg)) return;

    try {
      for (const emp of toDelete) {
        await Employee.delete(emp.id);
      }
      alert(`${toDelete.length} duplicado(s) eliminado(s) correctamente.`);
      loadEmployees();
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-slate-600">Cargando empleados...</p>
      </div>
    );
  }

  return (
    <>
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Empleados</h1>
            <p className="text-slate-600">Gestiona la información y el acceso de los empleados.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCleanDuplicates} className="text-amber-600 border-amber-300 hover:bg-amber-50">
              <Users className="w-4 h-4 mr-2" />
              Limpiar duplicados
            </Button>
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Empleado
            </Button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
          <p className="text-blue-800 font-medium mb-1">Portal de Empleados</p>
          <p className="text-blue-700 text-sm">
            Copia el enlace del portal para cada empleado y compártelo. Así podrán ver sus datos de producción.
          </p>
        </div>

        {employees.filter(e => e.is_active !== false && !e.phone).length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 rounded-lg border-l-4 border-amber-500">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-800 font-semibold text-sm">
                  {employees.filter(e => e.is_active !== false && !e.phone).length} empleado{employees.filter(e => e.is_active !== false && !e.phone).length !== 1 ? 's' : ''} sin número de celular
                </p>
                <p className="text-amber-700 text-xs mt-0.5 mb-2">
                  El número es necesario para la lista de ruta del planillador. Edita cada uno para agregarlo.
                </p>
                <div className="flex flex-wrap gap-2">
                  {employees.filter(e => e.is_active !== false && !e.phone).map(e => (
                    <button
                      key={e.id}
                      onClick={() => { setEditingEmployee(e); setShowForm(true); }}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg text-xs font-medium text-amber-800 transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <EmployeeForm
            employee={editingEmployee}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            existingEmployees={employees}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Lista de Empleados ({employees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {employees.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {employees.map(employee => (
                  <Card key={employee.id} className="border-slate-200 hover:shadow-lg transition-shadow flex flex-col">
                    <CardContent className="p-6 flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg mb-1">{employee.name}</h3>
                          <p className="text-sm text-slate-600 font-medium">ID: {employee.employee_id}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="outline" onClick={() => handleEdit(employee)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="outline" onClick={() => handleDelete(employee)} className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {employee.position && <p className="text-sm text-slate-600"><strong>Cargo:</strong> {employee.position}</p>}
                        {employee.phone && <p className="text-sm text-slate-600 flex items-center gap-1"><Phone className="w-3 h-3" /> {employee.phone}</p>}
                        {employee.hire_date && <p className="text-sm text-slate-600 flex items-center gap-1"><Calendar className="w-3 h-3" /> Contratado: {format(new Date(employee.hire_date), 'dd/MM/yyyy')}</p>}
                        {employee.salary_per_unit && <p className="text-sm text-green-600 font-medium">${employee.salary_per_unit.toLocaleString()} por unidad</p>}
                      </div>

                      <div className="flex gap-2 mt-4 flex-wrap">
                        <Badge className={employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {employee.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {!employee.phone && (
                          <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> Sin celular
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                    <div className="p-4 bg-slate-50 border-t space-y-2">
                       <Button
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => window.location.href = createPageUrl(`EmployeeProfile?id=${employee.employee_id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2"/>
                        Ver Auditoría Contable
                      </Button>
                       <Button
                        size="sm"
                        className="w-full"
                        variant="ghost"
                        onClick={() => handleCopyLink(employee.employee_id)}
                      >
                        {copiedLink === employee.employee_id ? (
                          <><Check className="w-4 h-4 mr-2 text-green-500"/> Enlace Copiado</>
                        ) : (
                          <><LinkIcon className="w-4 h-4 mr-2"/> Copiar Enlace del Portal</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="w-full"
                        variant="outline"
                        onClick={() => openPinModal(employee)}
                      >
                        <KeyRound className="w-4 h-4 mr-2"/>
                        {employee.portal_pin ? 'Cambiar PIN' : 'Asignar PIN'}
                      </Button>
                      <Button
                        size="sm"
                        className="w-full border-slate-300 text-slate-700 hover:bg-slate-100"
                        variant="outline"
                        onClick={() => openGestion(employee)}
                      >
                        <Package className="w-4 h-4 mr-2"/>
                        Gestionar prendas
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p className="text-lg">No hay empleados registrados.</p>
                <p className="text-sm">Crea el primer empleado para comenzar.</p>
                <Button onClick={() => setShowForm(true)} className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primer Empleado
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>

    {/* Modal: Gestión de prendas */}
    {gestionModal && (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Gestionar prendas</h2>
              <p className="text-sm text-slate-500">{gestionModal.name}</p>
            </div>
            <button onClick={() => { setGestionModal(null); setBajaModal({ open: false, product: null, qty: '', motivo: '', obs: '' }); setTrasladoModal({ open: false, product: null, qty: '', destinoId: '', obs: '' }); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">✕</button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            {gestionLoading ? (
              <p className="text-center text-slate-400 py-8">Cargando...</p>
            ) : (() => {
              const pending = getPendingItems(gestionModal.employee_id);
              if (pending.length === 0) return (
                <p className="text-center text-slate-400 py-8">Sin prendas pendientes.</p>
              );
              return pending.map(({ product, pending: qty }) => (
                <div key={product.reference} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{product.nombre || product.name}</p>
                      <p className="text-xs text-slate-500">Ref: {product.reference}</p>
                    </div>
                    <span className="text-2xl font-bold text-slate-700">{qty} <span className="text-sm font-normal text-slate-400">uds</span></span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBajaModal({ open: true, product, qty: '', motivo: '', obs: '' })}
                      className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-red-200 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Dar de baja
                    </button>
                    <button
                      onClick={() => setTrasladoModal({ open: true, product, qty: '', destinoId: '', obs: '' })}
                      className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-indigo-200 transition-colors"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Trasladar
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    )}

    {/* Sub-modal: Dar de baja */}
    {bajaModal.open && (
      <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Dar de baja</h3>
              <p className="text-xs text-slate-500">{bajaModal.product?.nombre || bajaModal.product?.name} · {gestionModal?.name}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Cantidad <span className="font-normal text-slate-400">(máx. {getPendingItems(gestionModal?.employee_id).find(i => i.product.reference === bajaModal.product?.reference)?.pending ?? 0})</span>
            </label>
            <input type="number" min="1"
              max={getPendingItems(gestionModal?.employee_id).find(i => i.product.reference === bajaModal.product?.reference)?.pending ?? 0}
              value={bajaModal.qty}
              onChange={e => {
                const max = getPendingItems(gestionModal?.employee_id).find(i => i.product.reference === bajaModal.product?.reference)?.pending ?? 0;
                setBajaModal(m => ({ ...m, qty: String(Math.min(parseInt(e.target.value) || 0, max)) }));
              }}
              className="w-full border-2 border-slate-300 rounded-xl px-3 py-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="0"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Motivo *</label>
            <select value={bajaModal.motivo} onChange={e => setBajaModal(m => ({ ...m, motivo: e.target.value }))}
              className="w-full border-2 border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
              <option value="">— Seleccionar motivo —</option>
              <option value="Daño en fabricación">Daño en fabricación</option>
              <option value="Prenda extraviada">Prenda extraviada</option>
              <option value="Defecto de material">Defecto de material</option>
              <option value="Retiro del operario">Retiro del operario</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Observaciones</label>
            <textarea value={bajaModal.obs} onChange={e => setBajaModal(m => ({ ...m, obs: e.target.value }))}
              placeholder="Detalles adicionales..."
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setBajaModal({ open: false, product: null, qty: '', motivo: '', obs: '' })}
              className="flex-1 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleBaja} disabled={savingAccion || !bajaModal.qty || !bajaModal.motivo}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors">
              {savingAccion ? "Guardando..." : "Confirmar baja"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Sub-modal: Trasladar */}
    {trasladoModal.open && (
      <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Trasladar despacho</h3>
              <p className="text-xs text-slate-500">{trasladoModal.product?.nombre || trasladoModal.product?.name} · desde {gestionModal?.name}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Cantidad <span className="font-normal text-slate-400">(máx. {getPendingItems(gestionModal?.employee_id).find(i => i.product.reference === trasladoModal.product?.reference)?.pending ?? 0})</span>
            </label>
            <input type="number" min="1"
              max={getPendingItems(gestionModal?.employee_id).find(i => i.product.reference === trasladoModal.product?.reference)?.pending ?? 0}
              value={trasladoModal.qty}
              onChange={e => {
                const max = getPendingItems(gestionModal?.employee_id).find(i => i.product.reference === trasladoModal.product?.reference)?.pending ?? 0;
                setTrasladoModal(m => ({ ...m, qty: String(Math.min(parseInt(e.target.value) || 0, max)) }));
              }}
              className="w-full border-2 border-slate-300 rounded-xl px-3 py-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="0"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Operario destino *</label>
            <select value={trasladoModal.destinoId} onChange={e => setTrasladoModal(m => ({ ...m, destinoId: e.target.value }))}
              className="w-full border-2 border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              <option value="">— Seleccionar operario —</option>
              {employees.filter(e => e.employee_id !== gestionModal?.employee_id).map(e => (
                <option key={e.employee_id} value={e.employee_id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Observaciones</label>
            <textarea value={trasladoModal.obs} onChange={e => setTrasladoModal(m => ({ ...m, obs: e.target.value }))}
              placeholder="Motivo del traslado..."
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setTrasladoModal({ open: false, product: null, qty: '', destinoId: '', obs: '' })}
              className="flex-1 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleTraslado} disabled={savingAccion || !trasladoModal.qty || !trasladoModal.destinoId}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors">
              {savingAccion ? "Guardando..." : "Confirmar traslado"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal PIN */}

    {pinModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3">
            <KeyRound className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="font-bold text-slate-900">PIN del portal</h2>
              <p className="text-sm text-slate-500">{pinModal.name}</p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            El operario usará este PIN para acceder a su portal. Debe ser de 4 a 6 dígitos. Déjalo vacío para que no requiera PIN.
          </p>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Ej: 1234"
            value={pinValue}
            onChange={e => setPinValue(e.target.value)}
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setPinModal(null)} disabled={savingPin}>
              Cancelar
            </Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSavePin} disabled={savingPin}>
              {savingPin ? 'Guardando...' : 'Guardar PIN'}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}