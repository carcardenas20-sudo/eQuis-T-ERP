import React, { useState, useEffect, useMemo } from "react";
import { Remision, Operacion, Presupuesto, Producto, Servicio, OrdenServicio, AppConfig, Traslado, ProductoPOS, LocationPub, Inventory } from "@/api/publicEntities";
import { Factory, Wrench, RefreshCw, ChevronDown, ChevronUp, CheckCircle2,
  Play, Check, Layers, Package, ArrowRightLeft, InboxIcon, Send, X, Plus, Building2 } from "lucide-react";
import TransferReceive from "@/components/transfers/TransferReceive";

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
  const [estadosMap, setEstadosMap] = useState({});
  const [estadoConfigId, setEstadoConfigId] = useState(null);
  const [traslados, setTraslados] = useState(/** @type {any[]} */ ([]));
  const [productosPOS, setProductosPOS] = useState(/** @type {any[]} */ ([]));
  const [locations, setLocations] = useState(/** @type {any[]} */ ([]));
  const [inventarioPlanta, setInventarioPlanta] = useState(/** @type {any[]} */ ([]));
  const [plantaLocationId, setPlantaLocationId] = useState(/** @type {string|null} */ (null));
  const [receivingTrasladoId, setReceivingTrasladoId] = useState(/** @type {string|null} */ (null));
  const [trasladoForm, setTrasladoForm] = useState({ destino: "", items: /** @type {any[]} */ ([]), notas: "" });
  const [savingTraslado, setSavingTraslado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tabId, setTabId] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("activos");

  const loadData = async () => {
    setLoading(true);
    try {
      const [opsData, presData, prodData, tendData, cfgData] = await Promise.all([
        Operacion.list("orden_procesamiento"),
        Presupuesto.filter({ estado: "aprobado" }),
        Producto.list(),
        Remision.filter({ tipo_remision: "tendido" }),
        AppConfig.filter({ key: "proceso_planta_estados" }),
      ]);
      const activas = (opsData || []).filter(o => o.activa !== false);
      setOperaciones(activas);
      setPresupuestos(presData || []);
      setProductos(prodData || []);
      setTendidos(tendData || []);
      setTabId(prev => prev ?? (activas[0]?.id || "tendidos"));

      const cfg = (cfgData || [])[0] || null;
      setEstadoConfigId(cfg?.id || null);
      try { setEstadosMap(cfg ? JSON.parse(cfg.value) : {}); } catch { setEstadosMap({}); }
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

    // Servicios, órdenes, traslados y localizaciones son opcionales
    try {
      const [svcData, ordData, trasData, locsData, prodsData] = await Promise.all([
        Servicio.list(),
        OrdenServicio.list("-fecha_orden"),
        Traslado.list("-created_date"),
        LocationPub.list(),
        ProductoPOS.list(),
      ]);
      setServicios((svcData || []).filter(s => s.activo !== false));
      setOrdenes((ordData || []).filter(o => !["pagada", "cancelada"].includes(o.estado)));
      setTraslados(trasData || []);
      setLocations(locsData || []);
      setProductosPOS(prodsData || []);
    } catch (e) {
      console.warn("Servicios/Ordenes/Traslados no disponibles:", e.message);
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
    if (!trasladoForm.destino || trasladoForm.items.length === 0) return;
    setSavingTraslado(true);
    try {
      const origen = locations.find(l => l.id === plantaLocationId);
      const destino = locations.find(l => l.id === trasladoForm.destino);
      await Traslado.create({
        numero_traslado: nextNumeroTraslado(),
        origen_location_id: plantaLocationId || "taller",
        origen_nombre: origen?.name || "Taller",
        destino_location_id: trasladoForm.destino,
        destino_nombre: destino?.name || "",
        items: trasladoForm.items.map(i => ({
          product_id: i.product_id,
          nombre: i.nombre,
          cantidad_enviada: Number(i.cantidad),
        })),
        estado: "pendiente",
        notas: trasladoForm.notas,
      });
      setTrasladoForm({ destino: "", items: [], notas: "" });
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
                      <label className="text-xs font-medium text-slate-600">Productos</label>
                      <button type="button"
                        onClick={() => setTrasladoForm(f => ({ ...f, items: [...f.items, { product_id: "", nombre: "", cantidad: "" }] }))}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                        <Plus className="w-3 h-3" /> Agregar
                      </button>
                    </div>
                    {trasladoForm.items.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-3 border border-dashed rounded-lg">Sin productos</p>
                    )}
                    <div className="space-y-1.5">
                      {trasladoForm.items.map((item, idx) => {
                        const invItem = inventarioPlanta.find(i => i.product_id === item.product_id);
                        const stock = Number(invItem?.current_stock || invItem?.available_stock || 0);
                        return (
                          <div key={idx} className="flex gap-1.5 items-center">
                            <select value={item.product_id}
                              onChange={e => {
                                const prod = productosPOS.find(p => p.sku === e.target.value || p.id === e.target.value);
                                setTrasladoForm(f => {
                                  const items = [...f.items];
                                  items[idx] = { ...items[idx], product_id: e.target.value, nombre: prod?.name || "" };
                                  return { ...f, items };
                                });
                              }}
                              className="flex-1 h-8 px-2 text-xs border border-slate-200 rounded">
                              <option value="">Producto...</option>
                              {(inventarioPlanta.length > 0
                                ? inventarioPlanta.filter(i => Number(i.current_stock || 0) > 0).map(i => {
                                    const prod = productosPOS.find(p => p.sku === i.product_id || p.id === i.product_id);
                                    return prod ? { ...prod, _stock: Number(i.current_stock || 0) } : null;
                                  }).filter(Boolean)
                                : productosPOS
                              ).map(p => (
                                <option key={p.id} value={p.sku || p.id}>
                                  {p.name}{p._stock !== undefined ? ` (${p._stock} disponibles)` : ""}
                                </option>
                              ))}
                            </select>
                            <input type="number" min="1" max={stock || undefined} value={item.cantidad}
                              onChange={e => setTrasladoForm(f => {
                                const items = [...f.items];
                                items[idx] = { ...items[idx], cantidad: e.target.value };
                                return { ...f, items };
                              })}
                              className="w-20 h-8 px-2 text-xs border border-slate-200 rounded" placeholder="Uds" />
                            <button type="button"
                              onClick={() => setTrasladoForm(f => ({ ...f, items: f.items.filter((_,i) => i !== idx) }))}
                              className="p-1 text-red-400 hover:text-red-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button type="submit" disabled={savingTraslado || !trasladoForm.destino || trasladoForm.items.length === 0}
                    className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                    {savingTraslado ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar
                  </button>
                </form>
              </div>
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
