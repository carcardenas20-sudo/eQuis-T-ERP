import React, { useEffect, useMemo, useRef, useState } from "react";
import { getToken, getActiveCompany } from "@/api/localClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { HandCoins, CheckCircle2, Clock, AlertTriangle, Loader2, Ban } from "lucide-react";

const n = (v) => Number(v) || 0;
const money = (v) => `$${Math.round(n(v)).toLocaleString("es-CO")}`;
const fmtDT = (d) => {
  try { return new Date(d).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};
const fmtDay = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");

async function api(path, method = "GET", body) {
  const token = getToken();
  const company = getActiveCompany();
  const res = await fetch(`/api/entregas-efectivo${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(company ? { "X-Company-Id": company } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
  return d;
}

const ESTADOS = {
  pendiente: { label: "Pendiente de confirmar", cls: "bg-amber-100 text-amber-800", Icon: Clock },
  confirmada: { label: "Confirmada · coincide", cls: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
  con_diferencia: { label: "Confirmada con diferencia", cls: "bg-red-100 text-red-700", Icon: AlertTriangle },
  anulada: { label: "Anulada", cls: "bg-slate-100 text-slate-500", Icon: Ban },
};

// Acta de entrega de efectivo: el líder declara lo que entrega; el receptor confirma lo recibido.
export default function EntregasEfectivo({ controls, locations, canManage, currentUser, userLocation, onChanged }) {
  const [actas, setActas] = useState([]);
  const [receptores, setReceptores] = useState([]);
  const [nueva, setNueva] = useState(false);
  const [confirmando, setConfirmando] = useState(null);
  const [verTodas, setVerTodas] = useState(false);

  const load = async () => {
    try {
      const [a, r] = await Promise.all([api(""), api("/receptores")]);
      setActas(a || []);
      setReceptores(r || []);
    } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, []);

  const locName = (id) => locations.find((l) => l.id === id)?.name || "—";
  const porConfirmar = actas.filter((a) => a.estado === "pendiente" && (canManage || a.receptor_id === currentUser?.id) && a.entregado_por_id !== currentUser?.id);
  const lista = verTodas ? actas : actas.slice(0, 8);
  const faltantes = actas.filter((a) => n(a.faltante) > 0 && !a.faltante_revisado);
  const revisarFaltante = async (a) => {
    const nota = window.prompt(`Faltante de ${money(a.faltante)} en el acta ${a.numero} (${a.entregado_por}).

¿Cómo se resolvió? (ej. se descontó de nómina, apareció, se asumió como pérdida)`);
    if (nota === null) return;
    if (!nota.trim()) { alert("Escribe cómo se resolvió."); return; }
    try { await api(`/${a.id}/revisar-faltante`, "POST", { nota }); await load(); } catch (e) { alert(e.message); }
  };

  const anular = async (a) => {
    if (!window.confirm(`¿Anular el acta ${a.numero}? Los días vuelven a quedar pendientes de entregar.`)) return;
    try { await api(`/${a.id}/anular`, "POST", {}); await load(); onChanged?.(); } catch (e) { alert(e.message); }
  };

  return (
    <Card className="border-emerald-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-slate-900 flex items-center gap-2"><HandCoins className="w-5 h-5 text-emerald-600" /> Entregas de efectivo</p>
          {(userLocation?.id || canManage) && (
            <Button size="sm" onClick={() => setNueva(true)} className="bg-emerald-600 hover:bg-emerald-700">Registrar entrega</Button>
          )}
        </div>

        {porConfirmar.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-amber-800">Por confirmar ({porConfirmar.length})</p>
            {porConfirmar.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-sm">
                  <b>{a.numero}</b> · {locName(a.location_id)} · <b>{money(a.monto_entregado)}</b>
                  <span className="block text-xs text-slate-600">Entregó {a.entregado_por} el {fmtDT(a.fecha_entrega)} · días {(a.dias || []).map((d) => fmtDay(d.fecha)).join(", ")}</span>
                </div>
                <Button size="sm" onClick={() => setConfirmando(a)} className="bg-amber-600 hover:bg-amber-700">Confirmar recepción</Button>
              </div>
            ))}
          </div>
        )}

        {faltantes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-red-700">Faltantes por revisar ({faltantes.length}) · {money(faltantes.reduce((s, a) => s + n(a.faltante), 0))}</p>
            {faltantes.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="text-sm">
                  <b>{a.numero}</b> · {locName(a.location_id)} · faltaron <b className="text-red-700">{money(a.faltante)}</b>
                  <span className="block text-xs text-slate-600">Entregó {a.entregado_por} · confirmó {a.confirmado_por} el {fmtDT(a.fecha_confirmacion)}{a.nota_recepcion ? ` · "${a.nota_recepcion}"` : ""}</span>
                </div>
                {canManage && <Button size="sm" variant="outline" className="text-red-700 border-red-300" onClick={() => revisarFaltante(a)}>Marcar revisado</Button>}
              </div>
            ))}
          </div>
        )}

        {actas.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay entregas registradas.</p>
        ) : (
          <div className="space-y-1.5">
            {lista.map((a) => {
              const e = ESTADOS[a.estado] || ESTADOS.pendiente;
              return (
                <details key={a.id} className="rounded-lg border border-slate-200 bg-white">
                  <summary className="cursor-pointer list-none p-2.5 flex flex-wrap items-center gap-2 text-sm">
                    <b>{a.numero}</b>
                    <span className="text-slate-600">{locName(a.location_id)}</span>
                    <span className="font-semibold">{money(a.monto_entregado)}</span>
                    <Badge className={`${e.cls} ml-auto`}><e.Icon className="w-3 h-3 mr-1" />{e.label}</Badge>
                  </summary>
                  <div className="px-3 pb-3 text-xs text-slate-700 space-y-1 border-t pt-2">
                    <p><b>Entregó:</b> {a.entregado_por} · {fmtDT(a.fecha_entrega)}</p>
                    <p><b>A:</b> {a.receptor}</p>
                    <p><b>Días:</b> {(a.dias || []).map((d) => `${fmtDay(d.fecha)} (${money(d.neto)})`).join(" · ")}</p>
                    <p><b>Esperado según el sistema:</b> {money(a.monto_esperado)} · <b>Entregado:</b> {money(a.monto_entregado)}
                      {n(a.diferencia_declarada) !== 0 && <span className="text-red-600"> (diferencia {money(a.diferencia_declarada)})</span>}</p>
                    {a.notas && <p><b>Nota de entrega:</b> {a.notas}</p>}
                    {(a.estado === "confirmada" || a.estado === "con_diferencia") && (
                      <p className={a.estado === "confirmada" ? "text-emerald-700" : "text-red-700"}>
                        <b>Recibido:</b> {money(a.monto_recibido)} por {a.confirmado_por} el {fmtDT(a.fecha_confirmacion)}
                        {n(a.diferencia_recepcion) !== 0 && ` · diferencia ${money(a.diferencia_recepcion)}`}
                        {a.nota_recepcion && ` · "${a.nota_recepcion}"`}
                      </p>
                    )}
                    {a.estado === "anulada" && <p className="text-slate-500">Anulada por {a.anulada_por} el {fmtDT(a.fecha_anulacion)}</p>}
                    {n(a.faltante) > 0 && (
                      <p className={a.faltante_revisado ? "text-slate-600" : "text-red-700 font-semibold"}>
                        Faltante {money(a.faltante)}: {a.faltante_revisado ? `revisado por ${a.faltante_revisado_por} el ${fmtDT(a.faltante_revisado_fecha)} · "${a.faltante_nota}"` : "pendiente de revisar"}
                      </p>
                    )}
                    {a.estado === "pendiente" && (a.entregado_por_id === currentUser?.id || currentUser?.role === "admin") && (
                      <button onClick={() => anular(a)} className="text-red-600 underline">Anular esta acta</button>
                    )}
                  </div>
                </details>
              );
            })}
            {actas.length > 8 && <button onClick={() => setVerTodas((v) => !v)} className="text-xs text-slate-500 underline">{verTodas ? "Ver menos" : `Ver todas (${actas.length})`}</button>}
          </div>
        )}
      </CardContent>

      {nueva && (
        <NuevaEntrega
          controls={controls} locations={locations} canManage={canManage} userLocation={userLocation}
          receptores={receptores.filter((r) => r.id !== currentUser?.id)}
          onClose={() => setNueva(false)}
          onDone={async () => { setNueva(false); await load(); onChanged?.(); }}
        />
      )}
      {confirmando && (
        <ConfirmarEntrega acta={confirmando} locName={locName} onClose={() => setConfirmando(null)}
          onDone={async () => { setConfirmando(null); await load(); onChanged?.(); }} />
      )}
    </Card>
  );
}

function NuevaEntrega({ controls, locations, canManage, userLocation, receptores, onClose, onDone }) {
  const [locId, setLocId] = useState(userLocation?.id || "");
  const [sel, setSel] = useState({});
  const [monto, setMonto] = useState("");
  const [receptor, setReceptor] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  const pendientes = useMemo(() => (controls || [])
    .filter((c) => c.location_id === locId && !c.cash_collected && !c.cash_shortage && c.entrega_estado !== "pendiente" && n(c.netCash) > 0)
    .sort((a, b) => String(a.control_date).localeCompare(String(b.control_date))), [controls, locId]);
  const elegidos = pendientes.filter((c) => sel[c.id]);
  const esperado = elegidos.reduce((s, c) => s + n(c.netCash), 0);
  const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }));

  const guardar = async () => {
    if (savingRef.current) return;
    if (!elegidos.length) { setError("Escoge los días que entregas."); return; }
    if (!receptor) { setError("Escoge a quién le entregas."); return; }
    const valor = monto === "" ? esperado : n(monto);
    const dif = Math.round(valor - esperado);
    if (dif !== 0 && !notas.trim()) { setError("Lo que entregas no coincide con lo esperado: escribe una nota explicando."); return; }
    if (!window.confirm(`¿Registrar entrega de ${money(valor)}${dif !== 0 ? ` (diferencia ${money(dif)})` : ""}?`)) return;
    savingRef.current = true; setSaving(true); setError("");
    try {
      await api("", "POST", { control_ids: elegidos.map((c) => c.id), monto_entregado: Math.round(valor), receptor_user_id: receptor, notas });
      onDone();
    } catch (e) { setError(e.message); }
    savingRef.current = false; setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Registrar entrega de efectivo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {canManage && !userLocation?.id && (
            <div className="space-y-1">
              <Label>Punto</Label>
              <select value={locId} onChange={(e) => { setLocId(e.target.value); setSel({}); }} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Selecciona…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Días que entregas</Label>
            {pendientes.length === 0 ? <p className="text-sm text-slate-500">No hay días pendientes de entregar.</p> : (
              <div className="max-h-56 overflow-y-auto space-y-1">
                {pendientes.map((c) => (
                  <label key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm cursor-pointer">
                    <span className="flex items-center gap-2"><input type="checkbox" checked={!!sel[c.id]} onChange={() => toggle(c.id)} /> {fmtDay(c.control_date)}</span>
                    <b>{money(c.netCash)}</b>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 border p-3 text-sm flex justify-between"><span>Esperado según el sistema</span><b>{money(esperado)}</b></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor que entregas</Label>
              <Input type="number" min="0" step="1" placeholder={String(Math.round(esperado))} value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Le entregas a</Label>
              <select value={receptor} onChange={(e) => setReceptor(e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Selecciona…</option>
                {receptores.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Nota</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Obligatoria si el valor no coincide" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Registrar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmarEntrega({ acta, locName, onClose, onDone }) {
  const [recibido, setRecibido] = useState(String(Math.round(n(acta.monto_entregado))));
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dif = Math.round(n(recibido) - n(acta.monto_entregado));

  const guardar = async () => {
    if (dif !== 0 && !nota.trim()) { setError("Hay diferencia: escribe una nota."); return; }
    setSaving(true); setError("");
    try { await api(`/${acta.id}/confirmar`, "POST", { monto_recibido: n(recibido), nota }); onDone(); }
    catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Confirmar recepción · {acta.numero}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p>{locName(acta.location_id)} · entregó <b>{acta.entregado_por}</b> el {fmtDT(acta.fecha_entrega)}</p>
          <p>Días: {(acta.dias || []).map((d) => fmtDay(d.fecha)).join(", ")}</p>
          <div className="rounded-lg bg-slate-50 border p-3 flex justify-between"><span>Declaró entregar</span><b>{money(acta.monto_entregado)}</b></div>
          <div className="space-y-1">
            <Label>¿Cuánto recibiste? (cuenta el dinero)</Label>
            <Input type="number" min="0" step="1" value={recibido} onChange={(e) => setRecibido(e.target.value)} />
          </div>
          {dif !== 0 && <p className="text-red-600 font-semibold">Diferencia: {money(dif)}</p>}
          <div className="space-y-1">
            <Label>Nota {dif !== 0 ? "*" : ""}</Label>
            <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder={dif !== 0 ? "Explica la diferencia" : "Opcional"} />
          </div>
          {error && <p className="text-red-600">{error}</p>}
          <p className="text-xs text-slate-500">Al confirmar, esos días quedan como "Recogido" y el acta ya no se puede modificar.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving} className={dif === 0 ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} {dif === 0 ? "Confirmar: coincide" : "Confirmar con diferencia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
