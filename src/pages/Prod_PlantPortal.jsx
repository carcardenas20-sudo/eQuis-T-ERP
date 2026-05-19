import React, { useState, useEffect } from "react";
import { Remision, OrdenServicio, Operacion } from "@/api/publicEntities";
import { Factory, Package, Wrench, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, Play, Check } from "lucide-react";

const ESTADO_CFG = {
  pendiente:  { label: "Pendiente",  color: "bg-amber-100 text-amber-700 border-amber-200" },
  en_proceso: { label: "En proceso", color: "bg-blue-100 text-blue-700 border-blue-200" },
  listo:      { label: "Listo",      color: "bg-green-100 text-green-700 border-green-200" },
  despachado: { label: "Despachado", color: "bg-slate-100 text-slate-500 border-slate-200" },
  entregado:  { label: "Entregado",  color: "bg-purple-100 text-purple-700 border-purple-200" },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.pendiente;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// Determina si una remision es relevante para una operacion según los tipos de material
function remisionMatchesOp(remision, operacion) {
  const matTypes = new Set((remision.materiales_calculados || []).map(m => m.tipo).filter(Boolean));
  const matIds = new Set((remision.materiales_calculados || []).map(m => m.materia_prima_id).filter(Boolean));
  const tipos = operacion.tipos_materiales_requeridos || [];
  const especificos = operacion.materiales_especificos || [];
  if (tipos.length === 0 && especificos.length === 0) return true;
  if (operacion.condicion_logica === "todos") {
    return tipos.every(t => matTypes.has(t)) && especificos.every(id => matIds.has(id));
  }
  return tipos.some(t => matTypes.has(t)) || especificos.some(id => matIds.has(id));
}

// ─── Tarjeta de remisión por proceso ─────────────────────────────────────────
function RemisionCard({ remision, operacionId, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const estadoProceso = (remision.procesos_estado || {})[operacionId] || "pendiente";
  const totalUds = (remision.tallas_cantidades || []).reduce((s, t) => s + (Number(t.cantidad) || 0), 0);

  const cambiarEstado = async () => {
    if (estadoProceso === "listo") return;
    const siguiente = estadoProceso === "pendiente" ? "en_proceso" : "listo";
    setLoading(true);
    try {
      await Remision.update(remision.id, {
        procesos_estado: { ...(remision.procesos_estado || {}), [operacionId]: siguiente }
      });
      onUpdate();
    } catch (e) {
      alert("Error al actualizar: " + e.message);
    }
    setLoading(false);
  };

  const isListo = estadoProceso === "listo";

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isListo ? "border-green-200" : "border-slate-200"}`}>
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            {isListo
              ? <CheckCircle2 className="w-5 h-5 text-green-500" />
              : <Package className="w-5 h-5 text-amber-500" />}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{remision.producto_nombre || "—"}</p>
            <p className="text-xs text-slate-500">{remision.combinacion_nombre || ""} · {totalUds} uds</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <EstadoBadge estado={estadoProceso} />
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          {/* Tallas */}
          <div className="flex flex-wrap gap-2 pt-3">
            {(remision.tallas_cantidades || []).map(tc => (
              <div key={tc.talla} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-center min-w-[48px]">
                <p className="text-xs text-slate-500">{tc.talla}</p>
                <p className="text-lg font-bold text-slate-800">{tc.cantidad}</p>
              </div>
            ))}
          </div>

          {/* Materiales */}
          {(remision.materiales_calculados || []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Materiales</p>
              {remision.materiales_calculados.map((mat, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{mat.nombre}</p>
                    {mat.color && mat.color !== "Sin definir" && (
                      <p className="text-xs text-slate-400">{mat.color}</p>
                    )}
                  </div>
                  <span className="text-base font-bold text-slate-900">
                    {mat.cantidad == null ? "—" : Number(mat.cantidad).toFixed(2).replace(/\.?0+$/, "")}
                    <span className="text-xs text-slate-400 ml-1 font-normal">{mat.etiqueta}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Acción */}
          {!isListo && (
            <div className="flex justify-end pt-1">
              <button
                onClick={cambiarEstado}
                disabled={loading}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50
                  ${estadoProceso === "pendiente"
                    ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"}`}
              >
                {loading
                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                  : estadoProceso === "pendiente" ? <Play className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                {estadoProceso === "pendiente" ? "Iniciar" : "Marcar listo"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de orden de servicio ─────────────────────────────────────────────
function OrdenCard({ orden, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const cambiarEstado = async () => {
    const siguiente = orden.estado === "pendiente" ? "en_proceso" : "listo";
    setLoading(true);
    try {
      await OrdenServicio.update(orden.id, { estado: siguiente });
      onUpdate();
    } catch (e) {
      alert("Error al actualizar: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${orden.estado === "listo" ? "border-green-200" : "border-slate-200"}`}>
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            {orden.estado === "listo"
              ? <CheckCircle2 className="w-5 h-5 text-green-500" />
              : <Wrench className="w-5 h-5 text-purple-500" />}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{orden.numero_orden || "—"}</p>
            <p className="text-xs text-slate-500 truncate">{orden.cliente || "Sin cliente"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <EstadoBadge estado={orden.estado} />
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {(orden.items || []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Servicios</p>
              {orden.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <p className="text-sm font-medium text-slate-800">{item.servicio_nombre || item.servicio_id}</p>
                  <span className="text-sm font-bold text-slate-700">{item.cantidad} {item.unidad || ""}</span>
                </div>
              ))}
            </div>
          )}
          {orden.notas && (
            <p className="text-xs text-slate-500 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">{orden.notas}</p>
          )}
          {orden.estado !== "listo" && orden.estado !== "entregado" && (
            <div className="flex justify-end pt-1">
              <button
                onClick={cambiarEstado}
                disabled={loading}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50
                  ${orden.estado === "pendiente"
                    ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"}`}
              >
                {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : orden.estado === "pendiente" ? <Play className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                {orden.estado === "pendiente" ? "Iniciar" : "Marcar listo"}
              </button>
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
  const [remisiones, setRemisiones] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabId, setTabId] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("activos");

  const loadData = async () => {
    setLoading(true);
    try {
      const [opsData, remData, ordData] = await Promise.all([
        Operacion.list("orden_procesamiento"),
        Remision.filter({ tipo_remision: "asignacion_despacho" }),
        OrdenServicio.list("-fecha_orden"),
      ]);
      const activas = (opsData || []).filter(o => o.activa !== false);
      setOperaciones(activas);
      setRemisiones((remData || []).sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0)));
      setOrdenes(ordData || []);
      setTabId(prev => prev ?? (activas[0]?.id || "servicios"));
    } catch (e) {
      console.error("Error cargando datos:", e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Remisiones filtradas por operacion seleccionada
  const remDeOp = tabId && tabId !== "servicios"
    ? remisiones.filter(r => {
        const op = operaciones.find(o => o.id === tabId);
        return op ? remisionMatchesOp(r, op) : false;
      })
    : [];

  const filtrar = (lista, esServicio = false) => {
    return lista.filter(item => {
      const estado = esServicio ? item.estado : ((item.procesos_estado || {})[tabId] || "pendiente");
      if (filtroEstado === "activos") return estado !== "despachado" && estado !== "entregado" && estado !== "listo";
      if (filtroEstado === "listos")  return estado === "listo";
      return true;
    });
  };

  const ordFiltradas = tabId === "servicios"
    ? ordenes.filter(o => {
        if (filtroEstado === "activos") return o.estado !== "entregado" && o.estado !== "cancelado" && o.estado !== "listo";
        if (filtroEstado === "listos") return o.estado === "listo";
        return true;
      })
    : [];

  const pendDeOp = (op) => {
    const rem = remisiones.filter(r => remisionMatchesOp(r, op));
    return rem.filter(r => {
      const e = (r.procesos_estado || {})[op.id] || "pendiente";
      return e === "pendiente" || e === "en_proceso";
    }).length;
  };
  const pendOrdenes = ordenes.filter(o => o.estado === "pendiente" || o.estado === "en_proceso").length;

  const tabs = [
    ...operaciones.map(op => ({
      id: op.id,
      label: op.nombre,
      Icon: Factory,
      count: pendDeOp(op),
    })),
    { id: "servicios", label: "Servicios", Icon: Wrench, count: pendOrdenes },
  ];

  const remFiltradas = filtrar(remDeOp);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
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
          <button
            onClick={loadData}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tabs de procesos */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {tabs.map(({ id, label, Icon, count }) => (
            <button
              key={id}
              onClick={() => setTabId(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0
                ${tabId === id ? "bg-emerald-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
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

        {/* Filtro estado */}
        <div className="flex gap-1.5 mt-2">
          {[
            { id: "activos", label: "Activos" },
            { id: "listos",  label: "Listos" },
            { id: "todos",   label: "Todos" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltroEstado(f.id)}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-all
                ${filtroEstado === f.id ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : tabId === "servicios" ? (
          ordFiltradas.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay órdenes {filtroEstado === "activos" ? "activas" : filtroEstado}</p>
            </div>
          ) : (
            ordFiltradas.map(o => <OrdenCard key={o.id} orden={o} onUpdate={loadData} />)
          )
        ) : remFiltradas.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay lotes {filtroEstado === "activos" ? "activos" : filtroEstado}</p>
          </div>
        ) : (
          remFiltradas.map(r => (
            <RemisionCard key={r.id} remision={r} operacionId={tabId} onUpdate={loadData} />
          ))
        )}
      </div>
    </div>
  );
}
