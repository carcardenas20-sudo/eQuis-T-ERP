import React, { useState, useEffect } from "react";
import { RecomendacionCalidad } from "@/api/entitiesChaquetas";
import { RefreshCw, Wifi, WifiOff, QrCode, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, MessageCircle } from "lucide-react";

const CATEGORIAS = [
  "Costuras", "Acabados", "Medidas", "Materiales", "Proceso", "General",
];

export default function AdminWhatsApp() {
  const [status, setStatus] = useState(null);
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [iniciando, setIniciando] = useState(false);

  // Form nueva recomendación
  const [showForm, setShowForm] = useState(false);
  const [formTexto, setFormTexto] = useState("");
  const [formCategoria, setFormCategoria] = useState("General");
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/whatsapp/status", { headers });
      setStatus(await res.json());
    } catch { setStatus({ status: "error" }); }
    setLoadingStatus(false);
  };

  const loadRecomendaciones = async () => {
    const data = await RecomendacionCalidad.list();
    setRecomendaciones(data || []);
  };

  useEffect(() => {
    loadStatus();
    loadRecomendaciones();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleIniciar = async () => {
    setIniciando(true);
    await fetch("/api/whatsapp/init", { method: "POST", headers });
    setTimeout(() => { setIniciando(false); loadStatus(); }, 2000);
  };

  const handleGuardar = async () => {
    if (!formTexto.trim()) return;
    setSaving(true);
    await RecomendacionCalidad.create({ texto: formTexto.trim(), categoria: formCategoria, activa: true });
    setFormTexto(""); setFormCategoria("General"); setShowForm(false);
    await loadRecomendaciones();
    setSaving(false);
  };

  const handleEliminar = async (id) => {
    if (!confirm("¿Eliminar esta recomendación?")) return;
    await RecomendacionCalidad.delete(id);
    await loadRecomendaciones();
  };

  const handleToggle = async (rec) => {
    await RecomendacionCalidad.update(rec.id, { activa: !rec.activa });
    await loadRecomendaciones();
  };

  const StatusBadge = () => {
    if (loadingStatus) return <span className="flex items-center gap-1.5 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</span>;
    if (!status) return null;
    if (status.status === "ready") return <span className="flex items-center gap-1.5 text-green-700 font-semibold text-sm"><CheckCircle2 className="w-4 h-4" /> Conectado</span>;
    if (status.status === "qr") return <span className="flex items-center gap-1.5 text-amber-600 font-semibold text-sm"><QrCode className="w-4 h-4" /> Esperando QR</span>;
    if (status.status === "initializing") return <span className="flex items-center gap-1.5 text-blue-600 font-semibold text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Inicializando...</span>;
    return <span className="flex items-center gap-1.5 text-red-600 font-semibold text-sm"><WifiOff className="w-4 h-4" /> Desconectado</span>;
  };

  const porCategoria = CATEGORIAS.map(cat => ({
    cat,
    items: recomendaciones.filter(r => r.categoria === cat),
  })).filter(g => g.items.length > 0);

  const sinCategoria = recomendaciones.filter(r => !CATEGORIAS.includes(r.categoria));

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-green-600" />
            WhatsApp — Recomendaciones de Calidad
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestiona la conexión y el catálogo de recomendaciones que el planillador envía a los operarios.
          </p>
        </div>

        {/* Estado de conexión */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Estado de conexión</h2>
            <button onClick={loadStatus} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <StatusBadge />
            {status?.status !== "ready" && status?.status !== "initializing" && (
              <button onClick={handleIniciar} disabled={iniciando}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                {iniciando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                {iniciando ? "Iniciando..." : "Conectar WhatsApp"}
              </button>
            )}
          </div>

          {/* QR */}
          {status?.status === "qr" && status?.qrImage && (
            <div className="mt-4 flex flex-col items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-semibold text-amber-800">
                Abre WhatsApp en el celular dedicado → Dispositivos vinculados → Vincular un dispositivo → Escanea este QR
              </p>
              <img src={status.qrImage} alt="QR WhatsApp" className="w-56 h-56 border-4 border-white shadow-lg rounded-lg" />
              <p className="text-xs text-amber-600">El QR expira en ~60 segundos. La página se actualiza automáticamente.</p>
            </div>
          )}

          {status?.status === "ready" && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              WhatsApp conectado y listo. Los mensajes de recomendaciones de calidad se enviarán automáticamente.
            </div>
          )}
        </div>

        {/* Catálogo de recomendaciones */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Catálogo de recomendaciones</h2>
            <button onClick={() => setShowForm(s => !s)}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
              <Plus className="w-3.5 h-3.5" /> Nueva
            </button>
          </div>

          {showForm && (
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Categoría</label>
                <select value={formCategoria} onChange={e => setFormCategoria(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Texto del mensaje *</label>
                <textarea
                  value={formTexto}
                  onChange={e => setFormTexto(e.target.value)}
                  rows={3}
                  placeholder="Ej: Asegúrate de que las costuras queden a 1cm del borde y sin hilos sueltos..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg">Cancelar</button>
                <button onClick={handleGuardar} disabled={saving || !formTexto.trim()}
                  className="px-4 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {recomendaciones.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay recomendaciones. Crea la primera.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...porCategoria, ...(sinCategoria.length > 0 ? [{ cat: "Sin categoría", items: sinCategoria }] : [])].map(({ cat, items }) => (
                <div key={cat}>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{cat}</p>
                  <div className="space-y-2">
                    {items.map(rec => (
                      <div key={rec.id} className={`flex items-start gap-3 p-3 rounded-lg border ${rec.activa !== false ? "border-slate-200 bg-slate-50" : "border-slate-100 bg-white opacity-50"}`}>
                        <button onClick={() => handleToggle(rec)} className="mt-0.5 shrink-0">
                          <div className={`w-4 h-4 rounded-full border-2 ${rec.activa !== false ? "bg-green-500 border-green-500" : "border-slate-300"}`} />
                        </button>
                        <p className="flex-1 text-sm text-slate-700">{rec.texto}</p>
                        <button onClick={() => handleEliminar(rec.id)} className="text-red-400 hover:text-red-600 shrink-0 p-0.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
