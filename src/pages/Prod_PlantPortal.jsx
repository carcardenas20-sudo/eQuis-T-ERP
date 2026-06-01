import React, { useState, useEffect, useMemo } from "react";
import { Remision, Operacion, Presupuesto, Producto, Servicio, OrdenServicio } from "@/api/publicEntities";
import { Factory, Wrench, RefreshCw, ChevronDown, ChevronUp, CheckCircle2,
  Play, Check, Layers, Package } from "lucide-react";

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
function PresupuestoOpCard({ presupuesto, opId, productoMap, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const estado = (presupuesto.procesos_planta_estado || {})[opId] || "pendiente";
  const isListo = estado === "listo";

  // Productos de este presupuesto que requieren esta operación
  const prodsDeOp = (presupuesto.productos || [])
    .filter(item => (productoMap[item.producto_id]?.operaciones_requeridas || []).includes(opId));

  const totalUds = prodsDeOp.reduce((s, item) =>
    s + (item.combinaciones || []).reduce((sc, comb) =>
      sc + (comb.tallas_cantidades || []).reduce((st, tc) => st + (Number(tc.cantidad) || 0), 0), 0), 0);

  const cambiarEstado = async (nuevoEstado) => {
    setLoading(true);
    try {
      await Presupuesto.update(presupuesto.id, {
        procesos_planta_estado: { ...(presupuesto.procesos_planta_estado || {}), [opId]: nuevoEstado }
      });
      onUpdate();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isListo ? "border-green-200" : "border-slate-200"}`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => setOpen(o => !o)}>
            {isListo
              ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              : <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />}
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-sm">{presupuesto.numero_presupuesto}</p>
              <p className="text-xs text-slate-500">
                {prodsDeOp.map(i => productoMap[i.producto_id]?.nombre || "—").join(", ")}
                {" · "}{totalUds} uds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <EstadoBadge estado={estado} />
            {!isListo && (
              <>
                {estado === "pendiente" && (
                  <button onClick={() => cambiarEstado("en_proceso")} disabled={loading}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                    <Play className="w-3 h-3" /> Iniciar
                  </button>
                )}
                <button onClick={() => cambiarEstado("listo")} disabled={loading}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 disabled:opacity-50">
                  <Check className="w-3 h-3" /> Listo
                </button>
              </>
            )}
            <button onClick={() => setOpen(o => !o)} className="p-1 text-slate-400">
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
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
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => setOpen(o => !o)}>
            <Wrench className={`w-5 h-5 shrink-0 ${isListo ? "text-green-500" : "text-indigo-500"}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-slate-800 text-sm">{orden.numero_orden}</p>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">Externo</span>
              </div>
              <p className="text-xs text-slate-500 truncate">{orden.cliente_nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <EstadoBadge estado={isListo ? "listo" : (orden.estado || "pendiente")} />
            {!isListo && (
              <>
                {(orden.estado === "confirmada" || orden.estado === "borrador") && (
                  <button onClick={() => cambiarEstado("en_proceso")} disabled={loading}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                    <Play className="w-3 h-3" /> Iniciar
                  </button>
                )}
                <button onClick={() => cambiarEstado("lista")} disabled={loading}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 disabled:opacity-50">
                  <Check className="w-3 h-3" /> Listo
                </button>
              </>
            )}
            <button onClick={() => setOpen(o => !o)} className="p-1 text-slate-400">
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
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

// ─── Portal principal ─────────────────────────────────────────────────────────
export default function PlantPortal() {
  const [operaciones, setOperaciones] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [tendidos, setTendidos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabId, setTabId] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("activos");

  const loadData = async () => {
    setLoading(true);
    try {
      const [opsData, presData, prodData, tendData] = await Promise.all([
        Operacion.list("orden_procesamiento"),
        Presupuesto.filter({ estado: "aprobado" }),
        Producto.list(),
        Remision.filter({ tipo_remision: "tendido" }),
      ]);
      const activas = (opsData || []).filter(o => o.activa !== false);
      setOperaciones(activas);
      setPresupuestos(presData || []);
      setProductos(prodData || []);
      setTendidos(tendData || []);
      setTabId(prev => prev ?? (activas[0]?.id || "tendidos"));
    } catch (e) {
      console.error("Error cargando datos principales:", e);
    }

    // Servicios y órdenes son opcionales — no rompen el portal si fallan
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

    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Mapa producto_id → producto
  const productoMap = useMemo(() =>
    Object.fromEntries(productos.map(p => [p.id, p])), [productos]);

  // Mapa servicio_id → servicio
  const servicioMap = useMemo(() =>
    Object.fromEntries(servicios.map(s => [s.id, s])), [servicios]);

  // Presupuestos que tienen al menos un producto con esta operación requerida
  const presupuestosDeOp = (opId) =>
    presupuestos.filter(pres =>
      (pres.productos || []).some(item =>
        (productoMap[item.producto_id]?.operaciones_requeridas || []).includes(opId)
      )
    );

  const ordenesDeOp = (opId) =>
    ordenes.filter(ord =>
      (ord.items || []).some(item => servicioMap[item.servicio_id]?.operacion_id === opId)
    );

  const getEstadoPres = (pres, opId) => (pres.procesos_planta_estado || {})[opId] || "pendiente";

  const filtrar = (estado) => {
    if (filtroEstado === "activos") return estado !== "listo";
    if (filtroEstado === "listos") return estado === "listo";
    return true;
  };

  const countPendOp = (opId) => {
    const p = presupuestosDeOp(opId).filter(p => getEstadoPres(p, opId) !== "listo").length;
    const o = ordenesDeOp(opId).filter(o => o.estado !== "listo" && o.estado !== "lista").length;
    return p + o;
  };

  const pendTendidos = tendidos.filter(t => t.estado !== "listo").length;

  const tabs = [
    { id: "tendidos", label: "Tendidos", Icon: Layers, count: pendTendidos },
    ...operaciones.map(op => ({ id: op.id, label: op.nombre, Icon: Factory, count: countPendOp(op.id) })),
  ];

  const tendidosFiltrados = tendidos.filter(t => filtrar(t.estado || "pendiente"));

  const presFiltrados = tabId && tabId !== "tendidos"
    ? presupuestosDeOp(tabId).filter(p => filtrar(getEstadoPres(p, tabId))) : [];

  const ordFiltradas = tabId && tabId !== "tendidos"
    ? ordenesDeOp(tabId).filter(o => filtrar(o.estado === "lista" ? "listo" : (o.estado || "pendiente"))) : [];

  const hayContenido = presFiltrados.length > 0 || ordFiltradas.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Factory className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base leading-tight">Portal de Planta</h1>
              <p className="text-xs text-slate-500">Procesos · eQuis-T</p>
            </div>
          </div>
          <button onClick={loadData}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {tabs.map(({ id, label, Icon, count }) => (
            <button key={id} onClick={() => setTabId(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all
                ${tabId === id ? "bg-emerald-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                  ${tabId === id ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 mt-2">
          {[{ id: "activos", label: "Activos" }, { id: "listos", label: "Listos" }, { id: "todos", label: "Todos" }].map(f => (
            <button key={f.id} onClick={() => setFiltroEstado(f.id)}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-all
                ${filtroEstado === f.id ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-500 border-slate-200"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3 max-w-lg mx-auto">
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
            {presFiltrados.length > 0 && (
              <div className="space-y-2">
                {presFiltrados.map(pres => (
                  <PresupuestoOpCard
                    key={pres.id}
                    presupuesto={pres}
                    opId={tabId}
                    productoMap={productoMap}
                    onUpdate={loadData}
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
