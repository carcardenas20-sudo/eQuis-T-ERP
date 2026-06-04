import React, { useState } from "react";
import { CheckCircle, XCircle, Building2, AlertTriangle, RefreshCw, Package, ChevronDown, ChevronUp } from "lucide-react";

function fmtN(n) { return (Number(n) || 0).toLocaleString("es-CO"); }

// ─── Verificación de una lona ─────────────────────────────────────────────────
function LonaRow({ lona, idx, estado, onEstado, cantidades, onCantidad }) {
  const [open, setOpen] = useState(true);
  const isOk = estado === "ok";
  const isDiff = estado === "diferencia";

  return (
    <div className={`rounded-xl border overflow-hidden ${isOk ? "border-green-200 bg-green-50/40" : isDiff ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0 cursor-pointer flex-1" onClick={() => setOpen(o => !o)}>
          <span className="text-xs font-bold text-slate-600 shrink-0">Lona {idx + 1}</span>
          <span className="text-xs text-slate-400">{fmtN(lona.total)} prendas · {(lona.items || []).length} ref.</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto" />}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button type="button"
            onClick={() => onEstado("ok")}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all
              ${isOk ? "bg-green-600 text-white border-green-600" : "bg-white border-green-200 text-green-700 hover:bg-green-50"}`}>
            <CheckCircle className="w-3 h-3" /> Completa
          </button>
          <button type="button"
            onClick={() => { onEstado("diferencia"); setOpen(true); }}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all
              ${isDiff ? "bg-amber-500 text-white border-amber-500" : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50"}`}>
            <XCircle className="w-3 h-3" /> Diferencia
          </button>
        </div>
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-1.5">
          {(lona.items || []).map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-700 flex-1">{item.nombre || item.product_id}</span>
              <span className="text-xs text-slate-400 shrink-0">enviado: {fmtN(item.cantidad)}</span>
              {isDiff ? (
                <input
                  type="number" min="0"
                  value={cantidades[item.product_id] ?? item.cantidad}
                  onChange={e => onCantidad(item.product_id, e.target.value)}
                  className="w-20 h-7 px-2 text-xs border border-amber-300 rounded bg-white text-right"
                />
              ) : (
                <span className="text-xs font-bold text-slate-700 w-20 text-right">{fmtN(item.cantidad)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Conteo directo por producto (sin lonas definidas) ────────────────────────
function ProductoRow({ item, totalContado, onChange }) {
  return (
    <div className={`rounded-xl border p-3 space-y-2 ${totalContado === item.cantidad_enviada && totalContado > 0 ? "border-green-200 bg-green-50/30" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{item.nombre || item.product_id}</p>
        <span className="text-xs text-slate-400">esperado: {fmtN(item.cantidad_enviada)}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 shrink-0">Total recibido:</label>
        <input type="number" min="0"
          value={totalContado ?? ""}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-8 px-3 text-sm border border-slate-200 rounded-lg"
          placeholder={String(item.cantidad_enviada)}
        />
        {totalContado > 0 && (
          <span className={`text-xs font-bold shrink-0 ${totalContado === item.cantidad_enviada ? "text-green-600" : "text-amber-600"}`}>
            {totalContado === item.cantidad_enviada ? "✓" : totalContado > item.cantidad_enviada ? `+${totalContado - item.cantidad_enviada}` : `−${item.cantidad_enviada - totalContado}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TransferReceive({ traslado, productos, locations, onDone, onCancel }) {
  const lonas = traslado?.lonas || [];
  const usaLonas = lonas.length > 0;

  // Estado para verificación por lona: { [lonaIdx]: "ok" | "diferencia" }
  const [estadoLonas, setEstadoLonas] = useState({});
  // Cantidades ajustadas en lonas con diferencia: { [lonaIdx]: { [product_id]: qty } }
  const [cantLonas, setCantLonas] = useState({});

  // Estado para conteo directo (sin lonas): { [product_id]: qty }
  const [conteoDirecto, setConteoDirecto] = useState({});

  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const origen = locations.find(l => l.id === traslado?.origen_location_id);
  const destino = locations.find(l => l.id === traslado?.destino_location_id);

  // Calcula conteo final consolidado desde lonas
  const calcConteoFinal = () => {
    if (usaLonas) {
      const totales = {};
      lonas.forEach((lona, idx) => {
        const est = estadoLonas[idx];
        if (!est) return; // lona no marcada → no contar
        (lona.items || []).forEach(item => {
          const cant = est === "diferencia"
            ? Number(cantLonas[idx]?.[item.product_id] ?? item.cantidad)
            : Number(item.cantidad);
          totales[item.product_id] = (totales[item.product_id] || 0) + cant;
        });
      });
      return totales;
    }
    return conteoDirecto;
  };

  const conteoFinal = calcConteoFinal();
  const lonasNoMarcadas = usaLonas ? lonas.filter((_, idx) => !estadoLonas[idx]).length : 0;

  const handleAceptar = async () => {
    if (usaLonas && lonasNoMarcadas > 0) {
      return alert(`Faltan ${lonasNoMarcadas} lona(s) por verificar.`);
    }
    setSaving(true);
    try {
      const conteoArr = (traslado.items || []).map(item => ({
        product_id: item.product_id,
        cantidad_enviada: item.cantidad_enviada,
        total_recibido: conteoFinal[item.product_id] ?? item.cantidad_enviada,
      }));
      const res = await fetch("/api/portal/functions/aceptarTraslado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traslado_id: traslado.id, conteo: conteoArr, notas, accion: "aceptar" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      onDone();
    } catch (e) {
      alert("Error al aceptar: " + (e instanceof Error ? e.message : String(e)));
    }
    setSaving(false);
  };

  const handleRechazar = async () => {
    if (!notas.trim()) return alert("Escribe el motivo del rechazo.");
    setSaving(true);
    try {
      const res = await fetch("/api/portal/functions/aceptarTraslado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traslado_id: traslado.id, notas, accion: "rechazar" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      onDone();
    } catch (e) {
      alert("Error: " + (e instanceof Error ? e.message : String(e)));
    }
    setSaving(false);
  };

  const hasDiferencias = usaLonas
    ? Object.values(estadoLonas).some(e => e === "diferencia")
    : Object.entries(conteoDirecto).some(([pid, qty]) => {
        const item = (traslado.items || []).find(i => i.product_id === pid);
        return item && qty !== item.cantidad_enviada;
      });

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-slate-900">{traslado?.numero_traslado}</p>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Pendiente</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="w-4 h-4 text-red-500" />
          <span className="font-medium text-red-700">{origen?.name || traslado?.origen_nombre}</span>
          <span className="text-slate-400">→</span>
          <Building2 className="w-4 h-4 text-green-500" />
          <span className="font-medium text-green-700">{destino?.name || traslado?.destino_nombre}</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {(traslado?.items || []).map((i, idx) => (
            <span key={idx} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {i.nombre || i.product_id} · {fmtN(i.cantidad_enviada)} uds
            </span>
          ))}
        </div>
      </div>

      {hasDiferencias && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Hay diferencias registradas. Puedes aceptar con nota o rechazar.
        </div>
      )}

      {/* Verificación */}
      {usaLonas ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Verificar lonas ({lonas.length} esperadas)
          </p>
          {lonas.map((lona, idx) => (
            <LonaRow
              key={idx}
              lona={lona}
              idx={idx}
              estado={estadoLonas[idx]}
              onEstado={est => setEstadoLonas(prev => ({ ...prev, [idx]: est }))}
              cantidades={cantLonas[idx] || {}}
              onCantidad={(pid, qty) => setCantLonas(prev => ({
                ...prev,
                [idx]: { ...(prev[idx] || {}), [pid]: qty }
              }))}
            />
          ))}
          {lonasNoMarcadas > 0 && (
            <p className="text-xs text-amber-600 text-center">{lonasNoMarcadas} lona(s) sin verificar</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conteo recibido</p>
          {(traslado?.items || []).map((item, idx) => (
            <ProductoRow
              key={idx}
              item={item}
              totalContado={conteoDirecto[item.product_id]}
              onChange={qty => setConteoDirecto(prev => ({ ...prev, [item.product_id]: qty }))}
            />
          ))}
        </div>
      )}

      {/* Notas */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-1">Notas de recepción</p>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none"
          placeholder="Observaciones, diferencias, estado de las prendas..." />
      </div>

      {/* Acciones */}
      <div className="space-y-2">
        <button type="button" onClick={handleAceptar} disabled={saving}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Aceptar traslado
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={saving}
            className="flex-1 text-sm font-medium py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleRechazar} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 text-sm font-semibold py-2.5 rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 disabled:opacity-50">
            <XCircle className="w-4 h-4" /> Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}
