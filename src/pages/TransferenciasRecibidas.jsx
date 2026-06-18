import React, { useEffect, useState } from "react";
import { TransferenciaDetectada } from "@/entities/all";
import { BanknoteIcon, RefreshCw, Check, X, AlertCircle } from "lucide-react";

const BANCO_LABELS = {
  bancolombia: { label: "Bancolombia", color: "bg-yellow-100 text-yellow-800" },
  bbva:        { label: "BBVA",        color: "bg-blue-100 text-blue-800"   },
  nequi:       { label: "Nequi",       color: "bg-purple-100 text-purple-800" },
  daviplata:   { label: "Daviplata",   color: "bg-red-100 text-red-800"    },
};

export default function TransferenciasRecibidas() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIgnored, setShowIgnored] = useState(false);

  const reload = async () => {
    setLoading(true);
    const all = await TransferenciaDetectada.list("-created_date");
    setTransfers(all || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const procesar = async (t) => {
    if (!confirm(`¿Marcar como procesada la transferencia de $${Number(t.monto || 0).toLocaleString()} de ${t.remitente || "desconocido"}?`)) return;
    await TransferenciaDetectada.update(t.id, { estado: "asignado" });
    reload();
  };

  const ignorar = async (t) => {
    if (!confirm("¿Ignorar esta transferencia?")) return;
    await TransferenciaDetectada.update(t.id, { estado: "ignorado" });
    reload();
  };

  const limpiarBasura = async () => {
    if (!confirm("¿Eliminar todos los registros de compras y pagos salientes del backlog?")) return;
    const token = localStorage.getItem("equist_token") || "";
    const res = await fetch("/api/functions/limpiarTransferenciasBasura", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    alert(`Eliminados: ${data.eliminados ?? 0} registros`);
    reload();
  };

  const borrarTodo = async () => {
    if (!confirm(`¿Borrar los ${sinAsignar.length} registros sin procesar? Esto NO borra los procesados.`)) return;
    const token = localStorage.getItem("equist_token") || "";
    const res = await fetch("/api/functions/borrarBacklogTransferencias", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    alert(`Borrados: ${data.eliminados ?? 0} registros`);
    reload();
  };

  const visible = transfers.filter(t => showIgnored || t.estado !== "ignorado");
  const sinAsignar = visible.filter(t => t.estado === "sin_asignar");
  const procesadas = visible.filter(t => t.estado === "asignado");

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Transferencias recibidas</h1>
          <p className="text-sm text-slate-500">Detectadas automáticamente desde el email bancario</p>
        </div>
        <div className="flex items-center gap-2">
          {sinAsignar.length > 0 && (
            <>
              <button onClick={limpiarBasura} className="text-xs px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 active:bg-orange-100">
                Limpiar salientes
              </button>
              <button onClick={borrarTodo} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 active:bg-red-100">
                Borrar todo
              </button>
            </>
          )}
          <button onClick={reload} className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200">
            <RefreshCw className={`w-5 h-5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Sin procesar */}
      {sinAsignar.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-600">Sin procesar ({sinAsignar.length})</p>
          {sinAsignar.map(t => (
            <TransferCard key={t.id} t={t} onProcesar={() => procesar(t)} onIgnorar={() => ignorar(t)} />
          ))}
        </div>
      )}

      {sinAsignar.length === 0 && !loading && (
        <div className="text-center py-12 text-slate-400">
          <BanknoteIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin transferencias pendientes</p>
          <p className="text-xs mt-1 opacity-70">El poller revisa el inbox cada 60 segundos</p>
        </div>
      )}

      {/* Procesadas */}
      {procesadas.length > 0 && (
        <details className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <summary className="px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer select-none hover:bg-slate-50">
            Procesadas ({procesadas.length})
          </summary>
          <div className="divide-y divide-slate-100">
            {procesadas.map(t => <TransferCard key={t.id} t={t} processed />)}
          </div>
        </details>
      )}

      {/* Toggle ignoradas */}
      <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
        <input type="checkbox" checked={showIgnored} onChange={e => setShowIgnored(e.target.checked)} />
        Mostrar ignoradas
      </label>

    </div>
  );
}

function TransferCard({ t, onProcesar, onIgnorar, processed }) {
  const [expanded, setExpanded] = useState(false);
  const banco = BANCO_LABELS[t.banco] || { label: t.banco || "Desconocido", color: "bg-slate-100 text-slate-600" };
  const sinMonto = !t.monto || Number(t.monto) === 0;

  return (
    <div className={`bg-white rounded-xl border p-4 space-y-2 ${processed ? "opacity-60 border-slate-100" : "border-slate-200 shadow-sm"}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">

          {/* Monto + banco */}
          <div className="flex items-center gap-2 flex-wrap">
            {sinMonto ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-amber-600">
                <AlertCircle className="w-4 h-4" /> Sin parsear
              </span>
            ) : (
              <span className="text-lg font-bold text-slate-900">
                ${Number(t.monto).toLocaleString("es-CO")}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${banco.color}`}>{banco.label}</span>
            {processed && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Procesada</span>}
          </div>

          {/* Remitente */}
          {t.remitente && <p className="text-sm text-slate-700 mt-0.5 font-medium">{t.remitente}</p>}

          {/* Fecha + referencia */}
          <p className="text-xs text-slate-400 mt-0.5">
            {t.fecha_pago ? new Date(t.fecha_pago).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—"}
            {t.referencia && <> · Ref. {t.referencia}</>}
          </p>

          {/* Asunto del email */}
          {t.email_subject && (
            <p className="text-xs text-slate-300 truncate mt-0.5">{t.email_subject}</p>
          )}

          {/* Texto del email (siempre disponible para debug) */}
          {t.email_texto && (
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-slate-400 underline mt-1">
              {expanded ? "Ocultar texto" : "Ver texto del email"}
            </button>
          )}
          {expanded && t.email_texto && (
            <pre className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2 mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {t.email_texto}
            </pre>
          )}
        </div>

        {/* Botones */}
        {!processed && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onProcesar}
              className="flex items-center gap-1 text-xs font-bold px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800"
            >
              <Check className="w-3.5 h-3.5" /> Procesar
            </button>
            <button
              onClick={onIgnorar}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
