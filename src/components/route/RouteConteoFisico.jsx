import React, { useState, useMemo } from "react";
import { CheckCircle2, AlertTriangle, Plus, X, ClipboardCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

export default function RouteConteoFisico({ employees, products, deliveries, dispatches = [], devoluciones = [], onSaved }) {
  const today = getColombiaToday();

  // Fechas disponibles con entregas O retornos de devoluciones (por date_returned, no date_sent)
  const availableDates = [...new Set([
    ...deliveries
      .filter(d => d.status !== "borrador")
      .map(d => (d.delivery_date || "").slice(0, 10))
      .filter(Boolean),
    ...devoluciones
      .filter(d => d.date_returned)
      .map(d => d.date_returned.slice(0, 10))
      .filter(Boolean),
  ])].sort((a, b) => b.localeCompare(a));

  const [selectedDate, setSelectedDate] = useState(availableDates[0] || today);
  const [conteo, setConteo] = useState({});
  const [conteoDev, setConteoDev] = useState({});
  const [confirmado, setConfirmado] = useState(false);
  const [saving, setSaving] = useState(false);

  // Entregas del día seleccionado
  const selectedDeliveries = deliveries.filter(
    d => (d.delivery_date || "").slice(0, 10) === selectedDate && d.status !== "borrador"
  );

  // Devoluciones REPARADAS retornadas en el día seleccionado (por date_returned)
  const selectedDevoluciones = devoluciones.filter(
    d => d.date_returned && d.date_returned.slice(0, 10) === selectedDate && d.quantity_returned > 0
  );

  // Empleados con entrega O devolución en la fecha seleccionada
  const empConEntrega = useMemo(() => {
    const deliveryIds = [...new Set(selectedDeliveries.map(d => d.employee_id))];
    const devIds = [...new Set(selectedDevoluciones.map(d => d.employee_id))];
    const allIds = [...new Set([...deliveryIds, ...devIds])];
    return allIds.map(id => employees.find(e => e.employee_id === id)).filter(Boolean);
  }, [selectedDeliveries, selectedDevoluciones, employees]);

  // Lo que dice el sistema por empleado y referencia (entregas)
  const registradoSistema = useMemo(() => {
    const result = {};
    selectedDeliveries.forEach(d => {
      if (!result[d.employee_id]) result[d.employee_id] = {};
      if (d.items && d.items.length > 0) {
        d.items.forEach(item => {
          result[d.employee_id][item.product_reference] =
            (result[d.employee_id][item.product_reference] || 0) + (item.quantity || 0);
        });
      } else if (d.product_reference) {
        result[d.employee_id][d.product_reference] =
          (result[d.employee_id][d.product_reference] || 0) + (d.quantity || 0);
      }
    });
    return result;
  }, [selectedDeliveries]);

  // Devoluciones del sistema por empleado (agrupadas por referencia)
  // Cuenta por quantity_returned (lo que realmente retornó reparado ese día)
  const devolucionesSistema = useMemo(() => {
    const result = {};
    selectedDevoluciones.forEach(d => {
      if (!result[d.employee_id]) result[d.employee_id] = {};
      result[d.employee_id][d.product_reference] =
        (result[d.employee_id][d.product_reference] || 0) + (d.quantity_returned || 0);
    });
    return result;
  }, [selectedDevoluciones]);

  const initEmpleado = (empId) => {
    if (conteo[empId]) return;
    const refs = Object.keys(registradoSistema[empId] || {});
    const filas = refs.length > 0
      ? refs.map(ref => ({ product_reference: ref, quantity: "" }))
      : [{ product_reference: "", quantity: "" }];
    setConteo(prev => ({ ...prev, [empId]: filas }));
  };

  const initEmpleadoDev = (empId) => {
    if (conteoDev[empId]) return;
    const refs = Object.keys(devolucionesSistema[empId] || {});
    const filas = refs.length > 0
      ? refs.map(ref => ({ product_reference: ref, quantity: "" }))
      : [{ product_reference: "", quantity: "" }];
    setConteoDev(prev => ({ ...prev, [empId]: filas }));
  };

  const updateFila = (empId, idx, field, val) => {
    setConteo(prev => {
      const filas = [...(prev[empId] || [])];
      filas[idx] = { ...filas[idx], [field]: val };
      return { ...prev, [empId]: filas };
    });
  };

  const updateFilaDev = (empId, idx, field, val) => {
    setConteoDev(prev => {
      const filas = [...(prev[empId] || [])];
      filas[idx] = { ...filas[idx], [field]: val };
      return { ...prev, [empId]: filas };
    });
  };

  const addFila = (empId) => {
    setConteo(prev => ({
      ...prev,
      [empId]: [...(prev[empId] || []), { product_reference: "", quantity: "" }],
    }));
  };

  const addFilaDev = (empId) => {
    setConteoDev(prev => ({
      ...prev,
      [empId]: [...(prev[empId] || []), { product_reference: "", quantity: "" }],
    }));
  };

  const removeFila = (empId, idx) => {
    setConteo(prev => ({
      ...prev,
      [empId]: (prev[empId] || []).filter((_, i) => i !== idx),
    }));
  };

  const removeFilaDev = (empId, idx) => {
    setConteoDev(prev => ({
      ...prev,
      [empId]: (prev[empId] || []).filter((_, i) => i !== idx),
    }));
  };

  const diferencias = useMemo(() => {
    const result = {};
    empConEntrega.forEach(emp => {
      const empId = emp.employee_id;

      // Entregas
      const filas = conteo[empId] || [];
      const conteoMap = {};
      filas.forEach(f => {
        if (f.product_reference && f.quantity !== "") {
          conteoMap[f.product_reference] = (conteoMap[f.product_reference] || 0) + (parseInt(f.quantity) || 0);
        }
      });
      const sistemaMap = registradoSistema[empId] || {};
      const allRefs = new Set([...Object.keys(conteoMap), ...Object.keys(sistemaMap)]);
      const diffs = [];
      let cuadraEntregas = true;
      allRefs.forEach(ref => {
        const contadoVal = conteoMap[ref] || 0;
        const sistemaVal = sistemaMap[ref] || 0;
        const delta = contadoVal - sistemaVal;
        if (delta !== 0) cuadraEntregas = false;
        diffs.push({ ref, contado: contadoVal, sistema: sistemaVal, delta });
      });

      // Devoluciones
      const filasD = conteoDev[empId] || [];
      const conteoDevMap = {};
      filasD.forEach(f => {
        if (f.product_reference && f.quantity !== "") {
          conteoDevMap[f.product_reference] = (conteoDevMap[f.product_reference] || 0) + (parseInt(f.quantity) || 0);
        }
      });
      const sistemaDevMap = devolucionesSistema[empId] || {};
      const allDevRefs = new Set([...Object.keys(conteoDevMap), ...Object.keys(sistemaDevMap)]);
      const diffsD = [];
      let cuadraDevoluciones = true;
      allDevRefs.forEach(ref => {
        const contadoVal = conteoDevMap[ref] || 0;
        const sistemaVal = sistemaDevMap[ref] || 0;
        const delta = contadoVal - sistemaVal;
        if (delta !== 0) cuadraDevoluciones = false;
        diffsD.push({ ref, contado: contadoVal, sistema: sistemaVal, delta });
      });

      const tieneEntregas = Object.keys(sistemaMap).length > 0;
      const tieneDevoluciones = Object.keys(sistemaDevMap).length > 0;
      const ingresadoEntregas = filas.some(f => f.product_reference && f.quantity !== "");
      const ingresadoDevoluciones = filasD.some(f => f.product_reference && f.quantity !== "");

      const cuadra = (!tieneEntregas || (ingresadoEntregas && cuadraEntregas)) &&
                     (!tieneDevoluciones || (ingresadoDevoluciones && cuadraDevoluciones));

      result[empId] = {
        cuadra,
        cuadraEntregas,
        cuadraDevoluciones,
        diffs,
        diffsD,
        tieneEntregas,
        tieneDevoluciones,
        ingresadoEntregas,
        ingresadoDevoluciones,
        ingresado: ingresadoEntregas || ingresadoDevoluciones,
      };
    });
    return result;
  }, [conteo, conteoDev, empConEntrega, registradoSistema, devolucionesSistema]);

  const todosCuadran = empConEntrega.length > 0 &&
    empConEntrega.every(emp => diferencias[emp.employee_id]?.cuadra);

  const hayDiferencias = empConEntrega.some(
    emp => diferencias[emp.employee_id]?.ingresado && !diferencias[emp.employee_id]?.cuadra
  );

  const prodName = (ref) => products.find(p => p.reference === ref)?.name || `Ref. ${ref}`;

  if (availableDates.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
        <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No hay entregas ni devoluciones registradas</p>
        <p className="text-sm mt-1">Aparecerán aquí una vez se registren en las otras pestañas</p>
      </div>
    );
  }

  if (confirmado) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-green-700">
        <CheckCircle2 className="w-14 h-14" />
        <p className="text-xl font-bold">¡Conteo confirmado!</p>
        <p className="text-sm text-slate-500">Las correcciones se aplicaron. Ya puedes notificar al admin para aprobar pagos.</p>
        <Button variant="outline" onClick={() => { setConfirmado(false); setConteo({}); setConteoDev({}); }} className="mt-4">
          Hacer otro conteo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector de fecha */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-600 shrink-0">Fecha a contar:</span>
        <select
          value={selectedDate}
          onChange={e => { setSelectedDate(e.target.value); setConteo({}); setConteoDev({}); setConfirmado(false); }}
          className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {availableDates.map(d => (
            <option key={d} value={d}>{d}{d === today ? " (hoy)" : ""}</option>
          ))}
        </select>
      </div>

      {/* Totales del sistema: entregas */}
      {(() => {
        const totalPorRef = {};
        selectedDeliveries.forEach(d => {
          if (d.items?.length > 0) {
            d.items.forEach(i => {
              totalPorRef[i.product_reference] = (totalPorRef[i.product_reference] || 0) + (i.quantity || 0);
            });
          } else if (d.product_reference) {
            totalPorRef[d.product_reference] = (totalPorRef[d.product_reference] || 0) + (d.quantity || 0);
          }
        });
        const totalGeneral = Object.values(totalPorRef).reduce((s, q) => s + q, 0);
        if (totalGeneral === 0) return null;
        return (
          <div className={`rounded-xl p-4 border-2 ${
            todosCuadran ? "bg-green-700 border-green-700 text-white" : "bg-slate-800 border-slate-800 text-white"
          }`}>
            <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-3">📦 Entregas registradas en sistema</p>
            <div className="flex gap-3 flex-wrap items-start">
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <p className="text-xs opacity-70">Total general</p>
                <p className="text-2xl font-bold">{totalGeneral.toLocaleString("es-CO")} uds</p>
              </div>
              {Object.entries(totalPorRef).map(([ref, qty]) => (
                <div key={ref} className="bg-white/10 rounded-lg px-3 py-2">
                  <p className="text-xs opacity-70">{prodName(ref)}</p>
                  <p className="text-xl font-bold">{qty.toLocaleString("es-CO")} uds</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Totales del sistema: devoluciones */}
      {(() => {
        const totalDevPorRef = {};
        selectedDevoluciones.forEach(d => {
          totalDevPorRef[d.product_reference] = (totalDevPorRef[d.product_reference] || 0) + (d.quantity_returned || 0);
        });
        const totalDev = Object.values(totalDevPorRef).reduce((s, q) => s + q, 0);
        if (totalDev === 0) return null;
        return (
          <div className="rounded-xl p-4 border-2 bg-orange-700 border-orange-700 text-white">
            <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-3">🔧 Devoluciones reparadas retornadas</p>
            <div className="flex gap-3 flex-wrap items-start">
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <p className="text-xs opacity-70">Total devoluciones</p>
                <p className="text-2xl font-bold">{totalDev.toLocaleString("es-CO")} uds</p>
              </div>
              {Object.entries(totalDevPorRef).map(([ref, qty]) => (
                <div key={ref} className="bg-white/10 rounded-lg px-3 py-2">
                  <p className="text-xs opacity-70">{prodName(ref)}</p>
                  <p className="text-xl font-bold">{qty.toLocaleString("es-CO")} uds</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Despachos del día seleccionado */}
      {(() => {
        const dispByRef = {};
        dispatches.filter(d => (d.dispatch_date || "").slice(0, 10) === selectedDate).forEach(d => {
          dispByRef[d.product_reference] = (dispByRef[d.product_reference] || 0) + (d.quantity || 0);
        });
        const totalDisp = Object.values(dispByRef).reduce((s, q) => s + q, 0);
        if (totalDisp === 0) return null;
        return (
          <div className="bg-blue-700 text-white rounded-xl p-4 border-2 border-blue-700">
            <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-3">🚧 Despachos del día</p>
            <div className="flex gap-3 flex-wrap items-start">
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <p className="text-xs opacity-70">Total despachado</p>
                <p className="text-2xl font-bold">{totalDisp.toLocaleString("es-CO")} uds</p>
              </div>
              {Object.entries(dispByRef).map(([ref, qty]) => (
                <div key={ref} className="bg-white/10 rounded-lg px-3 py-2">
                  <p className="text-xs opacity-70">{prodName(ref)}</p>
                  <p className="text-xl font-bold">{qty.toLocaleString("es-CO")} uds</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Resumen de estado */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${
        todosCuadran ? "bg-green-50 border border-green-200" :
        hayDiferencias ? "bg-red-50 border border-red-200" :
        "bg-slate-50 border border-slate-200"
      }`}>
        <ClipboardCheck className={`w-6 h-6 shrink-0 ${
          todosCuadran ? "text-green-600" :
          hayDiferencias ? "text-red-500" : "text-slate-400"
        }`} />
        <div>
          <p className="font-semibold text-sm">
            {todosCuadran ? "✅ Todo cuadra — conteo en firme" :
             hayDiferencias ? "⚠️ Hay diferencias — revisa antes de aprobar pagos" :
             "Ingresa el conteo físico por operario"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {empConEntrega.length} operario{empConEntrega.length !== 1 ? "s" : ""} con entregas o devoluciones · {selectedDate}{selectedDate === today ? " (hoy)" : ""}
          </p>
        </div>
      </div>

      {/* Conteo por empleado */}
      {empConEntrega.map(emp => {
        const empId = emp.employee_id;
        const filas = conteo[empId];
        const filasD = conteoDev[empId];
        const diff = diferencias[empId];
        const { tieneEntregas, tieneDevoluciones } = diff || {};

        return (
          <div key={empId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header del empleado */}
            <div className={`px-4 py-3 ${
              !diff?.ingresado ? "bg-slate-50" :
              diff?.cuadra ? "bg-green-50" : "bg-red-50"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-slate-800">{emp.name}</p>
                  <div className="flex gap-3 mt-0.5 flex-wrap">
                    {tieneEntregas && (
                      <p className="text-xs text-slate-500">
                        📦 Entregas sistema: {Object.entries(registradoSistema[empId] || {}).map(([ref, qty]) => `${qty} ${prodName(ref)}`).join(", ")}
                      </p>
                    )}
                    {tieneDevoluciones && (
                      <p className="text-xs text-orange-600">
                        🔧 Reparadas sistema: {Object.entries(devolucionesSistema[empId] || {}).map(([ref, qty]) => `${qty} ${prodName(ref)}`).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                {diff?.ingresado && (
                  diff?.cuadra
                    ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    : <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                )}
              </div>
            </div>

            <div className="px-4 py-3 space-y-4">

              {/* Sección entregas */}
              {tieneEntregas && (
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <span className="text-green-600">📦</span> Conteo de entregas
                  </p>
                  {!filas ? (
                    <button
                      onClick={() => initEmpleado(empId)}
                      className="w-full py-2 text-xs bg-green-50 border border-dashed border-green-300 rounded-lg text-green-700 hover:bg-green-100 transition-colors"
                    >
                      Toca para ingresar conteo de entregas
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {filas.map((fila, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <select
                            value={fila.product_reference}
                            onChange={e => updateFila(empId, idx, "product_reference", e.target.value)}
                            className="flex-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="">— Referencia —</option>
                            {products.map(p => (
                              <option key={p.reference} value={p.reference}>{p.name}</option>
                            ))}
                          </select>
                          <input
                            type="number" min="0" placeholder="Cant."
                            value={fila.quantity}
                            onChange={e => updateFila(empId, idx, "quantity", e.target.value)}
                            className="w-20 border border-slate-300 rounded-lg px-2 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <button onClick={() => removeFila(empId, idx)} className="text-red-400 shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addFila(empId)}
                        className="w-full py-1.5 border border-dashed border-blue-300 rounded-lg text-blue-600 text-xs flex items-center justify-center gap-1 hover:bg-blue-50"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar referencia
                      </button>
                      {diff?.ingresadoEntregas && (
                        <div className={`mt-1 rounded-lg p-3 ${diff.cuadraEntregas ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                          {diff.cuadraEntregas ? (
                            <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" /> Entregas cuadran
                            </p>
                          ) : (
                            <div>
                              <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Diferencias en entregas:
                              </p>
                              {diff.diffs.filter(d => d.delta !== 0).map((d, i) => (
                                <div key={i} className="py-1.5 border-b border-red-100 last:border-0">
                                  <p className="text-xs font-semibold text-slate-700 mb-1">{prodName(d.ref)}</p>
                                  <div className="flex gap-3 text-xs flex-wrap">
                                    <span className="text-slate-500">Sistema: <b>{d.sistema}</b></span>
                                    <span className="text-slate-500">Físico: <b>{d.contado}</b></span>
                                    <span className={`font-bold ${d.delta > 0 ? "text-green-700" : "text-red-700"}`}>
                                      Diferencia: {d.delta > 0 ? `+${d.delta}` : d.delta}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sección devoluciones */}
              {tieneDevoluciones && (
                <div>
                  <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Conteo de reparadas retornadas
                  </p>
                  {!filasD ? (
                    <button
                      onClick={() => initEmpleadoDev(empId)}
                      className="w-full py-2 text-xs bg-orange-50 border border-dashed border-orange-300 rounded-lg text-orange-700 hover:bg-orange-100 transition-colors"
                    >
                      Toca para ingresar conteo de devoluciones
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {filasD.map((fila, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <select
                            value={fila.product_reference}
                            onChange={e => updateFilaDev(empId, idx, "product_reference", e.target.value)}
                            className="flex-1 border border-orange-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          >
                            <option value="">— Referencia —</option>
                            {products.map(p => (
                              <option key={p.reference} value={p.reference}>{p.name}</option>
                            ))}
                          </select>
                          <input
                            type="number" min="0" placeholder="Cant."
                            value={fila.quantity}
                            onChange={e => updateFilaDev(empId, idx, "quantity", e.target.value)}
                            className="w-20 border border-orange-300 rounded-lg px-2 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <button onClick={() => removeFilaDev(empId, idx)} className="text-red-400 shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addFilaDev(empId)}
                        className="w-full py-1.5 border border-dashed border-orange-300 rounded-lg text-orange-600 text-xs flex items-center justify-center gap-1 hover:bg-orange-50"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar referencia
                      </button>
                      {diff?.ingresadoDevoluciones && (
                        <div className={`mt-1 rounded-lg p-3 ${diff.cuadraDevoluciones ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                          {diff.cuadraDevoluciones ? (
                            <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" /> Devoluciones cuadran
                            </p>
                          ) : (
                            <div>
                              <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Diferencias en devoluciones:
                              </p>
                              {diff.diffsD.filter(d => d.delta !== 0).map((d, i) => (
                                <div key={i} className="py-1.5 border-b border-red-100 last:border-0">
                                  <p className="text-xs font-semibold text-slate-700 mb-1">{prodName(d.ref)}</p>
                                  <div className="flex gap-3 text-xs flex-wrap">
                                    <span className="text-slate-500">Sistema: <b>{d.sistema}</b></span>
                                    <span className="text-slate-500">Físico: <b>{d.contado}</b></span>
                                    <span className={`font-bold ${d.delta > 0 ? "text-green-700" : "text-red-700"}`}>
                                      Diferencia: {d.delta > 0 ? `+${d.delta}` : d.delta}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        );
      })}

      {/* Botones de acción final */}
      {empConEntrega.some(emp => diferencias[emp.employee_id]?.ingresado) && (
        <div className="space-y-2">
          {hayDiferencias && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-bold mb-1">⚠️ Hay diferencias — edita manualmente</p>
              <p className="text-xs">Ve a la pestaña <strong>Operaciones → Registros recientes</strong> y corrige las cantidades antes de confirmar el conteo.</p>
            </div>
          )}
          <Button
            onClick={() => {
              if (!todosCuadran && !confirm("Hay diferencias sin corregir. ¿Confirmar el conteo de todas formas?")) return;
              setConfirmado(true);
            }}
            disabled={saving}
            className={`w-full h-12 text-base font-semibold ${
              todosCuadran
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-slate-700 hover:bg-slate-800 text-white"
            }`}
          >
            {todosCuadran ? "✅ Confirmar conteo en firme" : "📝 Marcar conteo como realizado"}
          </Button>
        </div>
      )}
    </div>
  );
}
