import React, { useState, useMemo } from "react";
import { Muestra, Delivery, Dispatch, Inventory, StockMovement, Employee } from "@/api/publicEntities";
import { CheckCircle2, XCircle, User, Package, ChevronDown, ChevronUp, FlaskConical } from "lucide-react";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

export default function RouteMuestras({ employees, products, dispatches, deliveries, inventory, muestras, onSaved }) {
  const [view, setView] = useState("list"); // list | nueva
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [expandedResult, setExpandedResult] = useState(null);

  // Form nueva muestra
  const [candidateName, setCandidateName] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [productRef, setProductRef] = useState("");
  const [qty, setQty] = useState("");
  const [guiaOrigin, setGuiaOrigin] = useState("inventario");
  const [guiaEmpId, setGuiaEmpId] = useState("");
  const [sourceType, setSourceType] = useState("corte");
  const [sourceEmpId, setSourceEmpId] = useState("");

  // Form resultado
  const [resultQty, setResultQty] = useState("");
  const [resultStatus, setResultStatus] = useState("aprobada");

  const today = getColombiaToday();

  const getInv = (ref) => inventory.find(i => i.product_reference === ref);
  const getProd = (ref) => products.find(p => p.reference === ref);
  const empName = (id) => employees.find(e => e.employee_id === id)?.name || id;

  // Operarios con pendientes del producto seleccionado (para guía y para source)
  const employeesWithPending = useMemo(() => {
    if (!productRef) return [];
    return employees.map(emp => {
      const dispatched = dispatches
        .filter(d => d.employee_id === emp.employee_id && d.product_reference === productRef)
        .reduce((s, d) => s + (d.quantity || 0), 0);
      const delivered = deliveries
        .filter(d => d.employee_id === emp.employee_id && d.status !== "borrador")
        .reduce((s, d) => {
          if (d.items?.length > 0) {
            const item = d.items.find(i => i.product_reference === productRef);
            return s + (item ? item.quantity || 0 : 0);
          }
          if (d.product_reference === productRef) return s + (d.quantity || 0);
          return s;
        }, 0);
      const pending = dispatched - delivered;
      return pending > 0 ? { ...emp, pendingGuia: pending } : null;
    }).filter(Boolean);
  }, [productRef, employees, dispatches, deliveries]);

  // Siguiente employee_id disponible
  const nextEmployeeId = useMemo(() => {
    const used = employees.map(e => parseInt(e.employee_id, 10)).filter(n => !isNaN(n) && n > 0);
    const next = used.length > 0 ? Math.max(...used) + 1 : 1;
    return String(next).padStart(3, "0");
  }, [employees]);

  const guiaOp = employeesWithPending.find(e => e.employee_id === guiaEmpId);
  const sourceOp = employeesWithPending.find(e => e.employee_id === sourceEmpId);
  const cantidad = parseInt(qty) || 0;
  const isSamePerson = guiaOrigin === "operario" && sourceType === "despacho" && !!guiaEmpId && !!sourceEmpId && guiaEmpId === sourceEmpId;

  let pendingWarning = null;
  if (isSamePerson) {
    const available = guiaOp?.pendingGuia || 0;
    if (available < 1 + cantidad) {
      pendingWarning = `${empName(guiaEmpId)} tiene ${available} pendientes — necesita ${1 + cantidad} (1 guía + ${cantidad} material)`;
    }
  } else if (sourceType === "despacho" && sourceEmpId && cantidad > 0) {
    const sourcePending = sourceOp?.pendingGuia || 0;
    if (sourcePending < cantidad) {
      pendingWarning = `${empName(sourceEmpId)} tiene ${sourcePending} pendientes — la muestra necesita ${cantidad}`;
    }
  }

  const canSubmitNueva = candidateName.trim() && productRef && cantidad > 0 &&
    (guiaOrigin === "inventario" || (guiaOrigin === "operario" && guiaEmpId && employeesWithPending.length > 0)) &&
    (sourceType !== "despacho" || sourceEmpId) &&
    !pendingWarning;

  // ─────────────────────────────────────────────────────────────────────────
  // CREAR MUESTRA
  // ─────────────────────────────────────────────────────────────────────────
  const handleCrearMuestra = async () => {
    if (!canSubmitNueva) return;
    setSaving(true);
    const cantidad = parseInt(qty);
    const prod = getProd(productRef);
    const unitPrice = prod?.manufacturing_price || 0;

    try {
      await Muestra.create({
        status: "pendiente",
        candidate_name: candidateName.trim(),
        candidate_phone: candidatePhone.trim(),
        product_reference: productRef,
        quantity: cantidad,
        muestra_date: today,
        guia_origin: guiaOrigin,
        guia_employee_id: guiaOrigin === "operario" ? guiaEmpId : null,
        guia_quantity: 1,
        source_type: sourceType,
        source_employee_id: sourceType === "despacho" ? sourceEmpId : null,
      });

      // ── Prenda guía ──────────────────────────────────────────────────────
      if (guiaOrigin === "inventario") {
        // Sale del inventario; vuelve cuando el candidato la retorna (al resultado)
        const inv = getInv(productRef);
        if (inv) {
          const newStock = inv.current_stock - 1;
          await Inventory.update(inv.id, { current_stock: newStock });
          await StockMovement.create({
            product_reference: productRef,
            movement_type: "salida",
            quantity: 1,
            movement_date: today,
            reason: `Prenda guía para muestra — candidato: ${candidateName.trim()}`,
            previous_stock: inv.current_stock,
            new_stock: newStock,
          });
        }
      } else if (guiaOrigin === "operario") {
        // El operario entrega la prenda al planillador:
        // → se le acredita como entrega normal (para pago) y reduce su pendiente
        // → NO entra al inventario todavía: la prenda está con el candidato para control
        await Delivery.create({
          employee_id: guiaEmpId,
          delivery_date: today,
          items: [{ product_reference: productRef, quantity: 1, unit_price: unitPrice, total_amount: unitPrice }],
          total_amount: unitPrice,
          status: "muestra_guia",
          notes: `[PRENDA GUÍA EN PRÉSTAMO] Candidato: ${candidateName.trim()}`,
        });
      }

      // ── Origen materia prima ─────────────────────────────────────────────
      if (sourceType === "despacho" && sourceEmpId) {
        // Las unidades salen del despacho del operario original (reduce su pendiente)
        // No se pagan: es un traslado de material crudo, no una entrega de producto terminado
        await Delivery.create({
          employee_id: sourceEmpId,
          delivery_date: today,
          items: [{ product_reference: productRef, quantity: cantidad, unit_price: 0, total_amount: 0 }],
          total_amount: 0,
          status: "traslado_muestra",
          notes: `[MATERIAL PARA MUESTRA] Candidato: ${candidateName.trim()}`,
        });
      }

      setSavedMsg("¡Muestra registrada!");
      setTimeout(() => {
        setSavedMsg("");
        setCandidateName(""); setCandidatePhone(""); setProductRef(""); setQty("");
        setGuiaOrigin("inventario"); setGuiaEmpId(""); setSourceType("corte"); setSourceEmpId("");
        setView("list");
        onSaved();
      }, 1500);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRAR RESULTADO
  // ─────────────────────────────────────────────────────────────────────────
  const handleRegistrarResultado = async (m) => {
    const rQty = parseInt(resultQty) || 0;
    setSaving(true);
    try {
      const inv = getInv(m.product_reference);
      const prod = getProd(m.product_reference);
      const unitPrice = prod?.manufacturing_price || 0;
      let stockActual = inv?.current_stock || 0;

      // ── 1. Prendas fabricadas por el candidato → inventario (SIEMPRE) ───
      if (rQty > 0 && inv) {
        const newStock = stockActual + rQty;
        await Inventory.update(inv.id, { current_stock: newStock });
        await StockMovement.create({
          product_reference: m.product_reference,
          movement_type: "entrada",
          quantity: rQty,
          movement_date: today,
          reason: `Muestra fabricada — candidato: ${m.candidate_name}`,
          previous_stock: stockActual,
          new_stock: newStock,
        });
        stockActual = newStock;
      }

      // ── 2. Prenda guía regresa al inventario solo si vino del inventario ───
      // • Origen inventario: fue descontada al crear → vuelve aquí
      // • Origen operario: el operario ya cobró vía muestra_guia; la prenda
      //   queda con el candidato → NO entra al inventario (evita unidad fantasma)
      if (inv && m.guia_origin === "inventario") {
        const guiaQty = m.guia_quantity || 1;
        const newStock = stockActual + guiaQty;
        await Inventory.update(inv.id, { current_stock: newStock });
        await StockMovement.create({
          product_reference: m.product_reference,
          movement_type: "entrada",
          quantity: guiaQty,
          movement_date: today,
          reason: m.guia_origin === "inventario"
            ? `Devolución prenda guía — muestra candidato: ${m.candidate_name}`
            : `Prenda guía retornada al inventario — operario: ${empName(m.guia_employee_id)}, candidato: ${m.candidate_name}`,
          previous_stock: stockActual,
          new_stock: newStock,
        });
        stockActual = newStock;
      }

      // ── 3. Si aprobado: crear empleado + despacho + entrega para pago ───
      if (resultStatus === "aprobada" && rQty > 0) {
        const newEmp = await Employee.create({
          name: m.candidate_name,
          phone: m.candidate_phone || "",
          employee_id: nextEmployeeId,
          position: "operario",
          is_active: true,
          hire_date: today,
        });
        const empId = newEmp.employee_id || nextEmployeeId;

        // Despacho: registra las unidades que le fueron asignadas al candidato
        await Dispatch.create({
          employee_id: empId,
          product_reference: m.product_reference,
          quantity: rQty,
          dispatch_date: today,
          status: "despachado",
          observations: `[MUESTRA] Origen: ${m.source_type}${m.source_employee_id ? " — op. " + empName(m.source_employee_id) : ""}`,
        });

        // Entrega: las unidades que fabricó → acredita al pago
        await Delivery.create({
          employee_id: empId,
          delivery_date: today,
          items: [{ product_reference: m.product_reference, quantity: rQty, unit_price: unitPrice, total_amount: unitPrice * rQty }],
          total_amount: unitPrice * rQty,
          status: "entrega",
          notes: `[MUESTRA APROBADA] Ingreso como operario`,
        });
      }

      await Muestra.update(m.id, {
        status: resultStatus,
        result_date: today,
        result_quantity: rQty,
      });

      setExpandedResult(null);
      setResultQty("");
      setResultStatus("aprobada");
      onSaved();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const pendientes = (muestras || []).filter(m => m.status === "pendiente");
  const historial = (muestras || []).filter(m => m.status !== "pendiente")
    .sort((a, b) => (b.result_date || b.muestra_date || "").localeCompare(a.result_date || a.muestra_date || ""))
    .slice(0, 10);

  // ── Vista: Nueva Muestra ──────────────────────────────────────────────────
  if (view === "nueva") {
    if (savedMsg) return (
      <div className="flex flex-col items-center py-16 gap-3">
        <CheckCircle2 className="w-14 h-14 text-violet-600" />
        <p className="text-xl font-bold text-slate-800">{savedMsg}</p>
      </div>
    );

    return (
      <div className="space-y-3">
        <button onClick={() => setView("list")} className="text-sm text-slate-500 flex items-center gap-1">
          ← Volver a muestras
        </button>

        {/* Paso 1: Candidato */}
        <div className="bg-white rounded-xl border-2 border-violet-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-violet-50 border-b border-violet-200">
            <p className="font-bold text-violet-900 text-sm">① Candidato</p>
          </div>
          <div className="px-4 py-3 space-y-3">
            <input type="text" placeholder="Nombre completo *"
              value={candidateName} onChange={e => setCandidateName(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <input type="tel" placeholder="Teléfono (opcional)"
              value={candidatePhone} onChange={e => setCandidatePhone(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
        </div>

        {/* Paso 2: Producto */}
        {candidateName.trim() && (
          <div className="bg-white rounded-xl border-2 border-violet-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-violet-50 border-b border-violet-200">
              <p className="font-bold text-violet-900 text-sm">② Producto y cantidad a fabricar</p>
            </div>
            <div className="px-4 py-3 space-y-3">
              <select value={productRef} onChange={e => { setProductRef(e.target.value); setGuiaEmpId(""); setSourceEmpId(""); }}
                className="w-full border border-slate-300 rounded-xl px-3 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              >
                <option value="">— Seleccionar referencia —</option>
                {products.map(p => <option key={p.reference} value={p.reference}>{p.name || p.nombre}</option>)}
              </select>
              {productRef && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">Unidades a fabricar</label>
                  <input type="number" min="1" placeholder="0"
                    value={qty} onChange={e => setQty(e.target.value)}
                    className="w-full h-14 border-2 border-slate-300 rounded-xl px-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paso 3: Origen materia prima */}
        {productRef && parseInt(qty) > 0 && (
          <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <p className="font-bold text-slate-700 text-sm">③ Origen del material a fabricar</p>
              <p className="text-xs text-slate-400 mt-0.5">¿De dónde sale la materia prima que usará el candidato?</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              {[
                { id: "corte", label: "Corte individual" },
                { id: "presupuesto", label: "Presupuesto" },
                { id: "despacho", label: "Despacho de otro operario" },
              ].map(opt => (
                <button key={opt.id} onClick={() => { setSourceType(opt.id); setSourceEmpId(""); }}
                  className={`w-full text-left px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    sourceType === opt.id ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {sourceType === "despacho" && (
                <>
                  <select value={sourceEmpId} onChange={e => setSourceEmpId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white mt-1"
                  >
                    <option value="">— Operario original —</option>
                    {(employeesWithPending.length > 0 ? employeesWithPending : employees).map(e => (
                      <option key={e.employee_id} value={e.employee_id}>
                        {e.name}{e.pendingGuia ? ` (${e.pendingGuia} pendientes)` : ""}
                      </option>
                    ))}
                  </select>
                  {sourceEmpId && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <p className="text-xs text-slate-500">Al registrar, se descuentan <strong>{qty} uds</strong> del despacho de {empName(sourceEmpId)} sin pago (traslado de material).</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Paso 4: Prenda guía */}
        {productRef && parseInt(qty) > 0 && (sourceType !== "despacho" || sourceEmpId) && (
          <div className="bg-white rounded-xl border-2 border-amber-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
              <p className="font-bold text-amber-900 text-sm">④ Prenda guía</p>
              <p className="text-xs text-amber-600 mt-0.5">Prenda ya confeccionada que el candidato usa como modelo</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setGuiaOrigin("inventario"); setGuiaEmpId(""); }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    guiaOrigin === "inventario" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <Package className="w-4 h-4" /> Inventario
                </button>
                <button onClick={() => setGuiaOrigin("operario")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    guiaOrigin === "operario" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <User className="w-4 h-4" /> Operario
                </button>
              </div>

              {guiaOrigin === "inventario" && (() => {
                const inv = getInv(productRef);
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <p className="text-xs font-semibold text-amber-800">Sale del inventario (1 unidad)</p>
                    <p className="text-xs text-amber-600 mt-0.5">Stock disponible: {inv?.current_stock ?? "—"} uds · Vuelve al inventario cuando el candidato la retorna.</p>
                  </div>
                );
              })()}

              {guiaOrigin === "operario" && (
                <>
                  {employeesWithPending.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3">
                      <p className="text-sm text-slate-500 text-center">Ningún operario tiene pendientes de este producto</p>
                    </div>
                  ) : (
                    <select value={guiaEmpId} onChange={e => setGuiaEmpId(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    >
                      <option value="">— Seleccionar operario —</option>
                      {employeesWithPending.map(e => (
                        <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.pendingGuia} disponibles)</option>
                      ))}
                    </select>
                  )}
                  {guiaEmpId && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <p className="text-xs font-semibold text-amber-800">Al registrar la muestra:</p>
                      <p className="text-xs text-amber-700 mt-0.5">• Se le acredita 1 entrega a {empName(guiaEmpId)} (reduce su pendiente y suma al pago)</p>
                      <p className="text-xs text-amber-700">• La prenda queda con el candidato — entra al inventario cuando la retorna</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {candidateName.trim() && productRef && cantidad > 0 &&
          (guiaOrigin === "inventario" || (guiaOrigin === "operario" && guiaEmpId && employeesWithPending.length > 0)) &&
          (sourceType !== "despacho" || sourceEmpId) && (
            pendingWarning ? (
              <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
                <p className="text-sm font-bold text-red-700">Pendientes insuficientes</p>
                <p className="text-xs text-red-600 mt-1">{pendingWarning}</p>
              </div>
            ) : (
              <button onClick={handleCrearMuestra} disabled={saving}
                className="w-full h-14 bg-violet-600 active:bg-violet-700 text-white text-base font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FlaskConical className="w-5 h-5" />
                {saving ? "Registrando..." : "Registrar muestra"}
              </button>
            )
          )}
      </div>
    );
  }

  // ── Vista: Lista de muestras ──────────────────────────────────────────────
  return (
    <div className="space-y-3">

      <button onClick={() => setView("nueva")}
        className="w-full h-12 bg-violet-600 active:bg-violet-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm"
      >
        <FlaskConical className="w-4 h-4" /> Nueva muestra
      </button>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-violet-50 border-b border-violet-200">
            <p className="font-semibold text-violet-800 text-sm">Pendientes ({pendientes.length})</p>
          </div>
          <div className="divide-y divide-slate-100">
            {pendientes.map(m => {
              const prod = getProd(m.product_reference);
              const isExpanded = expandedResult === m.id;
              return (
                <div key={m.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{m.candidate_name}</p>
                      {m.candidate_phone && <p className="text-xs text-slate-400">{m.candidate_phone}</p>}
                      <p className="text-xs text-slate-500 mt-1">
                        {prod?.name || m.product_reference} · {m.quantity} uds
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Guía: {m.guia_origin === "operario" ? empName(m.guia_employee_id) : "Inventario"}
                        {m.source_type === "despacho" && m.source_employee_id && ` · Material de: ${empName(m.source_employee_id)}`}
                        {" · "}{m.muestra_date}
                      </p>
                    </div>
                    <button
                      onClick={() => { setExpandedResult(isExpanded ? null : m.id); setResultQty(""); setResultStatus("aprobada"); }}
                      className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 active:bg-violet-100"
                    >
                      Resultado {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {isExpanded && (() => {
                    const rQtyNum = parseInt(resultQty) || 0;
                    const canConfirm = rQtyNum > 0 && (resultStatus === "rechazada" || rQtyNum > 0);
                    const canApprove = resultStatus === "rechazada" || rQtyNum > 0;
                    return (
                      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 block mb-1.5">
                            Unidades fabricadas por el candidato
                          </label>
                          <input type="number" min="0" max={m.quantity} placeholder="0"
                            value={resultQty} onChange={e => setResultQty(e.target.value)}
                            className="w-full h-12 border-2 border-slate-300 rounded-xl px-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setResultStatus("aprobada")}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                              resultStatus === "aprobada" ? "border-green-500 bg-green-50 text-green-800" : "border-slate-200 bg-white text-slate-500"
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" /> Aprobada
                          </button>
                          <button onClick={() => setResultStatus("rechazada")}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                              resultStatus === "rechazada" ? "border-red-500 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-500"
                            }`}
                          >
                            <XCircle className="w-4 h-4" /> Rechazada
                          </button>
                        </div>

                        {/* Warning: aprobada sin unidades */}
                        {resultStatus === "aprobada" && rQtyNum === 0 && (
                          <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5">
                            <p className="text-xs font-semibold text-amber-800">Ingresa las unidades fabricadas</p>
                            <p className="text-xs text-amber-600 mt-0.5">Para aprobar se necesita al menos 1 unidad.</p>
                          </div>
                        )}

                        {/* Resumen de lo que va a pasar */}
                        {rQtyNum > 0 && (
                          <div className={`border rounded-xl px-3 py-2.5 space-y-1 ${resultStatus === "aprobada" ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
                            <p className={`text-xs font-semibold ${resultStatus === "aprobada" ? "text-green-800" : "text-slate-600"}`}>Al confirmar:</p>
                            <p className={`text-xs ${resultStatus === "aprobada" ? "text-green-700" : "text-slate-500"}`}>
                              • {rQtyNum} uds del candidato entran al inventario de asignación
                            </p>
                            <p className={`text-xs ${resultStatus === "aprobada" ? "text-green-700" : "text-slate-500"}`}>
                              • Prenda guía retorna al inventario
                              {m.guia_origin === "operario" && ` (la entrega de ${empName(m.guia_employee_id)} ya fue registrada al crear la muestra)`}
                            </p>
                            {resultStatus === "aprobada" && (
                              <>
                                <p className="text-xs text-green-700">• {m.candidate_name} se crea como operario (ID {nextEmployeeId})</p>
                                <p className="text-xs text-green-700">• Se le acredita despacho + entrega de {rQtyNum} uds para pago</p>
                              </>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => handleRegistrarResultado(m)}
                          disabled={saving || !canApprove || rQtyNum === 0}
                          className={`w-full h-12 text-white font-bold rounded-xl disabled:opacity-40 text-sm ${
                            resultStatus === "aprobada" ? "bg-green-600 active:bg-green-700" : "bg-red-500 active:bg-red-600"
                          }`}
                        >
                          {saving ? "Guardando..." : "Confirmar resultado"}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pendientes.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin muestras pendientes</p>
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <p className="font-semibold text-slate-600 text-sm">Historial reciente</p>
          </div>
          <div className="divide-y divide-slate-100">
            {historial.map(m => {
              const prod = getProd(m.product_reference);
              return (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  {m.status === "aprobada"
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    : <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{m.candidate_name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {prod?.name || m.product_reference} · {m.result_quantity ?? m.quantity} uds · {m.result_date || m.muestra_date}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    m.status === "aprobada" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  }`}>
                    {m.status === "aprobada" ? "Aprobada" : "Rechazada"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
