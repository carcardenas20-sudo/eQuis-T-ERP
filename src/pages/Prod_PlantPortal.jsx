import React, { useState, useEffect, useMemo } from "react";
import { Remision, Operacion, Presupuesto, Producto, Servicio, OrdenServicio, AppConfig, Traslado, ProductoPOS, LocationPub, Inventory, Employee, Dispatch, Delivery, Devolucion, Muestra, TareaPlanta } from "@/api/publicEntities";
import { Factory, Wrench, RefreshCw, ChevronDown, ChevronUp, CheckCircle2,
  Play, Check, Layers, Package, ArrowRightLeft, InboxIcon, Send, X, Plus, Building2,
  Lock, Unlock, Truck, RotateCcw, PackageCheck, LogOut, Loader2, MessageCircle, Users, FlaskConical } from "lucide-react";
import TransferReceive from "@/components/transfers/TransferReceive";
import RouteOperario from "@/components/route/RouteOperario";
import RouteDevoluciones from "@/components/route/RouteDevoluciones";
import RouteConteoFisico from "@/components/route/RouteConteoFisico";
import RouteTraslados from "@/components/route/RouteTraslados";
import RouteChecklist from "@/components/route/RouteChecklist";
import RouteRegistrosHoy from "@/components/route/RouteRegistrosHoy";
import RouteMuestras from "@/components/route/RouteMuestras";
import { portalClient } from "@/api/portalClient";

