import React, { useState, useEffect } from "react";
import { Remision, OrdenServicio } from "@/api/publicEntities";
import { Factory, Package, Wrench, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, Clock, Play, Check } from "lucide-react";

const ESTADO_CONFIG = {
  pendiente:   { label: "Pendiente",   color: "bg-amber-100 text-amber-700 border-amber-200" },
  en_proceso:  { label: "En proceso",  color: "bg-blue-100 text-blue-700 border-blue-200" },
  listo:       { label: "Listo",       color: "bg-green-100 text-green-700 border-green-200" },
  despachado:  { label: "Despachado",  color: "bg-slate-100 text-slate-500 border-slate-200" },
  entregado:   { label: "Entregado",   color: "bg-purple-100 text-purple-700 border-purple-200" },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.pendiente;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function AccionBtn({ estadoActual, onCambiar, loading }) {
  if (estadoActual === "listo" || estadoActual === "despachado" || estadoActual === "entregado") return null;
  const siguiente = estadoActual === "pendiente" ? "en_proceso" : "listo";
  const label = estadoActual === "pendiente" ? "Iniciar" : "Marcar listo";
  const Icon = estadoActual === "pendiente" ? Play : Check;
  return (
    <button
      onClick={onCambiar}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all
        ${estadoActual === "pendiente"
          ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"}
        disabled:opacity-50`}
    >
      {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label}
    </button>
  );
}

// ─── Tarjeta de remisión (lote de despacho) ──────────────────────────────────
function RemisionCard({ remision, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const cambiarEstado = async () => {
    const siguiente = remision.estado === "pendiente" ? "en_proceso" : "listo";
    setLoading(true);
    try {
      await Remision.update(remision.id, { estado: siguiente });
      onUpdate();
    } catch (e) {
      alert("Error al actualizar: " + e.message);
    }
    setLoading(false);
  };

  const totalUds = (remision.tallas_cantidades || []).reduce((s, t) => s + (Number(t.cantidad) || 0), 0);

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${remision.estado === "listo" ? "border-green-200" : "border-slate-200"}`}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            {remision.estado === "listo"
              ? <CheckCircle2 className="w-5 h-5 text-green-500" />
              : <Package className="w-5 h-5 text-amber-500" />}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{remision.producto_nombre || "—"}</p>
            <p className="text-xs text-slate-500">{remision.combinacion_nombre || ""} · {totalUds} uds</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <EstadoBadge estado={remision.estado} />
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
          <div className="flex justify-end pt-1">
            <AccionBtn estadoActual={remision.estado} onCambiar={cambiarEstado} loading={loading} />
          </div>
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
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
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
          {/* Items */}
          {(orden.items || []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Servicios</p>
              {orden.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <p className="text-sm font-medium text-slate-800">{item.servicio_nombre || item.servicio_id}</p>
                  <span className="text-sm font-bold text-slate-700">
                    {item.cantidad} {item.unidad || ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {orden.notas && (
            <p className="text-xs text-slate-500 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">{orden.notas}</p>
          )}

          <div className="flex justify-between items-center pt-1">
            <p className="text-xs text-slate-400">{orden.fecha_orden || ""}</p>
            <AccionBtn estadoActual={orden.estado} onCambiar={cambiarEstado} loading={loading} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Portal principal ─────────────────────────────────────────────────────────
const TABS = [
  { id: "despachos", label: "Despachos", Icon: Package },
  { id: "servicios", label: "Servicios",  Icon: Wrench },
];

export default function PlantPortal() {
  const [tab, setTab] = useState("despachos");
  const [remisiones, setRemisiones] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("activos");

  const loadData = async () => {
    setLoading(true);
    try {
      const [remData, ordData] = await Promise.all([
        Remision.filter({ tipo_remision: "asignacion_despacho" }),
        OrdenServicio.list("-fecha_orden"),
      ]);
      setRemisiones(
        (remData || []).sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0))
      );
      setOrdenes(ordData || []);
    } catch (e) {
      console.error("Error cargando datos:", e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const remFiltradas = remisiones.filter(r => {
    if (filtroEstado === "activos") return r.estado !== "despachado" && r.estado !== "entregado";
    if (filtroEstado === "listos") return r.estado === "listo";
    return true;
  });

  const ordFiltradas = ordenes.filter(o => {
    if (filtroEstado === "activos") return o.estado !== "entregado" && o.estado !== "cancelado";
    if (filtroEstado === "listos") return o.estado === "listo";
    return true;
  });

  const pendRemisiones = remisiones.filter(r => r.estado === "pendiente" || r.estado === "en_proceso").length;
  const pendOrdenes = ordenes.filter(o => o.estado === "pendiente" || o.estado === "en_proceso").length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Factory className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base leading-tight">Portal de Planta</h1>
              <p className="text-xs text-slate-500">Operaciones · eQuis-T</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          {TABS.map(({ id, label, Icon }) => {
            const count = id === "despachos" ? pendRemisiones : pendOrdenes;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-1 justify-center
                  ${tab === id ? "bg-emerald-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                    ${tab === id ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
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
        ) : tab === "despachos" ? (
          remFiltradas.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay lotes {filtroEstado === "activos" ? "pendientes" : filtroEstado}</p>
            </div>
          ) : (
            remFiltradas.map(r => (
              <RemisionCard key={r.id} remision={r} onUpdate={loadData} />
            ))
          )
        ) : (
          ordFiltradas.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay órdenes {filtroEstado === "activos" ? "pendientes" : filtroEstado}</p>
            </div>
          ) : (
            ordFiltradas.map(o => (
              <OrdenCard key={o.id} orden={o} onUpdate={loadData} />
            ))
          )
        )}
      </div>
    </div>
  );
}
