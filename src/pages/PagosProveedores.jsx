import React, { useEffect, useRef, useState } from "react";
import { getToken, getActiveCompany } from "@/api/localClient";
import { Location } from "@/entities/all";
import { useSession } from "@/components/providers/SessionProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Truck, Banknote, Loader2, CheckCircle2, X, Store, Lock } from "lucide-react";

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-CO")}`;
const fmtDay = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const fmtDateTime = (d) => {
  try {
    return new Date(d).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

async function api(method, body) {
  const token = getToken();
  const company = getActiveCompany();
  const res = await fetch("/api/supplier-payments", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(company ? { "X-Company-Id": company } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// Pagos a proveedores desde el punto de venta: se ven las cuentas pendientes SIN montos
// y el pago (solo efectivo) se reparte en orden, de la cuenta más antigua a la más nueva.
export default function PagosProveedores() {
  const { isRealAdmin, permissions, isLoading: sessionLoading } = useSession();
  const allowed = isRealAdmin || (permissions || []).includes("supplier_payments");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(null); // proveedor seleccionado
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [payDate, setPayDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState(null);
  const [adminLocations, setAdminLocations] = useState([]);
  const [adminLocationId, setAdminLocationId] = useState("");
  const savingRef = useRef(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api("GET");
      setData(d);
      if (!d.location && isRealAdmin) {
        const locs = await Location.filter({ is_active: true }).catch(() => []);
        setAdminLocations(locs || []);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { if (!sessionLoading && allowed) load(); }, [sessionLoading, allowed]);

  const openPay = (s) => { setPaying(s); setAmount(""); setNotes(""); setPayDate(todayStr()); setFormError(""); setResult(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    const value = Math.round(Number(amount) || 0);
    if (value <= 0) { setFormError("Escribe el valor que se pagó."); return; }
    if (!data?.location && !adminLocationId) { setFormError("Elige el punto de venta de donde sale el efectivo."); return; }
    const dayText = payDate === todayStr() ? "de hoy" : `del ${fmtDay(payDate)}`;
    if (!window.confirm(`¿Registrar pago en EFECTIVO de ${money(value)} a ${paying.name}?

Sale del efectivo ${dayText}.`)) return;
    savingRef.current = true;
    setSaving(true);
    setFormError("");
    try {
      const r = await api("POST", {
        supplier_key: paying.key,
        amount: value,
        notes: notes.trim(),
        payment_date: payDate,
        ...(adminLocationId ? { location_id: adminLocationId } : {}),
      });
      setResult(r);
      setPaying(null);
      await load();
    } catch (err) {
      setFormError(err.message);
    }
    savingRef.current = false;
    setSaving(false);
  };

  if (sessionLoading) return null;
  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <Lock className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-lg font-semibold text-slate-600">Acceso restringido</p>
        <p className="text-sm text-slate-400 mt-1">No tienes permiso para registrar pagos a proveedores.</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" /> Pagos a proveedores
          </h1>
          {data?.location && (
            <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
              <Store className="w-4 h-4" /> Punto de venta: <b>{data.location.name}</b>
            </p>
          )}
        </div>

        <div className="text-xs sm:text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2">
          💵 Solo <b>efectivo</b> de la caja de tu punto (queda en Control de Efectivo). El pago se aplica
          automáticamente <b>en orden</b>: primero a la cuenta más antigua de ese proveedor.
        </div>

        {result && (
          <Card className="border-emerald-300 bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Pago de {money(result.amount)} a {result.supplier_name} registrado
                  {result.payment_date && result.payment_date !== todayStr() && <span className="font-normal text-sm">(efectivo del {fmtDay(result.payment_date)})</span>}
                </p>
                <button onClick={() => setResult(null)} className="text-emerald-700"><X className="w-4 h-4" /></button>
              </div>
              <ul className="mt-2 text-sm text-emerald-900 space-y-0.5">
                {result.applied.map((a, i) => (
                  <li key={i}>
                    • {a.description || "Cuenta"}{a.invoice_number ? ` (Fact. ${a.invoice_number})` : ""} —{" "}
                    <b>{a.settled ? "quedó saldada" : "abono parcial"}</b>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {paying && (
          <Card className="border-emerald-300">
            <CardContent className="p-4">
              <form onSubmit={submit} className="space-y-3">
                <p className="font-bold text-slate-900">Registrar pago a {paying.name}</p>
                {!data?.location && isRealAdmin && (
                  <div className="space-y-1.5">
                    <Label>Punto de venta (de dónde sale el efectivo) *</Label>
                    <select value={adminLocationId} onChange={e => setAdminLocationId(e.target.value)}
                      className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                      <option value="">Selecciona…</option>
                      {adminLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>¿De qué día sale el efectivo? *</Label>
                    <Input type="date" value={payDate} max={todayStr()} onChange={e => setPayDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valor pagado en efectivo *</Label>
                    <Input type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ej: 150000" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nota / N.º de recibo</Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
                  <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Banknote className="w-4 h-4 mr-1" />}
                    Registrar pago
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : error ? (
          <p className="text-center text-red-600 py-8">{error}</p>
        ) : !data?.suppliers?.length ? (
          <Card><CardContent className="py-12 text-center text-slate-500">No hay cuentas pendientes con proveedores.</CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.suppliers.map(s => (
              <Card key={s.key} className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.accounts.length} cuenta{s.accounts.length !== 1 ? "s" : ""} pendiente{s.accounts.length !== 1 ? "s" : ""} · se pagan en este orden</p>
                    </div>
                    <Button size="sm" onClick={() => openPay(s)} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                      <Banknote className="w-4 h-4 mr-1" /> Pagar
                    </Button>
                  </div>
                  <ol className="space-y-1.5">
                    {s.accounts.map((a, i) => (
                      <li key={a.id} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${i === 0 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-slate-800 truncate">{a.description || "Cuenta por pagar"}{a.invoice_number ? ` · Fact. ${a.invoice_number}` : ""}</p>
                          <p className="text-xs text-slate-500">
                            {a.due_date ? `Vence ${fmtDay(a.due_date)}` : `Registrada ${fmtDay(a.created_date)}`}
                            {a.partial && <Badge className="ml-2 bg-amber-100 text-amber-800 text-[10px]">con abonos</Badge>}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {data?.recent?.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="font-semibold text-slate-800 mb-2">Mis pagos (últimos 30 días)</p>
              <div className="divide-y">
                {data.recent.map((r, i) => (
                  <div key={i} className="flex justify-between py-1.5 text-sm">
                    <span className="text-slate-700">{fmtDateTime(r.date)} · {r.supplier_name}</span>
                    <b className="tabular-nums">{money(r.amount)}</b>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
