import React, { useState, useMemo, useEffect } from "react";
import { Delivery, Dispatch, Inventory, StockMovement, AppConfig, ActivityLog } from "@/api/publicEntities";
import { portalClient } from "@/api/portalClient";

async function logActivity(params) {
  try {
    await ActivityLog.create({
      entity_type: params.entity_type || null,
      entity_id: params.entity_id || null,
      action: params.action || 'info',
      description: params.description || '',
      employee_id: params.employee_id || null,
      employee_name: params.employee_name || null,
      amount: params.amount || null,
      old_data: params.old_data || null,
      new_data: params.new_data || null,
      timestamp: new Date().toISOString(),
    });
  } catch {}
}

import { CheckCircle2, Plus, X, ChevronDown, ChevronUp, MessageCircle, Send, Loader2, Users } from "lucide-react";
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

  // Recomendaciones de calidad
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [modalEmp, setModalEmp] = useState(null);
  const [recSeleccionada, setRecSeleccionada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [bcRecId, setBcRecId] = useState("");
  const [enviandoBc, setEnviandoBc] = useState(false);
  const [okBc, setOkBc] = useState(null);

  useEffect(() => {
    portalClient.entities.RecomendacionCalidad.filter({ activa: true }).then(d => setRecomendaciones(d || [])).catch(() => {});
  }, []);

  const handleEnviarRecomendacion = async () => {
    if (!recSeleccionada || !modalEmp) return;
    const rec = recomendaciones.find(r => r.id === recSeleccionada);
    setEnviando(true);
    try {
      const res = await fetch("/api/portal/functions/enviarRecomendacionCalidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: modalEmp.employee_id, texto: rec.texto, categoria: rec.categoria }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Error al enviar"); }
      else { setEnviado(true); setTimeout(() => { setEnviado(false); setModalEmp(null); setRecSeleccionada(""); }, 1500); }
    } catch (e) { alert("Error: " + e.message); }
    setEnviando(false);
  };

  const handleBroadcast = async () => {
    if (!bcRecId) return;
    const rec = recomendaciones.find(r => r.id === bcRecId);
    if (!confirm(`¿Enviar a TODOS los operarios activos con celular?\n\n"${rec.texto.slice(0, 80)}..."`)) return;
    setEnviandoBc(true);
    try {
      const res = await fetch("/api/portal/functions/enviarRecomendacionTodos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: rec.texto, categoria: rec.categoria }),
      });
      const d = await res.json();
      if (!res.ok) alert(d.error);
      else { setOkBc(d); setBcRecId(""); setTimeout(() => setOkBc(null), 4000); }
    } catch (e) { alert(e.message); }
    setEnviandoBc(false);
  };

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

      try {
        const configs = await AppConfig.filter({ key: 'payment_window_opened_at' });
        const existing = configs.length > 0 ? configs[0] : null;
        const now = new Date();
        const alreadyOpenToday = existing?.value
          ? (() => {
              const openedAt = new Date(existing.value);
              const diffH = (now - openedAt) / (1000 * 60 * 60);
              return diffH >= 0 && diffH < 5 && openedAt.toISOString().slice(0, 10) === today;
            })()
          : false;
        if (!alreadyOpenToday) {
          const nowIso = now.toISOString();
          if (existing) { await AppConfig.update(existing.id, { value: nowIso }); }
          else { await AppConfig.create({ key: 'payment_window_opened_at', value: nowIso }); }
        }
      } catch {}
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
    setTimeout(() => { setSaved(false); resetForm(); onSaved(); }, 1500);
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
    <div className="space-y-3">
      {/* Selección de operario */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Operario</label>
        <select
          value={employeeId}
          onChange={e => { setEmployeeId(e.target.value); setDeliveryQty({}); }}
          className="w-full border border-slate-300 rounded-xl px-3 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">— Seleccionar operario —</option>
          {employees.map(e => (
            <option key={e.employee_id} value={e.employee_id}>{e.name}</option>
          ))}
        </select>

        {employeeId && employeeStats && (
          <div className="mt-3 space-y-2">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Prom. semanal</p>
                <p className="font-bold text-blue-700 text-2xl leading-none">{employeeStats.weeklyAvg || '—'}</p>
                <p className="text-xs text-slate-400 mt-0.5">uds/sem</p>
              </div>
              <div className={`rounded-xl p-3 text-center ${
                employeeStats.performancePct === null ? 'bg-slate-50' :
                employeeStats.performancePct >= 85 ? 'bg-green-50' :
                employeeStats.performancePct >= 65 ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <p className="text-xs text-slate-500 mb-0.5">Productividad</p>
                <p className={`font-bold text-2xl leading-none ${
                  employeeStats.performancePct === null ? 'text-slate-400' :
                  employeeStats.performancePct >= 85 ? 'text-green-700' :
                  employeeStats.performancePct >= 65 ? 'text-amber-700' : 'text-red-700'
                }`}>{employeeStats.performancePct !== null ? `${employeeStats.performancePct}%` : '—'}</p>
                <p className="text-xs text-slate-400 mt-0.5">último ciclo</p>
              </div>
            </div>
            {/* Devoluciones abiertas */}
            {employeeStats.openDevs.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                <p className="text-xs font-semibold text-orange-700 mb-1">
                  ⚠️ {employeeStats.openDevs.length} devolución{employeeStats.openDevs.length > 1 ? 'es' : ''} pendiente{employeeStats.openDevs.length > 1 ? 's' : ''} de reparación
                </p>
                {employeeStats.openDevs.map(d => {
                  const pend = d.quantity_sent - (d.quantity_returned || 0);
                  const prod = products.find(p => p.reference === d.product_reference);
                  return (
                    <p key={d.id} className="text-xs text-orange-800">
                      · {prod?.name || d.product_reference}: <span className="font-bold">{pend} uds</span>
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {employee && (
          <button
            onClick={() => { setModalEmp(employee); setRecSeleccionada(""); setEnviado(false); }}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-green-50 border border-green-200 text-green-700 rounded-xl active:bg-green-100"
          >
            <MessageCircle className="w-4 h-4" /> Enviar recomendación de calidad
          </button>
        )}
      </div>

      {employeeId && (
        <>
          {/* Entregas de despachos anteriores */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-green-50 border-b border-green-200">
              <p className="font-semibold text-green-800">Entregas del operario</p>
              <p className="text-xs text-green-600 mt-0.5">Quedan pendientes por entregar</p>
            </div>
            <div className="px-4 py-3">
              {pendingItems.length === 0 ? (
                <p className="text-sm text-slate-400 py-3 text-center">Sin pendientes de entrega.</p>
              ) : (
                <div className="space-y-4">
                  {pendingItems.map(({ product, pending }) => {
                    const val = parseInt(deliveryQty[product.reference] || "0");
                    const over = val > pending;
                    return (
                      <div key={product.reference}>
                        {/* Product info + input en fila */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Pendiente: <span className="font-bold text-slate-700">{pending}</span> uds
                            </p>
                          </div>
                          <input
                            type="number" min="0" max={pending} placeholder="0"
                            value={deliveryQty[product.reference] || ""}
                            onChange={e => {
                              const raw = parseInt(e.target.value) || 0;
                              setDeliveryQty(prev => ({ ...prev, [product.reference]: String(Math.min(raw, pending)) }));
                            }}
                            className={`w-20 h-12 border-2 rounded-xl px-2 text-center text-lg font-bold focus:outline-none focus:ring-2 shrink-0 ${
                              over ? "border-red-400 bg-red-50 text-red-700 focus:ring-red-400"
                                   : val > 0 ? "border-green-400 bg-green-50 text-green-800 focus:ring-green-400"
                                   : "border-slate-300 focus:ring-green-400"
                            }`}
                          />
                        </div>
                        {/* Feedback de cantidad */}
                        {val > 0 && !over && (
                          <p className="text-xs font-semibold mt-1 text-right">
                            <span className="text-green-700">Entrega: {val}</span>
                            <span className="text-slate-400 mx-1">→</span>
                            <span className={pending - val === 0 ? "text-emerald-700" : "text-orange-600"}>
                              Quedan: {pending - val}
                            </span>
                          </p>
                        )}
                        {over && (
                          <p className="text-xs text-red-600 text-right font-semibold mt-1">⚠️ Máx: {pending}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Nuevo despacho */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              className="w-full px-4 py-3.5 bg-blue-50 border-b border-blue-200 flex items-center justify-between active:bg-blue-100"
              onClick={() => setDispatchOpen(o => !o)}
            >
              <div className="text-left">
                <p className="font-semibold text-blue-800">Nuevo despacho</p>
                <p className="text-xs text-blue-500 mt-0.5">Descuenta del inventario</p>
              </div>
              {dispatchOpen ? <ChevronUp className="w-5 h-5 text-blue-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-blue-400 shrink-0" />}
            </button>

            {dispatchOpen && (
              <div className="px-4 py-3 space-y-3">
                {newDispatches.map((item, i) => {
                  const stock = item.product_reference ? getStock(item.product_reference) : null;
                  const over = stock !== null && parseInt(item.quantity) > stock;
                  return (
                    <div key={i} className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      {/* Referencia */}
                      <select
                        value={item.product_reference}
                        onChange={e => updateDispatch(i, "product_reference", e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      >
                        <option value="">— Seleccionar referencia —</option>
                        {products.map(p => (
                          <option key={p.reference} value={p.reference}>
                            {p.name} (stock: {getStock(p.reference)})
                          </option>
                        ))}
                      </select>

                      {/* Cantidad + Eliminar */}
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <input
                            type="number" min="1" placeholder="Cantidad a despachar"
                            value={item.quantity}
                            onChange={e => {
                              const raw = parseInt(e.target.value) || 0;
                              const maxStock = item.product_reference ? getStock(item.product_reference) : 9999;
                              updateDispatch(i, "quantity", String(Math.min(raw, maxStock)));
                            }}
                            className={`w-full h-12 border-2 rounded-xl px-3 text-base font-semibold focus:outline-none focus:ring-2 ${
                              over ? "border-orange-400 bg-orange-50 text-orange-800 focus:ring-orange-400"
                                   : "border-slate-300 focus:ring-blue-400 bg-white"
                            }`}
                          />
                        </div>
                        {newDispatches.length > 1 && (
                          <button
                            onClick={() => setNewDispatches(prev => prev.filter((_, idx) => idx !== i))}
                            className="w-12 h-12 flex items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-500 shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Stock info */}
                      {item.product_reference && stock !== null && (
                        <p className={`text-xs px-1 ${over ? "text-orange-600 font-semibold" : "text-slate-400"}`}>
                          {over ? `⚠️ Stock disponible: ${stock}` : `Stock disponible: ${stock} uds`}
                        </p>
                      )}

                      {/* Observaciones */}
                      <textarea
                        placeholder="Observaciones (opcional)"
                        value={item.observations || ""}
                        onChange={e => updateDispatch(i, "observations", e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none h-16 bg-white placeholder-slate-400"
                      />
                    </div>
                  );
                })}

                <button
                  onClick={() => setNewDispatches(prev => [...prev, { product_reference: "", quantity: "", observations: "" }])}
                  className="w-full py-3 border-2 border-dashed border-blue-200 rounded-xl text-blue-600 text-sm font-medium flex items-center justify-center gap-2 active:bg-blue-50"
                >
                  <Plus className="w-4 h-4" /> Agregar referencia
                </button>
              </div>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white h-14 text-base font-bold rounded-xl"
          >
            {saving ? "Guardando..." : "Guardar todo"}
          </Button>
        </>
      )}

      {/* Enviar recomendación a todos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-emerald-500" /> Enviar recomendación a todos los operarios
        </h3>
        {okBc ? (
          <div className="text-sm text-green-700 p-3 bg-green-50 border border-green-200 rounded-lg">
            ✅ Enviado a {okBc.enviados} operario{okBc.enviados !== 1 ? "s" : ""}.
            {okBc.errores?.length > 0 && <p className="text-amber-700 mt-1">⚠️ {okBc.errores.join(", ")}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <select value={bcRecId} onChange={e => setBcRecId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm">
              <option value="">— Seleccionar recomendación —</option>
              {recomendaciones.map(r => (
                <option key={r.id} value={r.id}>[{r.categoria}] {r.texto.slice(0, 60)}{r.texto.length > 60 ? "…" : ""}</option>
              ))}
            </select>
            {recomendaciones.length === 0 && (
              <p className="text-xs text-amber-600">Sin recomendaciones activas. Agrégalas en Configuración → WhatsApp.</p>
            )}
            <button onClick={handleBroadcast} disabled={!bcRecId || enviandoBc}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl disabled:opacity-50 active:bg-emerald-700">
              {enviandoBc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              {enviandoBc ? "Enviando..." : "Enviar a todos"}
            </button>
          </div>
        )}
      </div>

      {/* Modal recomendación individual */}
      {modalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            {enviado ? (
              <div className="flex flex-col items-center py-6 gap-3 text-green-700">
                <CheckCircle2 className="w-14 h-14" />
                <p className="text-lg font-bold">¡Enviado!</p>
                <p className="text-sm text-slate-500">Mensaje WhatsApp enviado a {modalEmp.name}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-base">Recomendación de calidad</h3>
                  <button onClick={() => setModalEmp(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                  <p className="text-xs text-green-700 font-semibold">Operario</p>
                  <p className="text-sm font-bold text-slate-800">{modalEmp.name}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Selecciona la recomendación</label>
                  {recomendaciones.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      Sin recomendaciones activas. Agrega en Configuración → WhatsApp.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {recomendaciones.map(rec => (
                        <button key={rec.id} type="button" onClick={() => setRecSeleccionada(rec.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                            recSeleccionada === rec.id
                              ? "border-green-500 bg-green-50 text-green-800 font-medium"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}>
                          {rec.categoria && <span className="text-[10px] font-bold uppercase text-slate-400 block">{rec.categoria}</span>}
                          {rec.texto}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setModalEmp(null)}
                    className="flex-1 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-600">
                    Cancelar
                  </button>
                  <button onClick={handleEnviarRecomendacion} disabled={!recSeleccionada || enviando}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-lg bg-green-600 text-white disabled:opacity-50">
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {enviando ? "Enviando..." : "Enviar por WhatsApp"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
