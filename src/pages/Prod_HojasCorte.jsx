import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { getToken, getActiveCompany } from "@/api/localClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Scissors, Plus, Trash2, X, Save, Loader2, Search, Ban } from "lucide-react";
import { computeTraceability } from "@/utils/trazabilidad";

// Flujo de una hoja: cortado → en bodega → con operarios → entregado → en locales.
function Trazabilidad({ t, empName }) {
  if (!t) return null;
  const despachado = Object.values(t.despachos).reduce((s, q) => s + q, 0);
  const bodega = Math.max(0, t.cortado - despachado);
  const conOperarios = Math.max(0, despachado - t.entregado);
  const pasos = [
    { label: "Cortado", v: t.cortado, cls: "bg-blue-50 text-blue-800 border-blue-200" },
    { label: "En bodega (sin despachar)", v: bodega, cls: "bg-slate-50 text-slate-700 border-slate-200" },
    { label: "Con operarios", v: conOperarios, cls: "bg-amber-50 text-amber-800 border-amber-200" },
    { label: "Entregado", v: t.entregado, cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    { label: "En locales", v: t.enLocales, cls: "bg-purple-50 text-purple-800 border-purple-200" },
  ];
  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {pasos.map((p) => (
          <div key={p.label} className={`rounded-lg border px-2 py-1.5 ${p.cls}`}>
            <p className="text-[10px] leading-tight">{p.label}</p>
            <p className="font-bold tabular-nums">{fmt(p.v, 0)}</p>
          </div>
        ))}
      </div>
      {Object.keys(t.despachos).length > 0 && (
        <p className="text-xs text-slate-600">
          Despachado a: {Object.entries(t.despachos).map(([e, q]) => `${empName(e)} (${fmt(q, 0)})`).join(" · ")}
        </p>
      )}
    </div>
  );
}

// Hojas de corte: el cortador registra referencias (tallas y cantidades) y los rollos
// usados (hojas y metros que QUEDARON). Al guardar: se descuenta la tela y las unidades
// quedan en el inventario de producción, listas para despachar a operarios.

const n = (v) => Number(v) || 0;
const fmt = (v, d = 1) => n(v).toLocaleString("es-CO", { maximumFractionDigits: d });
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const fmtDay = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const uid = () => Math.random().toString(36).slice(2);
const emptyRef = () => ({ key: uid(), reference: "", sizes: [{ key: uid(), size: "", quantity: "" }] });
const emptyRoll = () => ({ key: uid(), rollo_id: "", hojas: "", sobrante_metros: "", puntas: "" });