const ESTADO_CFG = {
  pendiente:  { label: "Pendiente",  color: "bg-amber-100 text-amber-700 border-amber-200" },
  en_proceso: { label: "En proceso", color: "bg-blue-100 text-blue-700 border-blue-200" },
  listo:      { label: "Listo",      color: "bg-green-100 text-green-700 border-green-200" },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.pendiente;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Tarjeta de presupuesto bajo una operación ────────────────────────────────
function PresupuestoOpCard({ presupuesto, opId, estado, productoMap, onCambiarEstado }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const isListo = estado === "listo";

  const prodsDeOp = (presupuesto.productos || [])
    .filter(item => (productoMap[item.producto_id]?.operaciones_requeridas || []).includes(opId));

  const totalUds = prodsDeOp.reduce((s, item) =>
    s + (item.combinaciones || []).reduce((sc, comb) =>
      sc + (comb.tallas_cantidades || []).reduce((st, tc) => st + (Number(tc.cantidad) || 0), 0), 0), 0);

  const cambiarEstado = async (nuevoEstado) => {
    setLoading(true);
    await onCambiarEstado(presupuesto.id, opId, nuevoEstado);
    setLoading(false);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isListo ? "border-green-200" : "border-slate-200"}`}>
      <div className="px-3 py-2.5">
        {/* Fila 1: número + chevron */}
        <div className="flex items-center justify-between gap-2 mb-1" onClick={() => setOpen(o => !o)}>
          <div className="flex items-center gap-2 min-w-0">
            {isListo
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
            <p className="font-bold text-slate-800 text-sm truncate">{presupuesto.numero_presupuesto}</p>
          </div>
          <button className="p-1 text-slate-400 shrink-0">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {/* Fila 2: productos + unidades (truncado) */}
        <p className="text-xs text-slate-500 truncate mb-2">
          {prodsDeOp.map(i => productoMap[i.producto_id]?.nombre || "—").join(", ")}
          {" · "}<span className="font-semibold text-slate-700">{totalUds} uds</span>
        </p>
        {/* Fila 3: estado + botones */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <EstadoBadge estado={estado} />
          {!isListo && (
            <>
              {estado === "pendiente" && (
                <button onClick={() => cambiarEstado("en_proceso")} disabled={loading}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 active:bg-blue-100 disabled:opacity-50">
                  <Play className="w-3 h-3" /> Iniciar
                </button>
              )}
              <button onClick={() => cambiarEstado("listo")} disabled={loading}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 active:bg-green-100 disabled:opacity-50">
                <Check className="w-3 h-3" /> Listo
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-2 space-y-2">
          {prodsDeOp.map((item, i) => {
            const prod = productoMap[item.producto_id];
            const combs = item.combinaciones || [];
            return (
              <div key={i} className="space-y-1">
                <p className="text-xs font-semibold text-slate-600">{prod?.nombre || "—"}</p>
                {combs.map((comb, j) => {
                  const uds = (comb.tallas_cantidades || []).reduce((s, tc) => s + (Number(tc.cantidad) || 0), 0);
                  return (
                    <div key={j} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      {comb.nombre || comb.combinacion_nombre ? (
                        <p className="text-xs font-medium text-slate-700 mb-1">{comb.nombre || comb.combinacion_nombre}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        {(comb.tallas_cantidades || []).map((tc, k) => (
                          <div key={k} className="bg-white border border-slate-200 rounded px-2 py-0.5 text-center min-w-[36px]">
                            <p className="text-xs text-slate-400">{tc.talla}</p>
                            <p className="text-sm font-bold text-slate-800">{tc.cantidad}</p>
                          </div>
                        ))}
                        <div className="flex items-center ml-auto">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                            {uds} uds
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Materiales relevantes */}
          {(presupuesto.materiales_calculados || []).length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Materiales</p>
              {presupuesto.materiales_calculados.map((mat, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded px-2.5 py-1.5 border border-slate-100">
                  <div>
                    <p className="text-xs font-medium text-slate-800">{mat.nombre}</p>
                    {mat.color && mat.color !== "Sin definir" && (
                      <p className="text-xs text-slate-500">{mat.color}</p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-700">
                    {mat.cantidad != null ? Number(mat.cantidad).toFixed(2).replace(/\.?0+$/, "") : "—"}
                    <span className="text-slate-400 font-normal ml-1">{mat.etiqueta}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de tarea de planta (combinación individual) ─────────────────────
function TareaCard({ tarea, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const isListo = tarea.estado === "listo";
  const isEnProceso = tarea.estado === "en_proceso";

  const cambiarEstado = async (nuevoEstado) => {
    setLoading(true);
    try {
      await TareaPlanta.update(tarea.id, { estado: nuevoEstado });
      onUpdate();
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm ${isListo ? "border-green-200" : "border-slate-200"}`}>
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-start gap-2 min-w-0">
            {isListo
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{tarea.producto_nombre}</p>
              {tarea.combinacion_nombre && (
                <p className="text-xs text-slate-500 truncate">{tarea.combinacion_nombre}</p>
              )}
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 shrink-0">
            {tarea.total_unidades} uds
          </span>
        </div>

        {(tarea.tallas_cantidades || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tarea.tallas_cantidades.map((tc, k) => (
              <div key={k} className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center min-w-[32px]">
                <p className="text-[10px] text-slate-400 leading-none">{tc.talla}</p>
                <p className="text-xs font-bold text-slate-800 leading-none mt-0.5">{tc.cantidad}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <EstadoBadge estado={tarea.estado || "pendiente"} />
          {!isListo && (
            <>
              {(tarea.estado === "pendiente" || !tarea.estado) && (
                <button onClick={() => cambiarEstado("en_proceso")} disabled={loading}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 active:bg-blue-100 disabled:opacity-50">
                  <Play className="w-3 h-3" /> Iniciar
                </button>
              )}
              <button onClick={() => cambiarEstado("listo")} disabled={loading}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 active:bg-green-100 disabled:opacity-50">
                <Check className="w-3 h-3" /> Listo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de orden de servicio externa ────────────────────────────────────
function OrdenOpCard({ orden, opId, servicioMap, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const isListo = orden.estado === "listo" || orden.estado === "lista";

  const itemsDeOp = (orden.items || []).filter(i => servicioMap[i.servicio_id]?.operacion_id === opId);

  const cambiarEstado = async (nuevoEstado) => {
    setLoading(true);
    try {
      await OrdenServicio.update(orden.id, { estado: nuevoEstado });
      onUpdate();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isListo ? "border-green-200" : "border-indigo-200"}`}>
      <div className="px-3 py-2.5">
        {/* Fila 1: número + cliente + chevron */}
        <div className="flex items-center justify-between gap-2 mb-1" onClick={() => setOpen(o => !o)}>
          <div className="flex items-center gap-2 min-w-0">
            <Wrench className={`w-4 h-4 shrink-0 ${isListo ? "text-green-500" : "text-indigo-500"}`} />
            <p className="font-bold text-slate-800 text-sm truncate">{orden.numero_orden}</p>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold shrink-0">Ext</span>
          </div>
          <button className="p-1 text-slate-400 shrink-0">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-slate-500 truncate mb-2">{orden.cliente_nombre}</p>
        {/* Fila 2: estado + botones */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <EstadoBadge estado={isListo ? "listo" : (orden.estado || "pendiente")} />
          {!isListo && (
            <>
              {(orden.estado === "confirmada" || orden.estado === "borrador") && (
                <button onClick={() => cambiarEstado("en_proceso")} disabled={loading}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 active:bg-blue-100 disabled:opacity-50">
                  <Play className="w-3 h-3" /> Iniciar
                </button>
              )}
              <button onClick={() => cambiarEstado("lista")} disabled={loading}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 active:bg-green-100 disabled:opacity-50">
                <Check className="w-3 h-3" /> Listo
              </button>
            </>
          )}
        </div>
      </div>
      {open && itemsDeOp.length > 0 && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-2 space-y-1">
          {itemsDeOp.map((item, i) => (
            <div key={i} className="flex justify-between items-center bg-indigo-50 rounded-lg px-3 py-1.5 text-xs">
              <span className="font-medium text-slate-700">{item.nombre}</span>
              <span className="font-bold text-indigo-700">
                {item.pieza_nombre
                  ? `${item.cantidad_piezas} piezas · ${item.pieza_nombre}`
                  : `${Number(item.cantidad).toLocaleString("es-CO")} ${item.unidad}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de tendido ───────────────────────────────────────────────────────
function TendidoCard({ tendido, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isListo = tendido.estado === "listo";
  const isEnProceso = tendido.estado === "en_proceso";
  const totalHojas = (tendido.colores_tendido || []).reduce((s, c) => s + (c.hojas || 0), 0);

  const cambiarEstado = async () => {
    if (isListo) return;
    setLoading(true);
    try {
      await Remision.update(tendido.id, { estado: isEnProceso ? "listo" : "en_proceso" });
      onUpdate();
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isListo ? "border-green-200" : "border-indigo-200"}`}>
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3 min-w-0">
          {isListo ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Layers className="w-5 h-5 text-indigo-500" />}
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">
              {tendido.presupuesto_numero || tendido.id?.slice(-8)}
            </p>
            <p className="text-xs text-slate-500">
              {(tendido.filas || []).length > 0
                ? `${tendido.filas.length} referencias · ${totalHojas} hojas`
                : "Tendido de planta"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EstadoBadge estado={tendido.estado || "pendiente"} />
          {!isListo && (
            <button onClick={e => { e.stopPropagation(); cambiarEstado(); }} disabled={loading}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-50
                ${isEnProceso ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"}`}>
              {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : isEnProceso ? <Check className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isEnProceso ? "Listo" : "Iniciar"}
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {(tendido.filas || []).length > 0 && (
            <div className="space-y-1">
              {tendido.filas.map((f, i) => (
                <div key={i} className="flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{f.producto_nombre}</p>
                    <p className="text-xs text-slate-400">Talla {f.talla}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{f.cant_hoja} × hoja</span>
                </div>
              ))}
            </div>
          )}
          {(tendido.colores_tendido || []).length > 0 && (
            <div className="space-y-1.5">
              {tendido.colores_tendido.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                    style={{ backgroundColor: c.codigo_hex || '#ccc' }} />
                  <span className="flex-1 text-sm font-medium text-slate-800">{c.color_nombre}</span>
                  <span className="text-sm font-bold text-slate-700">{c.hojas} hojas</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers de agrupación ───────────────────────────────────────────────────
function mergeTallas(tareasArr) {
  const map = {};
  tareasArr.forEach(t =>
    (t.tallas_cantidades || []).forEach(tc => {
      map[tc.talla] = (map[tc.talla] || 0) + Number(tc.cantidad);
    })
  );
  return Object.entries(map).map(([talla, cantidad]) => ({ talla, cantidad }));
}

function grupoEstado(tareasArr) {
  if (tareasArr.every(t => t.estado === "listo")) return "listo";
  if (tareasArr.some(t => t.estado === "en_proceso" || t.estado === "listo")) return "en_proceso";
  return "pendiente";
}

function sortTareas(arr, orden) {
  if (orden === "unidades_desc") return [...arr].sort((a, b) => b.total_unidades - a.total_unidades);
  if (orden === "nombre") return [...arr].sort((a, b) => (a.producto_nombre || "").localeCompare(b.producto_nombre || ""));
  return arr;
}

// ─── Tarjeta agrupada por referencia (varias TareaPlanta → una card) ─────────
function TareaGrupoCard({ tareas, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const estado = grupoEstado(tareas);
  const isListo = estado === "listo";
  const isEnProceso = estado === "en_proceso";
  const totalUds = tareas.reduce((s, t) => s + (t.total_unidades || 0), 0);
  const tallasM = mergeTallas(tareas);
  const ref = tareas[0];

  const cambiarEstado = async (nuevoEstado) => {
    setLoading(true);
    try {
      await Promise.all(tareas.map(t => TareaPlanta.update(t.id, { estado: nuevoEstado })));
      onUpdate();
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm ${isListo ? "border-green-200" : "border-slate-200"}`}>
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-start gap-2 min-w-0">
            {isListo
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{ref.producto_nombre}</p>
              {ref.combinacion_nombre && (
                <p className="text-xs text-slate-500 truncate">{ref.combinacion_nombre}</p>
              )}
              <p className="text-[10px] text-slate-400">{tareas.length} presupuesto{tareas.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 shrink-0">
            {totalUds} uds
          </span>
        </div>

        {tallasM.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tallasM.map((tc, k) => (
              <div key={k} className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center min-w-[32px]">
                <p className="text-[10px] text-slate-400 leading-none">{tc.talla}</p>
                <p className="text-xs font-bold text-slate-800 leading-none mt-0.5">{tc.cantidad}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <EstadoBadge estado={estado} />
          {!isListo && (
            <>
              {!isEnProceso && (
                <button onClick={() => cambiarEstado("en_proceso")} disabled={loading}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 active:bg-blue-100 disabled:opacity-50">
                  <Play className="w-3 h-3" /> Iniciar
                </button>
              )}
              <button onClick={() => cambiarEstado("listo")} disabled={loading}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 active:bg-green-100 disabled:opacity-50">
                <Check className="w-3 h-3" /> Listo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de material de lote (una materia prima → una operación) ──────────
function MaterialLoteCard({ mat, loteId, matIdx, loteMats, setLotesAsig }) {
  const [loading, setLoading] = useState(false);
  const isListo = mat.estado === "listo";
  const isEnProceso = mat.estado === "en_proceso";

  const cambiarEstado = async (nuevoEstado) => {
    setLoading(true);
    try {
      const nuevosMats = loteMats.map((m, i) =>
        i === matIdx ? { ...m, estado: nuevoEstado } : m
      );
      await Remision.update(loteId, { materiales_calculados: nuevosMats });
      setLotesAsig(prev => prev.map(l =>
        l.id === loteId ? { ...l, materiales_calculados: nuevosMats } : l
      ));
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm ${isListo ? "border-green-200" : "border-slate-200"}`}>
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {isListo
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{mat.nombre}</p>
              {mat.color && mat.color !== "Sin definir" && (
                <p className="text-xs text-slate-500 truncate">{mat.color}</p>
              )}
            </div>
          </div>
          <span className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 shrink-0 whitespace-nowrap">
            {mat.cantidad == null ? '—' : Number(mat.cantidad).toFixed(2).replace(/\.?0+$/, '')}
            <span className="text-xs font-normal text-slate-500 ml-1">{mat.etiqueta}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <EstadoBadge estado={mat.estado || "pendiente"} />
          {!isListo && (
            <>
              {!isEnProceso && (
                <button onClick={() => cambiarEstado("en_proceso")} disabled={loading}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 active:bg-blue-100 disabled:opacity-50">
                  <Play className="w-3 h-3" /> Iniciar
                </button>
              )}
              <button onClick={() => cambiarEstado("listo")} disabled={loading}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 active:bg-green-100 disabled:opacity-50">
                <Check className="w-3 h-3" /> Listo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Portal principal ─────────────────────────────────────────────────────────
export default function PlantPortal() {
  const [operaciones, setOperaciones] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [tendidos, setTendidos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [estadosMap, setEstadosMap] = useState({});
  const [estadoConfigId, setEstadoConfigId] = useState(null);
  const [traslados, setTraslados] = useState(/** @type {any[]} */ ([]));
  const [productosPOS, setProductosPOS] = useState(/** @type {any[]} */ ([]));
  const [locations, setLocations] = useState(/** @type {any[]} */ ([]));
  const [inventarioPlanta, setInventarioPlanta] = useState(/** @type {any[]} */ ([]));
  const [plantaLocationId, setPlantaLocationId] = useState(/** @type {string|null} */ (null));
  const [receivingTrasladoId, setReceivingTrasladoId] = useState(/** @type {string|null} */ (null));
  const [trasladoForm, setTrasladoForm] = useState({ destino: "", lonas: /** @type {any[]} */ ([]), notas: "" });
  const [savingTraslado, setSavingTraslado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tabId, setTabId] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("activos");
  const [tareas, setTareas] = useState(/** @type {any[]} */ ([]));
  const [lotesAsig, setLotesAsig] = useState(/** @type {any[]} */ ([]));
  const [opConfig, setOpConfig] = useState(/** @type {Record<string,{agrupacion:string,orden:string}>} */ ({}));
  const [opConfigId, setOpConfigId] = useState(/** @type {string|null} */ (null));

  // ── Planillador ───────────────────────────────────────────────────────────────
  const [planilladorAuth, setPlanilladorAuth] = useState(/** @type {any|null} */ (null));
  const [planilladorData, setPlanilladorData] = useState(/** @type {any|null} */ (null));
  const [planilladorTab, setPlanilladorTab] = useState("operaciones");
  const [planilladorLoading, setPlanilladorLoading] = useState(false);
  const [pinForm, setPinForm] = useState({ employee_id: "", pin: "" });
  // WA broadcast desde planillador
  const [waModal, setWaModal] = useState(false);
  const [waRecs, setWaRecs] = useState([]);
  const [waBcId, setWaBcId] = useState("");
  const [waEnviando, setWaEnviando] = useState(false);
  const [waOk, setWaOk] = useState(null);
  const [pinError, setPinError] = useState("");

  const handleWaBroadcast = async () => {
    if (!waBcId) return;
    const rec = waRecs.find(r => r.id === waBcId);
    if (!confirm(`¿Enviar a TODOS los operarios activos con celular?\n\n"${rec.texto.slice(0, 80)}..."`)) return;
    setWaEnviando(true);
    try {
      const res = await fetch("/api/portal/functions/enviarRecomendacionTodos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: rec.texto, categoria: rec.categoria, header: rec.header, footer: rec.footer }),
      });
      const d = await res.json();
      if (!res.ok) alert(d.error);
      else { setWaOk(d); setWaBcId(""); setTimeout(() => { setWaOk(null); setWaModal(false); }, 3000); }
    } catch (e) { alert(e.message); }
    setWaEnviando(false);
  };

  const handlePinLogin = async (pin) => {
    setPinError("");
    try {
      const res = await fetch("/api/portal-pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) { const d = await res.json(); setPinError(d.error || "PIN incorrecto"); setPinForm({ employee_id: "", pin: "" }); return; }
      setPlanilladorAuth({ ok: true });
      setPinForm({ employee_id: "", pin: "" });
      loadPlanilladorData();
      portalClient.entities.RecomendacionCalidad.filter({ activa: true }).then(d => setWaRecs(d || [])).catch(() => {});
    } catch { setPinError("Error de conexión"); }
  };

  const loadPlanilladorData = async () => {
    setPlanilladorLoading(true);
    try {
      const [employees, products, dispatches, deliveries, inventory, devoluciones, muestras, configs] = await Promise.all([
        Employee.list(),
        Producto.list(),
        Dispatch.list(),
        Delivery.list(),
        Inventory.list(),
        Devolucion.list(),
        Muestra.list(),
        AppConfig.filter({ key: "pending_row_order" }),
      ]);
      const activeEmps = (employees || []).filter(e => e.is_active);
      let routeOrder = [];
      try { routeOrder = JSON.parse((configs || [])[0]?.value || "[]"); } catch {}
      const orderedEmployees = [
        ...routeOrder.map(id => activeEmps.find(e => e.employee_id === id)).filter(Boolean),
        ...activeEmps.filter(e => !routeOrder.includes(e.employee_id)),
      ];
      setPlanilladorData({
        employees: orderedEmployees,
        products: (products || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })),
        dispatches: dispatches || [],
        deliveries: deliveries || [],
        inventory: inventory || [],
        devoluciones: devoluciones || [],
        muestras: muestras || [],
      });
    } catch (e) { console.error("Planillador data error:", e); }
    setPlanilladorLoading(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [opsData, presData, prodData, tendData, cfgData, tareasData, opCfgData, lotesAsigData] = await Promise.all([
        Operacion.list("orden_procesamiento"),
        Presupuesto.filter({ estado: "aprobado" }),
        Producto.list(),
        Remision.filter({ tipo_remision: "tendido" }),
        AppConfig.filter({ key: "proceso_planta_estados" }),
        TareaPlanta.list(),
        AppConfig.filter({ key: "portal_planta_op_config" }),
        Remision.filter({ tipo_remision: "asignacion_despacho" }),
      ]);
      const activas = (opsData || []).filter(o => o.activa !== false);
      setOperaciones(activas);
      setPresupuestos(presData || []);
      setProductos(prodData || []);
      setTendidos(tendData || []);
      setTareas((tareasData || []).filter(t => t.estado !== "cancelado"));
      setLotesAsig(lotesAsigData || []);
      setTabId(prev => prev ?? (activas[0]?.id || "tendidos"));

      const cfg = (cfgData || [])[0] || null;
      setEstadoConfigId(cfg?.id || null);
      try { setEstadosMap(cfg ? JSON.parse(cfg.value) : {}); } catch { setEstadosMap({}); }

      const opCfg = (opCfgData || [])[0] || null;
      setOpConfigId(opCfg?.id || null);
      try { setOpConfig(opCfg ? JSON.parse(opCfg.value) : {}); } catch { setOpConfig({}); }
    } catch (e) {
      console.error("Error cargando datos principales:", e);
    }

    // AppConfig de planta — se carga siempre por separado
    let plId = null;
    try {
      const plantaCfg = await AppConfig.filter({ key: "planta_location_id" });
      plId = (plantaCfg || [])[0]?.value || null;
      setPlantaLocationId(plId);
    } catch (e) {
      console.warn("AppConfig planta_location_id no disponible:", e.message);
    }

    // Localizaciones y productos del POS — críticos para traslados
    try {
      const [locsData, prodsData, trasData] = await Promise.all([
        LocationPub.list(),
        ProductoPOS.list(),
        Traslado.list("-created_date"),
      ]);
      setLocations(locsData || []);
      setProductosPOS(prodsData || []);
      setTraslados(trasData || []);
    } catch (e) {
      console.warn("Localizaciones/Productos/Traslados no disponibles:", e.message);
    }

    // Servicios y órdenes — opcionales
    try {
      const [svcData, ordData] = await Promise.all([
        Servicio.list(),
        OrdenServicio.list("-fecha_orden"),
      ]);
      setServicios((svcData || []).filter(s => s.activo !== false));
      setOrdenes((ordData || []).filter(o => !["pagada", "cancelada"].includes(o.estado)));
    } catch (e) {
      console.warn("Servicios/Ordenes no disponibles:", e.message);
    }

    // Inventario de la planta para filtrar productos disponibles
    if (plId) {
      try {
        const invData = await Inventory.filter({ location_id: plId });
        setInventarioPlanta(invData || []);
      } catch (e) {
        console.warn("Inventario planta no disponible:", e.message);
      }
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Mapa producto_id → producto
  const productoMap = useMemo(() =>
    Object.fromEntries(productos.map(p => [p.id, p])), [productos]);

  // Mapa servicio_id → servicio
  const servicioMap = useMemo(() =>
    Object.fromEntries(servicios.map(s => [s.id, s])), [servicios]);

  // Presupuesto IDs que tienen al menos una TareaPlanta
  const presIdsConTareas = useMemo(() =>
    new Set(tareas.map(t => t.presupuesto_id).filter(Boolean)),
  [tareas]);

  // Para cada operación: Set de presupuesto_ids con materiales asignados en lotes
  const presIdsConMateriales = useMemo(() => {
    const map = {};
    for (const lote of lotesAsig) {
      for (const mat of (lote.materiales_calculados || [])) {
        if (mat.operacion_id) {
          if (!map[mat.operacion_id]) map[mat.operacion_id] = new Set();
          map[mat.operacion_id].add(lote.presupuesto_id);
        }
      }
    }
    return map;
  }, [lotesAsig]);

  // Presupuestos que tienen al menos un producto con esta operación requerida
  // (solo usados como fallback para presupuestos sin lote-materiales ni TareaPlanta)
  const presupuestosDeOp = (opId) => {
    const conMat = presIdsConMateriales[opId] || new Set();
    return presupuestos.filter(pres =>
      !conMat.has(pres.id) &&
      !presIdsConTareas.has(pres.id) &&
      (pres.productos || []).some(item =>
        (productoMap[item.producto_id]?.operaciones_requeridas || []).includes(opId)
      )
    );
  };

  const ordenesDeOp = (opId) =>
    ordenes.filter(ord =>
      (ord.items || []).some(item => servicioMap[item.servicio_id]?.operacion_id === opId)
    );

  const getEstadoPres = (pres, opId) => estadosMap[`${pres.id}_${opId}`] || "pendiente";

  const cambiarEstadoPres = async (presId, opId, nuevoEstado) => {
    const newMap = { ...estadosMap, [`${presId}_${opId}`]: nuevoEstado };
    try {
      if (estadoConfigId) {
        await AppConfig.update(estadoConfigId, { value: JSON.stringify(newMap) });
      } else {
        const created = await AppConfig.create({ key: "proceso_planta_estados", value: JSON.stringify(newMap) });
        setEstadoConfigId(created.id);
      }
      setEstadosMap(newMap);
    } catch (e) {
      alert("Error al guardar estado: " + e.message);
    }
  };

  const getOpCfg = (opId) => opConfig[opId] || { agrupacion: "presupuesto", orden: "fecha" };

  const filtrar = (estado) => {
    if (filtroEstado === "activos") return estado !== "listo";
    if (filtroEstado === "listos") return estado === "listo";
    return true;
  };

  const countPendOp = (opId) => {
    // Materiales de lotes asignados a esta operación
    const conMat = presIdsConMateriales[opId] || new Set();
    let matCount = 0;
    for (const lote of lotesAsig) {
      for (const mat of (lote.materiales_calculados || [])) {
        if (mat.operacion_id === opId && (mat.estado || "pendiente") !== "listo") matCount++;
      }
    }
    // TareaPlanta para presupuestos no cubiertos por materiales de lote
    const tareasOp = tareas.filter(t => t.operacion_id === opId && !conMat.has(t.presupuesto_id));
    const pendTareas = tareasOp.length > 0
      ? tareasOp.filter(t => (t.estado || "pendiente") !== "listo").length
      : presupuestosDeOp(opId).filter(p => getEstadoPres(p, opId) !== "listo").length;
    const o = ordenesDeOp(opId).filter(o => o.estado !== "listo" && o.estado !== "lista").length;
    return matCount + pendTareas + o;
  };

  const pendTendidos = tendidos.filter(t => t.estado !== "listo").length;

  // Traslados pendientes de recibir en el taller
  const trasladosPendientesRecibir = traslados.filter(t =>
    t.estado === "pendiente" && (!plantaLocationId || t.destino_location_id === plantaLocationId)
  );
  const trasladosPendientesEnviar = traslados.filter(t =>
    t.estado === "pendiente" && (!plantaLocationId || t.origen_location_id === plantaLocationId)
  );

  const nextNumeroTraslado = () => {
    const nums = traslados.map(t => parseInt((t.numero_traslado || "").replace(/\D/g, "")) || 0);
    return "TRA-" + String(Math.max(0, ...nums) + 1).padStart(4, "0");
  };

  const handleCrearTraslado = async (e) => {
    e.preventDefault();
    if (!trasladoForm.destino || trasladoForm.lonas.length === 0) return;
    if (trasladoForm.lonas.some(l => l.items.length === 0)) { alert("Todas las lonas deben tener al menos un producto."); return; }
    setSavingTraslado(true);
    try {
      const origen = locations.find(l => l.id === plantaLocationId);
      const destino = locations.find(l => l.id === trasladoForm.destino);
      // Consolidar items desde lonas
      const itemsMap = {};
      for (const lona of trasladoForm.lonas) {
        for (const i of lona.items) {
          if (!i.product_id || !i.cantidad) continue;
          if (!itemsMap[i.product_id]) itemsMap[i.product_id] = { product_id: i.product_id, nombre: i.nombre, cantidad_enviada: 0 };
          itemsMap[i.product_id].cantidad_enviada += Number(i.cantidad);
        }
      }
      await Traslado.create({
        numero_traslado: nextNumeroTraslado(),
        origen_location_id: plantaLocationId || "taller",
        origen_nombre: origen?.name || "Taller",
        destino_location_id: trasladoForm.destino,
        destino_nombre: destino?.name || "",
        items: Object.values(itemsMap),
        lonas: trasladoForm.lonas.map((l, idx) => ({
          numero: idx + 1,
          items: l.items.filter(i => i.product_id && i.cantidad).map(i => ({ product_id: i.product_id, nombre: i.nombre, cantidad: Number(i.cantidad) })),
          total: l.items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0),
        })),
        estado: "pendiente",
        notas: trasladoForm.notas,
      });
      setTrasladoForm({ destino: "", lonas: [], notas: "" });
      await loadData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : String(err)));
    }
    setSavingTraslado(false);
  };

  const tabs = [
    { id: "tendidos", label: "Tendidos", Icon: Layers, count: pendTendidos },
    ...operaciones.map(op => ({ id: op.id, label: op.nombre, Icon: Factory, count: countPendOp(op.id) })),
    { id: "traslados", label: "Traslados", Icon: ArrowRightLeft, count: trasladosPendientesRecibir.length },
    { id: "planillador", label: "Planillador", Icon: planilladorAuth ? Unlock : Lock, count: 0 },
  ];

  const tendidosFiltrados = tendidos.filter(t => filtrar(t.estado || "pendiente"));

  const esTabOperacion = tabId && tabId !== "tendidos" && tabId !== "traslados" && tabId !== "planillador";

  // Materiales de lotes asignados a esta operación
  const presConMatTab = esTabOperacion ? (presIdsConMateriales[tabId] || new Set()) : new Set();
  const materialesDeOp = esTabOperacion
    ? lotesAsig.flatMap(lote => {
        const presNum = presupuestos.find(p => p.id === lote.presupuesto_id)?.numero_presupuesto || "—";
        return (lote.materiales_calculados || [])
          .map((mat, i) => ({ ...mat, _loteId: lote.id, _matIdx: i, _presNum: presNum, _loteMats: lote.materiales_calculados }))
          .filter(mat => mat.operacion_id === tabId && filtrar(mat.estado || "pendiente"));
      })
    : [];
  const matsPorPres = materialesDeOp.reduce((map, m) => {
    if (!map[m._presNum]) map[m._presNum] = [];
    map[m._presNum].push(m);
    return map;
  }, {});

  // TareaPlanta filtradas para la pestaña actual (solo para presupuestos sin materiales de lote)
  const tareasFiltradas = esTabOperacion
    ? tareas.filter(t => t.operacion_id === tabId && !presConMatTab.has(t.presupuesto_id) && filtrar(t.estado || "pendiente"))
    : [];

  // Aplicar orden y agrupación según config
  const cfg = esTabOperacion ? getOpCfg(tabId) : { agrupacion: "presupuesto", orden: "fecha" };
  const tareasSorted = sortTareas(tareasFiltradas, cfg.orden);

  // Agrupación "referencia": producto + combinación fusionados
  const tareasPorRef = cfg.agrupacion === "referencia"
    ? tareasSorted.reduce((map, t) => {
        const key = `${t.producto_nombre}||${t.combinacion_nombre || ""}`;
        if (!map[key]) map[key] = [];
        map[key].push(t);
        return map;
      }, {})
    : {};

  // Agrupación "presupuesto": por número de presupuesto
  const tareasPorPres = cfg.agrupacion === "presupuesto"
    ? tareasSorted.reduce((map, t) => {
        const key = t.presupuesto_numero || t.presupuesto_id || "—";
        if (!map[key]) map[key] = [];
        map[key].push(t);
        return map;
      }, {})
    : {};

  // Fallback: presupuestos sin lote-materiales ni TareaPlanta
  const presFiltrados = (tabId && esTabOperacion)
    ? presupuestosDeOp(tabId).filter(p => filtrar(getEstadoPres(p, tabId)))
    : [];

  const ordFiltradas = tabId && tabId !== "tendidos"
    ? ordenesDeOp(tabId).filter(o => filtrar(o.estado === "lista" ? "listo" : (o.estado || "pendiente"))) : [];

  const hayContenido = materialesDeOp.length > 0 || tareasFiltradas.length > 0 || presFiltrados.length > 0 || ordFiltradas.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-safe w-full overflow-x-hidden">
      <div className="bg-white border-b border-slate-200 px-3 py-2 sticky top-0 z-10 shadow-sm w-full">
        {/* Fila 1: título + refresh */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <Factory className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Portal de Planta</span>
          </div>
          <button onClick={loadData} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tabs en grid 2 columnas */}
        <div className="grid grid-cols-2 gap-1">
          {tabs.map(({ id, label, Icon, count }) => (
            <button key={id} onClick={() => setTabId(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all w-full
                ${tabId === id ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-600"}`}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{label}</span>
              {count > 0 && (
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0
                  ${tabId === id ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Fila 3: filtro — solo para tabs de operaciones */}
        {esTabOperacion && (
          <div className="flex gap-1 mt-1.5">
            {[{ id: "activos", label: "Activos" }, { id: "listos", label: "Listos" }, { id: "todos", label: "Todos" }].map(f => (
              <button key={f.id} onClick={() => setFiltroEstado(f.id)}
                className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium transition-all
                  ${filtroEstado === f.id ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-500 border-slate-200"}`}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 space-y-3 w-full max-w-2xl mx-auto overflow-x-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>

        ) : tabId === "tendidos" ? (
          tendidosFiltrados.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay tendidos {filtroEstado === "activos" ? "activos" : filtroEstado}</p>
            </div>
          ) : tendidosFiltrados.map(t => (
            <TendidoCard key={t.id} tendido={t} onUpdate={loadData} />
          ))

        ) : tabId === "traslados" ? (
          receivingTrasladoId ? (
            <TransferReceive
              traslado={traslados.find(t => t.id === receivingTrasladoId)}
              productos={productosPOS}
              locations={locations}
              onDone={() => { setReceivingTrasladoId(null); loadData(); }}
              onCancel={() => setReceivingTrasladoId(null)}
            />
          ) : (
            <div className="space-y-4">
              {/* Pendientes de recibir */}
              {trasladosPendientesRecibir.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">Por recibir</p>
                  {trasladosPendientesRecibir.map(t => (
                    <div key={t.id} className="bg-white rounded-xl border border-amber-200 p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{t.numero_traslado}</p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-red-500" />
                            <span>{t.origen_nombre}</span>
                            <span>·</span>
                            <span>{(t.items||[]).reduce((s,i) => s+(Number(i.cantidad_enviada)||0),0)} uds</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(t.items||[]).map((i,idx) => (
                              <span key={idx} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {i.nombre||i.product_id} · {i.cantidad_enviada}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => setReceivingTrasladoId(t.id)}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 shrink-0">
                          <Package className="w-3.5 h-3.5" /> Recibir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Crear nuevo traslado */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-blue-500" /> Enviar traslado
                </p>
                {!plantaLocationId && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                    Configura el AppConfig "planta_location_id" con el ID de esta sucursal para habilitar envíos.
                  </p>
                )}
                <form onSubmit={handleCrearTraslado} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Destino</label>
                    <select value={trasladoForm.destino}
                      onChange={e => setTrasladoForm(f => ({ ...f, destino: e.target.value }))}
                      className="w-full h-8 px-2 text-sm border border-slate-200 rounded-lg">
                      <option value="">Seleccionar sucursal...</option>
                      {locations.filter(l => l.id !== plantaLocationId).map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-600">Lonas *</label>
                      <button type="button"
                        onClick={() => setTrasladoForm(f => ({ ...f, lonas: [...f.lonas, { id: Date.now(), items: [] }] }))}
                        className="text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-0.5">
                        <Plus className="w-3 h-3" /> Lona
                      </button>
                    </div>
                    {trasladoForm.lonas.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-3 border border-dashed rounded-lg">Agrega al menos una lona</p>
                    )}
                    <div className="space-y-2">
                      {trasladoForm.lonas.map((lona, lonaIdx) => (
                        <div key={lona.id} className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-700">
                              Lona {lonaIdx + 1}
                              {lona.items.length > 0 && <span className="ml-1 font-normal text-indigo-500">· {lona.items.reduce((s,i)=>s+(Number(i.cantidad)||0),0)} prendas</span>}
                            </span>
                            <div className="flex items-center gap-2">
                              <button type="button"
                                onClick={() => setTrasladoForm(f => ({ ...f, lonas: f.lonas.map(l => l.id === lona.id ? { ...l, items: [...l.items, { product_id: "", nombre: "", cantidad: "" }] } : l) }))}
                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                                <Plus className="w-3 h-3" /> producto
                              </button>
                              <button type="button"
                                onClick={() => setTrasladoForm(f => ({ ...f, lonas: f.lonas.filter(l => l.id !== lona.id) }))}
                                className="p-0.5 text-red-400 hover:text-red-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {lona.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex gap-1.5 items-center">
                              <select value={item.product_id}
                                onChange={e => {
                                  const prod = productosPOS.find(p => p.sku === e.target.value || p.id === e.target.value);
                                  setTrasladoForm(f => ({ ...f, lonas: f.lonas.map(l => l.id !== lona.id ? l : { ...l, items: l.items.map((it, i) => i !== itemIdx ? it : { ...it, product_id: e.target.value, nombre: prod?.name || "" }) }) }));
                                }}
                                className="flex-1 h-9 px-2 text-sm border border-indigo-200 rounded bg-white">
                                <option value="">Producto...</option>
                                {(inventarioPlanta.length > 0
                                  ? inventarioPlanta.filter(i => Number(i.current_stock || 0) > 0).map(i => {
                                      const prod = productosPOS.find(p => p.sku === i.product_id || p.id === i.product_id);
                                      return prod ? { ...prod, _stock: Number(i.current_stock || 0) } : null;
                                    }).filter(Boolean)
                                  : productosPOS
                                ).map(p => (
                                  <option key={p.id} value={p.sku || p.id}>
                                    {p.name}{p._stock !== undefined ? ` (${p._stock})` : ""}
                                  </option>
                                ))}
                              </select>
                              <input type="number" min="1" value={item.cantidad}
                                onChange={e => setTrasladoForm(f => ({ ...f, lonas: f.lonas.map(l => l.id !== lona.id ? l : { ...l, items: l.items.map((it, i) => i !== itemIdx ? it : { ...it, cantidad: e.target.value }) }) }))}
                                className="w-16 h-9 px-2 text-sm border border-indigo-200 rounded bg-white" placeholder="Uds" />
                              <button type="button"
                                onClick={() => setTrasladoForm(f => ({ ...f, lonas: f.lonas.map(l => l.id !== lona.id ? l : { ...l, items: l.items.filter((_,i) => i !== itemIdx) }) }))}
                                className="p-2 text-red-400 hover:text-red-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={savingTraslado || !trasladoForm.destino || trasladoForm.lonas.length === 0}
                    className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                    {savingTraslado ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          )

        ) : tabId === "planillador" ? (
          !planilladorAuth ? (
            // ── PIN Gate ──────────────────────────────────────────────────────
            <div className="max-w-sm mx-auto mt-8 px-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-7 h-7 text-violet-600" />
                  </div>
                  <h2 className="font-bold text-slate-800 text-lg">Portal Planillador</h2>
                  <p className="text-sm text-slate-500 mt-1">Ingresa tu PIN</p>
                </div>

                {/* Puntos del PIN */}
                <div className="flex justify-center gap-3 py-2">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${pinForm.pin.length > i ? "bg-violet-600 border-violet-600" : "border-slate-300"}`} />
                  ))}
                </div>

                {pinError && <p className="text-xs text-red-600 text-center">{pinError}</p>}

                {/* Teclado numérico */}
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
                    <button key={i} type="button"
                      disabled={k === ""}
                      onClick={() => {
                        if (k === "⌫") {
                          const next = pinForm.pin.slice(0, -1);
                          setPinForm(f => ({ ...f, pin: next }));
                          setPinError("");
                        } else if (pinForm.pin.length < 4) {
                          const next = pinForm.pin + String(k);
                          setPinForm(f => ({ ...f, pin: next }));
                          if (next.length === 4) handlePinLogin(next);
                        }
                      }}
                      className={`h-14 rounded-xl text-lg font-semibold transition-all
                        ${k === "" ? "invisible" : k === "⌫" ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-slate-50 text-slate-800 hover:bg-violet-50 hover:text-violet-700 border border-slate-200"}`}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // ── Planillador autenticado ────────────────────────────────────────
            <div className="space-y-3">
              {/* Header planillador */}
              <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Unlock className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-semibold text-violet-800">Planillador activo</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setWaModal(true); setWaOk(null); setWaBcId(""); }}
                    className="flex items-center gap-1 text-xs text-emerald-600 active:text-emerald-800 shrink-0">
                    <MessageCircle className="w-3.5 h-3.5" /> Mensajes
                  </button>
                  <button onClick={() => { setPlanilladorAuth(null); setPlanilladorData(null); setPlanilladorTab("operaciones"); }}
                    className="flex items-center gap-1 text-xs text-violet-600 active:text-violet-800 shrink-0">
                    <LogOut className="w-3.5 h-3.5" /> Salir
                  </button>
                </div>
              </div>

              {/* Sub-tabs planillador — 2×3 */}
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "operaciones",  label: "Operaciones",   Icon: Truck,          active: "bg-blue-600 text-white shadow-sm",   inactive: "bg-blue-50 text-blue-700 border border-blue-200" },
                  { id: "traslados",    label: "Traslados",     Icon: ArrowRightLeft,  active: "bg-amber-600 text-white shadow-sm",  inactive: "bg-amber-50 text-amber-700 border border-amber-200" },
                  { id: "devoluciones", label: "Devoluciones",  Icon: RotateCcw,       active: "bg-orange-600 text-white shadow-sm", inactive: "bg-orange-50 text-orange-700 border border-orange-200" },
                  { id: "conteo",       label: "Conteo Físico", Icon: PackageCheck,    active: "bg-purple-600 text-white shadow-sm", inactive: "bg-purple-50 text-purple-700 border border-purple-200" },
                  { id: "muestras",     label: "Muestras",      Icon: FlaskConical,    active: "bg-violet-600 text-white shadow-sm", inactive: "bg-violet-50 text-violet-700 border border-violet-200" },
                ].map(({ id, label, Icon, active, inactive }) => (
                  <button key={id} onClick={() => setPlanilladorTab(id)}
                    className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm font-semibold transition-all
                      ${planilladorTab === id ? active : inactive}`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Contenido planillador */}
              {planilladorLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                </div>
              ) : !planilladorData ? (
                <div className="text-center py-16 text-slate-400">Sin datos</div>
              ) : planilladorTab === "operaciones" ? (
                <>
                  <RouteChecklist employees={planilladorData.employees} dispatches={planilladorData.dispatches} deliveries={planilladorData.deliveries} />
                  <RouteOperario {...planilladorData} onSaved={loadPlanilladorData} />
                  <RouteRegistrosHoy {...planilladorData} onSaved={loadPlanilladorData} />
                </>
              ) : planilladorTab === "traslados" ? (
                <RouteTraslados {...planilladorData} onSaved={loadPlanilladorData} />
              ) : planilladorTab === "devoluciones" ? (
                <RouteDevoluciones {...planilladorData} onSaved={loadPlanilladorData} />
              ) : planilladorTab === "muestras" ? (
                <RouteMuestras {...planilladorData} onSaved={loadPlanilladorData} />
              ) : (
                <RouteConteoFisico {...planilladorData} onSaved={loadPlanilladorData} />
              )}

              {/* Modal WA broadcast */}
              {waModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-emerald-500" /> Mensaje a todos
                      </h3>
                      <button onClick={() => setWaModal(false)} className="text-slate-400 active:text-slate-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    {waOk ? (
                      <div className="text-sm text-green-700 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
                        ✅ Enviado a {waOk.enviados} operario{waOk.enviados !== 1 ? "s" : ""}.
                        {waOk.errores?.length > 0 && <p className="text-amber-700 mt-1">⚠️ {waOk.errores.join(", ")}</p>}
                      </div>
                    ) : (
                      <>
                        <select value={waBcId} onChange={e => setWaBcId(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm">
                          <option value="">— Seleccionar mensaje —</option>
                          {waRecs.map(r => (
                            <option key={r.id} value={r.id}>[{r.categoria}] {r.texto.slice(0, 55)}{r.texto.length > 55 ? "…" : ""}</option>
                          ))}
                        </select>
                        {waRecs.length === 0 && (
                          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            Sin mensajes activos. Agrégalos en Configuración → WhatsApp.
                          </p>
                        )}
                        <button onClick={handleWaBroadcast} disabled={!waBcId || waEnviando}
                          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold bg-emerald-600 text-white rounded-xl disabled:opacity-50 active:bg-emerald-700">
                          {waEnviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                          {waEnviando ? "Enviando..." : "Enviar a todos los operarios"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )

        ) : !hayContenido ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay trabajo {filtroEstado === "activos" ? "activo" : filtroEstado}</p>
            {filtroEstado === "activos" && (
              <p className="text-xs mt-2 px-4">
                Verifica que los productos tengan esta operación marcada en su configuración
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Materiales de lotes (sistema nuevo) */}
            {materialesDeOp.length > 0 && (
              <div className="space-y-4">
                {Object.entries(matsPorPres).map(([presNum, mats]) => (
                  <div key={presNum} className="space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">{presNum}</p>
                    {mats.map(mat => (
                      <MaterialLoteCard
                        key={`${mat._loteId}_${mat._matIdx}`}
                        mat={mat}
                        loteId={mat._loteId}
                        matIdx={mat._matIdx}
                        loteMats={mat._loteMats}
                        setLotesAsig={setLotesAsig}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
            {/* TareaPlanta cards (para presupuestos sin materiales de lote asignados) */}
            {tareasFiltradas.length > 0 && (
              <div className="space-y-4">
                {materialesDeOp.length > 0 && (
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">Otros presupuestos</p>
                )}
                {cfg.agrupacion === "referencia" && Object.entries(tareasPorRef).map(([key, grupo]) => (
                  <TareaGrupoCard key={key} tareas={grupo} onUpdate={loadData} />
                ))}
                {cfg.agrupacion === "presupuesto" && Object.entries(tareasPorPres).map(([presNumero, grupo]) => (
                  <div key={presNumero} className="space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">{presNumero}</p>
                    {grupo.map(t => (
                      <TareaCard key={t.id} tarea={t} onUpdate={loadData} />
                    ))}
                  </div>
                ))}
                {cfg.agrupacion === "individual" && tareasSorted.map(t => (
                  <TareaCard key={t.id} tarea={t} onUpdate={loadData} />
                ))}
              </div>
            )}
            {/* Legacy: presupuestos sin lote-materiales ni TareaPlanta */}
            {presFiltrados.length > 0 && (
              <div className="space-y-2">
                {presFiltrados.map(pres => (
                  <PresupuestoOpCard
                    key={pres.id}
                    presupuesto={pres}
                    opId={tabId}
                    estado={getEstadoPres(pres, tabId)}
                    productoMap={productoMap}
                    onCambiarEstado={cambiarEstadoPres}
                  />
                ))}
              </div>
            )}
            {ordFiltradas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">Servicios externos</p>
                {ordFiltradas.map(ord => (
                  <OrdenOpCard key={ord.id} orden={ord} opId={tabId} servicioMap={servicioMap} onUpdate={loadData} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
