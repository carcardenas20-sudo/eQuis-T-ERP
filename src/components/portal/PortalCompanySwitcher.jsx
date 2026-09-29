import React, { useEffect, useState } from "react";
import { getPortalCompany, setPortalCompany } from "@/api/portalClient";
import { Building2, Loader2 } from "lucide-react";

// Selector de empresa del portal (planta / ruta). Cambiar de empresa exige el PIN
// del planillador de la empresa elegida. Se oculta si solo hay una empresa.
export default function PortalCompanySwitcher() {
  const [companies, setCompanies] = useState([]);
  const [pidiendo, setPidiendo] = useState(null); // empresa elegida esperando PIN
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const actual = getPortalCompany() || "equist";

  useEffect(() => {
    fetch("/api/portal-companies").then((r) => r.json()).then((d) => setCompanies(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  if (companies.length <= 1) return null;
  const nombre = (c) => c?.display_name || c?.name || "";

  const confirmar = async (e) => {
    e?.preventDefault();
    if (!pin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal-pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Portal-Company": pidiendo.id },
        body: JSON.stringify({ pin }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "PIN incorrecto");
      setPortalCompany(pidiendo.id);
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setPin("");
    }
    setLoading(false);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
        <Building2 className="w-3.5 h-3.5 text-slate-500" />
        <select
          value={actual}
          onChange={(e) => {
            const c = companies.find((x) => x.id === e.target.value);
            if (c && c.id !== actual) { setPidiendo(c); setPin(""); setError(""); }
          }}
          className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none max-w-[130px]"
        >
          {companies.map((c) => <option key={c.id} value={c.id}>{nombre(c)}</option>)}
        </select>
      </div>

      {pidiendo && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPidiendo(null)}>
          <form onSubmit={confirmar} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-xs space-y-3 shadow-xl">
            <p className="font-bold text-slate-900">Cambiar a {nombre(pidiendo)}</p>
            <p className="text-sm text-slate-500">Escribe el PIN del planillador de {nombre(pidiendo)}.</p>
            <input
              type="password" inputMode="numeric" autoFocus value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-center text-lg tracking-widest"
              placeholder="••••"
            />
            {error && <p className="text-xs text-red-600 text-center">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setPidiendo(null)} className="flex-1 h-10 rounded-lg border border-slate-200 text-sm">Cancelar</button>
              <button type="submit" disabled={loading || !pin} className="flex-1 h-10 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