async function api(path, body) {
  const token = getToken();
  const company = getActiveCompany();
  const res = await fetch(`/api/hojas-corte${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(company ? { "X-Company-Id": company } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
  return d;
}

function NuevaHoja({ productos, rollos, onSaved, onCancel }) {
  const [fecha, setFecha] = useState(today());
  const [refs, setRefs] = useState([emptyRef()]);
  const [rolls, setRolls] = useState([emptyRoll()]);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  const productoDe = (ref) => productos.find((p) => String(p.reference || "").toUpperCase() === String(ref || "").trim().toUpperCase());
  const totalUnidades = refs.reduce((s, r) => s + r.sizes.reduce((a, x) => a + n(x.quantity), 0), 0);
  const usados = new Set(rolls.map((r) => r.rollo_id).filter(Boolean));
  const rolloDe = (id) => rollos.find((r) => r.id === id);
  const gastoDe = (r) => {
    const ro = rolloDe(r.rollo_id);
    return ro && r.sobrante_metros !== "" ? Math.max(0, n(ro.metros_disponibles) - n(r.sobrante_metros)) : null;
  };
  const totalMetros = rolls.reduce((s, r) => s + (gastoDe(r) || 0), 0);
  const totalHojas = rolls.reduce((s, r) => s + n(r.hojas), 0);

  const updRef = (key, fn) => setRefs((rs) => rs.map((r) => (r.key === key ? fn(r) : r)));
  const updRoll = (key, field, value) => setRolls((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const guardar = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (totalUnidades <= 0) { setError("Agrega al menos una referencia con tallas y cantidades."); return; }
    const sinDato = rolls.find((r) => r.rollo_id && r.sobrante_metros === "");
    if (sinDato) { setError("Escribe cuántos metros quedaron en cada rollo (0 si se terminó)."); return; }
    const rolloMalo = rolls.find((r) => r.rollo_id && n(r.sobrante_metros) > n(rolloDe(r.rollo_id)?.metros_disponibles));
    if (rolloMalo) { setError(`El rollo ${rolloDe(rolloMalo.rollo_id)?.codigo} no tenía tantos metros.`); return; }
    if (!rolls.some((r) => r.rollo_id) && !window.confirm("No escogiste rollos. ¿Guardar la hoja SIN descontar tela?")) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const d = await api("", {
        fecha,
        notas,
        referencias: refs.map((r) => ({
          reference: r.reference,
          product_name: productoDe(r.reference)?.nombre || "",
          sizes: r.sizes.map((s) => ({ size: s.size, quantity: n(s.quantity) })),
        })),
        rollos: rolls.filter((r) => r.rollo_id).map((r) => ({
          rollo_id: r.rollo_id, hojas: n(r.hojas), sobrante_metros: n(r.sobrante_metros), puntas: r.puntas,
        })),
      });
      onSaved(d);
    } catch (err) {
      setError(err.message);
    }
    savingRef.current = false;
    setSaving(false);
  };

  return (
    <Card className="border-blue-200">
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={guardar} className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-lg text-slate-900">Nueva hoja de corte</p>
            <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="w-48 space-y-1.5">
            <Label>Fecha de corte</Label>
            <Input type="date" value={fecha} max={today()} onChange={(e) => setFecha(e.target.value)} />
          </div>

          {/* Referencias y tallas */}
          <div className="space-y-3">
            <p className="font-semibold text-slate-800">Referencias cortadas</p>
            <datalist id="refs-produccion">
              {productos.map((p) => <option key={p.id} value={p.reference}>{p.nombre}</option>)}
            </datalist>
            {refs.map((r) => {
              const prod = productoDe(r.reference);
              const tot = r.sizes.reduce((a, x) => a + n(x.quantity), 0);
              return (
                <div key={r.key} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input list="refs-produccion" className="w-40 uppercase" placeholder="Referencia" value={r.reference}
                      onChange={(e) => updRef(r.key, (x) => ({ ...x, reference: e.target.value.toUpperCase() }))} />
                    <span className="text-sm text-slate-600 flex-1">{prod ? prod.nombre : r.reference ? <span className="text-amber-700">Referencia nueva</span> : ""}</span>
                    <span className="text-sm font-semibold">{tot} und</span>
                    <button type="button" onClick={() => setRefs((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [emptyRef()]))} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.sizes.map((s) => (
                      <div key={s.key} className="flex items-center gap-1 bg-white rounded-md border border-slate-200 px-2 py-1">
                        <input className="w-12 text-sm uppercase outline-none" placeholder="Talla" value={s.size}
                          onChange={(e) => updRef(r.key, (x) => ({ ...x, sizes: x.sizes.map((y) => (y.key === s.key ? { ...y, size: e.target.value.toUpperCase() } : y)) }))} />
                        <input className="w-14 text-sm outline-none border-l pl-1" type="number" min="0" placeholder="Cant." value={s.quantity}
                          onChange={(e) => updRef(r.key, (x) => ({ ...x, sizes: x.sizes.map((y) => (y.key === s.key ? { ...y, quantity: e.target.value } : y)) }))} />
                        <button type="button" className="text-slate-300 hover:text-red-500"
                          onClick={() => updRef(r.key, (x) => ({ ...x, sizes: x.sizes.length > 1 ? x.sizes.filter((y) => y.key !== s.key) : x.sizes }))}><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    <Button type="button" size="sm" variant="ghost" onClick={() => updRef(r.key, (x) => ({ ...x, sizes: [...x.sizes, { key: uid(), size: "", quantity: "" }] }))}>+ talla</Button>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => setRefs((rs) => [...rs, emptyRef()])}><Plus className="w-4 h-4 mr-1" /> Otra referencia</Button>
          </div>

          {/* Rollos usados */}
          <div className="space-y-2">
            <p className="font-semibold text-slate-800">Rollos usados</p>
            <p className="text-xs text-slate-500">Escoge cada rollo, las hojas tendidas y cuántos metros <b>quedaron</b> (0 si se terminó).</p>
            {rolls.map((r) => {
              const gasto = gastoDe(r);
              return (
                <div key={r.key} className="flex flex-wrap items-center gap-2">
                  <select value={r.rollo_id} onChange={(e) => updRoll(r.key, "rollo_id", e.target.value)}
                    className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm flex-1 min-w-[220px]">
                    <option value="">Escoge rollo…</option>
                    {rollos.filter((o) => o.id === r.rollo_id || !usados.has(o.id)).map((o) => (
                      <option key={o.id} value={o.id}>{o.codigo} · {o.materia_prima_nombre} {o.color_nombre} · {fmt(o.metros_disponibles)} m</option>
                    ))}
                  </select>
                  <Input type="number" min="0" className="w-24" placeholder="Hojas" value={r.hojas} onChange={(e) => updRoll(r.key, "hojas", e.target.value)} />
                  <Input type="number" min="0" step="any" className="w-28" placeholder="Quedó (m)" value={r.sobrante_metros} onChange={(e) => updRoll(r.key, "sobrante_metros", e.target.value)} />
                  <Input className="w-28" placeholder="Puntas" value={r.puntas} onChange={(e) => updRoll(r.key, "puntas", e.target.value)} />
                  {gasto !== null && <span className="text-xs text-slate-600">gastó <b>{fmt(gasto)} m</b></span>}
                  <button type="button" onClick={() => setRolls((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [emptyRoll()]))} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
            {rollos.length === 0 && <p className="text-xs text-amber-700">No hay rollos disponibles. Cárgalos en Materiales → Rollos de Tela.</p>}
            <Button type="button" variant="ghost" size="sm" onClick={() => setRolls((rs) => [...rs, emptyRoll()])}><Plus className="w-4 h-4 mr-1" /> Otro rollo</Button>
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
          </div>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900">
            <b>{totalUnidades}</b> unidades · <b>{totalHojas}</b> hojas · <b>{fmt(totalMetros)} m</b> de tela.
            <span className="block text-xs text-blue-700 mt-0.5">Al guardar, las unidades quedan disponibles para despachar a operarios y la tela se descuenta de los rollos.</span>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar hoja
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Prod_HojasCorte() {
  const [hojas, setHojas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [rollos, setRollos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [traza, setTraza] = useState({});
  const [empleados, setEmpleados] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [hs, ps, rs] = await Promise.all([
        base44.entities.HojaCorte.list("-created_date", 2000),
        base44.entities.Producto.list("nombre", 2000),
        base44.entities.RolloTela.filter({ estado: "disponible" }),
      ]);
      setHojas(hs || []);
      setProductos((ps || []).filter((p) => p.reference));
      setRollos((rs || []).filter((r) => n(r.metros_disponibles) > 0));
      // Trazabilidad (se calcula a partir de despachos y entregas; solo lectura)
      if ((hs || []).length) {
        const [ds, dls, inv, emps] = await Promise.all([
          base44.entities.Dispatch.list("dispatch_date", 20000).catch(() => []),
          base44.entities.Delivery.list("delivery_date", 20000).catch(() => []),
          base44.entities.Inventory.list().catch(() => []),
          base44.entities.Employee.list().catch(() => []),
        ]);
        const stockByRef = {};
        for (const i of inv || []) {
          if (i.product_id || !i.product_reference) continue;
          const k = String(i.product_reference).toUpperCase();
          stockByRef[k] = (stockByRef[k] || 0) + n(i.current_stock);
        }
        setTraza(computeTraceability({ hojas: hs, dispatches: ds, deliveries: dls, stockByRef }));
        setEmpleados(emps || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtradas = useMemo(() => {
    const s = q.trim().toUpperCase();
    return hojas.filter((h) =>
      (!fFecha || String(h.fecha).slice(0, 10) === fFecha) &&
      (!s || String(h.numero || "").toUpperCase().includes(s) || (h.referencias || []).some((r) => String(r.reference).includes(s)))
    );
  }, [hojas, q, fFecha]);

  const anular = async (h) => {
    const motivo = window.prompt(`¿Anular la hoja ${h.numero}? La tela vuelve a los rollos y las unidades salen del inventario de producción.\n\nMotivo:`);
    if (motivo === null) return;
    try {
      await api(`/${h.id}/anular`, { motivo });
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Scissors className="w-7 h-7 text-blue-600" /> Hojas de corte
          </h1>
          {!showForm && <Button onClick={() => { setShowForm(true); setMsg(""); }} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Nueva hoja</Button>}
        </div>

        {showForm && (
          <NuevaHoja productos={productos} rollos={rollos} onCancel={() => setShowForm(false)}
            onSaved={(d) => { setShowForm(false); setMsg(`✓ Hoja ${d.numero} guardada: ${d.total_unidades} unidades listas para despachar.`); load(); }} />
        )}
        {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}

        <Card>
          <CardContent className="p-3 grid sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9" placeholder="Número o referencia…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} />
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : filtradas.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-slate-500">No hay hojas de corte.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtradas.map((h) => {
              const anulada = h.estado === "anulada";
              return (
                <Card key={h.id} className={anulada ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900">
                          {h.numero} · {(h.referencias || []).map((r) => r.reference).join(", ")}
                          {anulada && <Badge className="ml-2 bg-red-100 text-red-700">Anulada</Badge>}
                        </p>
                        <p className="text-xs text-slate-500">Corte {fmtDay(h.fecha)} · registró {h.registrado_por || "—"}</p>
                      </div>
                      {!anulada && <Button size="sm" variant="outline" className="text-red-600" onClick={() => anular(h)}><Ban className="w-4 h-4 mr-1" /> Anular</Button>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge className="bg-blue-100 text-blue-800">{fmt(h.total_unidades, 0)} unidades</Badge>
                      <Badge className="bg-purple-100 text-purple-800">{(h.rollos_usados || []).length} rollos · {fmt(h.total_hojas, 0)} hojas</Badge>
                      <Badge className="bg-slate-100 text-slate-700">{fmt(h.total_metros_gastados)} m{n(h.total_kilos_gastados) > 0 ? ` · ${fmt(h.total_kilos_gastados)} kg` : ""}</Badge>
                      {h.colores && <Badge className="bg-amber-100 text-amber-800">{h.colores}</Badge>}
                    </div>
                    {!anulada && <Trazabilidad t={traza[h.id]} empName={(id) => empleados.find((e) => e.employee_id === id)?.name || id} />}
                    <details className="mt-3">
                      <summary className="text-sm text-slate-600 cursor-pointer">Ver detalle</summary>
                      <div className="mt-2 space-y-2 text-sm">
                        {(h.referencias || []).map((r, i) => (
                          <p key={i}><b>{r.reference}</b>{r.product_name ? ` ${r.product_name}` : ""}: {(r.sizes || []).map((s) => `${s.size}: ${s.quantity}`).join(" · ")} = <b>{r.total}</b></p>
                        ))}
                        {(h.rollos_usados || []).map((u, i) => (
                          <p key={i} className="text-xs text-slate-600">🧵 {u.codigo} {u.tela} {u.color} — {u.hojas} hojas · gastó {fmt(u.metros_gastados)} m · quedó {fmt(u.metros_sobrante)} m{u.puntas ? ` · puntas: ${u.puntas}` : ""}</p>
                        ))}
                        {h.notas && <p className="text-xs text-slate-500">Notas: {h.notas}</p>}
                        {anulada && <p className="text-xs text-red-600">Anulada el {fmtDay(h.fecha_anulacion)} por {h.anulada_por}{h.motivo_anulacion ? `: ${h.motivo_anulacion}` : ""}</p>}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
