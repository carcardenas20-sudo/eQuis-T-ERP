import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useSession } from "@/components/providers/SessionProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, X, Save, Loader2, History, SlidersHorizontal, Layers } from "lucide-react";

// Rollos de tela: la materia prima principal se controla rollo por rollo.
// Cada rollo tiene código (R-0001, lo asigna el servidor), metros y kilos.
// Los cortes/tendidos descontarán metros de aquí (fase 2).

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const n = (v) => Number(v) || 0;
const fmtNum = (v, d = 1) => n(v).toLocaleString("es-CO", { maximumFractionDigits: d });
const money = (v) => `$${Math.round(n(v)).toLocaleString("es-CO")}`;
const fmtDay = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const emptyRow = () => ({ key: Math.random().toString(36).slice(2), metros: "", kilos: "" });

function IngresoRollos({ telas, colores, onSaved, onCancel }) {
  const [materiaId, setMateriaId] = useState("");
  const [colorId, setColorId] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [fecha, setFecha] = useState(today());
  const [origen, setOrigen] = useState("compra");
  const [unidadCompra, setUnidadCompra] = useState("metros");
  const [precio, setPrecio] = useState("");
  const [rows, setRows] = useState([emptyRow()]);
  const [bulk, setBulk] = useState({ cantidad: "", metros: "", kilos: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  const tela = telas.find((t) => t.id === materiaId);
  const color = colores.find((c) => c.id === colorId);
  const valid = rows.filter((r) => n(r.metros) > 0);
  const totMetros = valid.reduce((s, r) => s + n(r.metros), 0);
  const totKilos = valid.reduce((s, r) => s + n(r.kilos), 0);
  const costoTotal = unidadCompra === "kilos" ? totKilos * n(precio) : totMetros * n(precio);

  const setRow = (key, field, value) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const addBulk = () => {
    const cant = Math.round(n(bulk.cantidad));
    if (cant <= 0 || n(bulk.metros) <= 0) return;
    const nuevos = Array.from({ length: cant }, () => ({ ...emptyRow(), metros: bulk.metros, kilos: bulk.kilos }));
    setRows((rs) => [...rs.filter((r) => n(r.metros) > 0 || n(r.kilos) > 0), ...nuevos]);
    setBulk({ cantidad: "", metros: "", kilos: "" });
  };

  const save = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (!tela) { setError("Elige la tela."); return; }
    if (!color) { setError("Elige el color."); return; }
    if (!valid.length) { setError("Agrega al menos un rollo con sus metros."); return; }
    if (unidadCompra === "kilos" && valid.some((r) => n(r.kilos) <= 0)) {
      setError("Esta tela se paga por kilo: escribe los kilos de cada rollo."); return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const creados = [];
      for (const r of valid) {
        const metros = n(r.metros);
        const kilos = n(r.kilos);
        const costo = unidadCompra === "kilos" ? kilos * n(precio) : metros * n(precio);
        const rollo = await base44.entities.RolloTela.create({
          materia_prima_id: tela.id,
          materia_prima_nombre: tela.nombre,
          color_id: color.id,
          color_nombre: color.nombre,
          proveedor: proveedor.trim(),
          fecha_ingreso: fecha,
          origen,
          unidad_compra: unidadCompra,
          precio_unidad_compra: n(precio),
          metros_iniciales: metros,
          metros_disponibles: metros,
          kilos_iniciales: kilos,
          costo_total: Math.round(costo),
          costo_por_metro: metros > 0 ? Math.round(costo / metros) : 0,
          estado: "disponible",
          movimientos: [{
            fecha, tipo: "entrada", metros,
            nota: origen === "saldo_inicial" ? "Saldo inicial" : `Compra${proveedor.trim() ? ` a ${proveedor.trim()}` : ""}`,
          }],
        });
        creados.push(rollo);
      }
      onSaved(creados);
    } catch (err) {
      setError("No se pudieron guardar los rollos: " + (err.message || err));
    }
    savingRef.current = false;
    setSaving(false);
  };

  return (
    <Card className="border-indigo-200">
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={save} className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-lg text-slate-900">Ingresar rollos</p>
            <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Tela *</Label>
              <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Selecciona…</option>
                {telas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Color *</Label>
              <select value={colorId} onChange={(e) => setColorId(e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Selecciona…</option>
                {colores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de ingreso</Label>
              <Input type="date" value={fecha} max={today()} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Origen</Label>
              <select value={origen} onChange={(e) => setOrigen(e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="compra">Compra</option>
                <option value="saldo_inicial">Saldo inicial (lo que ya hay)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label>Se paga por</Label>
              <div className="flex gap-2">
                <select value={unidadCompra} onChange={(e) => setUnidadCompra(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm">
                  <option value="metros">Metro</option>
                  <option value="kilos">Kilo</option>
                </select>
                <Input type="number" min="0" step="1" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder={`Precio por ${unidadCompra === "kilos" ? "kilo" : "metro"}`} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-2">
            <p className="text-sm font-semibold text-slate-700">Agregar varios rollos iguales</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label className="text-xs">Cantidad</Label><Input type="number" min="1" step="1" className="w-24" value={bulk.cantidad} onChange={(e) => setBulk({ ...bulk, cantidad: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Metros c/u</Label><Input type="number" min="0" step="any" className="w-28" value={bulk.metros} onChange={(e) => setBulk({ ...bulk, metros: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Kilos c/u</Label><Input type="number" min="0" step="any" className="w-28" value={bulk.kilos} onChange={(e) => setBulk({ ...bulk, kilos: e.target.value })} /></div>
              <Button type="button" variant="outline" onClick={addBulk}><Plus className="w-4 h-4 mr-1" /> Agregar</Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Rollos ({valid.length})</p>
            {rows.map((r, i) => (
              <div key={r.key} className="flex items-center gap-2">
                <span className="w-8 text-xs text-slate-400 text-right">{i + 1}</span>
                <Input type="number" min="0" step="any" className="w-32" placeholder="Metros" value={r.metros} onChange={(e) => setRow(r.key, "metros", e.target.value)} />
                <Input type="number" min="0" step="any" className="w-32" placeholder="Kilos" value={r.kilos} onChange={(e) => setRow(r.key, "kilos", e.target.value)} />
                <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [emptyRow()]))} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, emptyRow()])}><Plus className="w-4 h-4 mr-1" /> Otro rollo</Button>
          </div>

          <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-sm text-indigo-900">
            <b>{valid.length}</b> rollo{valid.length !== 1 ? "s" : ""}{tela ? ` de ${tela.nombre}` : ""}{color ? ` ${color.nombre}` : ""} ·{" "}
            <b>{fmtNum(totMetros)} m</b>{totKilos > 0 ? <> · <b>{fmtNum(totKilos)} kg</b></> : null}
            {n(precio) > 0 && <> · Costo: <b>{money(costoTotal)}</b>{totMetros > 0 ? ` (${money(costoTotal / totMetros)}/m)` : ""}</>}
            <p className="text-xs text-indigo-700 mt-1">El sistema asigna el código a cada rollo (R-0001, R-0002…) para escribirlo en el rollo físico.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar rollos
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Prod_Rollos() {
  const { isRealAdmin } = useSession();
  const [rollos, setRollos] = useState([]);
  const [telas, setTelas] = useState([]);
  const [colores, setColores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [recienCreados, setRecienCreados] = useState(null);
  const [q, setQ] = useState("");
  const [fTela, setFTela] = useState("all");
  const [fEstado, setFEstado] = useState("disponible");
  const [openId, setOpenId] = useState(null);
  const [ajuste, setAjuste] = useState(null); // { rollo, metros, nota }

  const load = async () => {
    setLoading(true);
    try {
      const [rs, mps, cs] = await Promise.all([
        base44.entities.RolloTela.list("-created_date", 5000),
        base44.entities.MateriaPrima.list("nombre", 500),
        base44.entities.Color.list("nombre", 500),
      ]);
      setRollos(rs || []);
      setTelas((mps || []).filter((m) => m.tipo_material === "tela"));
      setColores((cs || []).filter((c) => c.activo !== false));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Resumen por tela + color (solo rollos con metros disponibles)
  const resumen = useMemo(() => {
    const map = {};
    for (const r of rollos) {
      if (n(r.metros_disponibles) <= 0) continue;
      const k = `${r.materia_prima_nombre}|${r.color_nombre}`;
      if (!map[k]) map[k] = { tela: r.materia_prima_nombre, color: r.color_nombre, rollos: 0, metros: 0, kilos: 0, valor: 0 };
      map[k].rollos += 1;
      map[k].metros += n(r.metros_disponibles);
      map[k].kilos += n(r.metros_iniciales) > 0 ? n(r.kilos_iniciales) * (n(r.metros_disponibles) / n(r.metros_iniciales)) : 0;
      map[k].valor += n(r.metros_disponibles) * n(r.costo_por_metro);
    }
    return Object.values(map).sort((a, b) => (a.tela + a.color).localeCompare(b.tela + b.color));
  }, [rollos]);

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rollos.filter((r) =>
      (fTela === "all" || r.materia_prima_id === fTela) &&
      (fEstado === "all" || (fEstado === "disponible" ? n(r.metros_disponibles) > 0 : n(r.metros_disponibles) <= 0)) &&
      (!s || `${r.codigo} ${r.color_nombre} ${r.materia_prima_nombre} ${r.proveedor || ""}`.toLowerCase().includes(s))
    );
  }, [rollos, q, fTela, fEstado]);

  const guardarAjuste = async () => {
    const r = ajuste.rollo;
    const nuevo = n(ajuste.metros);
    if (nuevo < 0) return;
    const delta = nuevo - n(r.metros_disponibles);
    if (Math.abs(delta) < 0.001) { setAjuste(null); return; }
    if (!ajuste.nota.trim()) { alert("Escribe el motivo del ajuste."); return; }
    const updated = await base44.entities.RolloTela.update(r.id, {
      metros_disponibles: nuevo,
      estado: nuevo > 0 ? "disponible" : "agotado",
      movimientos: [...(r.movimientos || []), { fecha: today(), tipo: "ajuste", metros: delta, nota: ajuste.nota.trim() }],
    });
    setRollos((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...updated } : x)));
    setAjuste(null);
  };

  const eliminar = async (r) => {
    const usado = (r.movimientos || []).some((m) => m.tipo !== "entrada");
    if (usado) { alert("Este rollo ya tiene consumos o ajustes; no se puede eliminar. Usa 'Ajustar' si hay un error."); return; }
    if (!window.confirm(`¿Eliminar el rollo ${r.codigo}? (solo si se registró por error)`)) return;
    await base44.entities.RolloTela.delete(r.id);
    setRollos((rs) => rs.filter((x) => x.id !== r.id));
  };

  const totalMetros = resumen.reduce((s, x) => s + x.metros, 0);
  const totalRollos = resumen.reduce((s, x) => s + x.rollos, 0);

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-7 h-7 text-indigo-600" /> Rollos de tela
            </h1>
            <p className="text-sm text-slate-600 mt-1">{totalRollos} rollos disponibles · {fmtNum(totalMetros)} m en total</p>
          </div>
          {!showForm && (
            <Button onClick={() => { setShowForm(true); setRecienCreados(null); }} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Ingresar rollos
            </Button>
          )}
        </div>

        {showForm && (
          <IngresoRollos
            telas={telas}
            colores={colores}
            onCancel={() => setShowForm(false)}
            onSaved={(creados) => { setShowForm(false); setRecienCreados(creados); load(); }}
          />
        )}

        {recienCreados && (
          <Card className="border-emerald-300 bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-emerald-800">✓ {recienCreados.length} rollo{recienCreados.length !== 1 ? "s" : ""} guardado{recienCreados.length !== 1 ? "s" : ""}. Escribe estos códigos en los rollos:</p>
                <button onClick={() => setRecienCreados(null)} className="text-emerald-700"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {recienCreados.map((r) => (
                  <span key={r.id} className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 font-mono font-bold text-emerald-900">
                    {r.codigo} <span className="font-sans font-normal text-xs text-slate-500">· {fmtNum(r.metros_iniciales)} m</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumen por tela y color */}
        {resumen.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {resumen.map((x) => (
              <Card key={`${x.tela}|${x.color}`}>
                <CardContent className="p-3">
                  <p className="text-xs text-slate-500">{x.tela}</p>
                  <p className="font-bold text-slate-900">{x.color}</p>
                  <p className="text-sm text-slate-700 mt-1"><b>{x.rollos}</b> rollo{x.rollos !== 1 ? "s" : ""} · <b>{fmtNum(x.metros)} m</b>{x.kilos > 0 ? ` · ${fmtNum(x.kilos)} kg` : ""}</p>
                  {x.valor > 0 && <p className="text-xs text-slate-500">Valor: {money(x.valor)}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filtros */}
        <Card>
          <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9" placeholder="Código, color, proveedor…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select value={fTela} onChange={(e) => setFTela(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="all">Todas las telas</option>
              {telas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="disponible">Con metros disponibles</option>
              <option value="agotado">Agotados</option>
              <option value="all">Todos</option>
            </select>
          </CardContent>
        </Card>

        {/* Lista de rollos */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
        ) : filtrados.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-slate-500">No hay rollos {fEstado === "disponible" ? "disponibles" : ""} con ese filtro.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtrados.map((r) => {
              const pct = n(r.metros_iniciales) > 0 ? Math.max(0, Math.min(100, (n(r.metros_disponibles) / n(r.metros_iniciales)) * 100)) : 0;
              const open = openId === r.id;
              return (
                <Card key={r.id} className={n(r.metros_disponibles) <= 0 ? "opacity-70" : ""}>
                  <CardContent className="p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono font-bold text-indigo-700 w-20">{r.codigo || "—"}</span>
                      <div className="flex-1 min-w-[160px]">
                        <p className="font-semibold text-slate-900">{r.materia_prima_nombre} · {r.color_nombre}</p>
                        <p className="text-xs text-slate-500">
                          {fmtDay(r.fecha_ingreso)}{r.proveedor ? ` · ${r.proveedor}` : ""}
                          {r.origen === "saldo_inicial" && <Badge className="ml-2 bg-slate-100 text-slate-600 text-[10px]">Saldo inicial</Badge>}
                        </p>
                      </div>
                      <div className="w-40">
                        <p className="text-sm text-right"><b>{fmtNum(r.metros_disponibles)}</b> / {fmtNum(r.metros_iniciales)} m</p>
                        <div className="h-1.5 bg-slate-200 rounded mt-1 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
                        {n(r.kilos_iniciales) > 0 && <p className="text-[11px] text-slate-400 text-right mt-0.5">{fmtNum(r.kilos_iniciales)} kg</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" title="Historial" onClick={() => setOpenId(open ? null : r.id)}><History className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" title="Ajustar metros" onClick={() => setAjuste({ rollo: r, metros: String(n(r.metros_disponibles)), nota: "" })}><SlidersHorizontal className="w-4 h-4" /></Button>
                        {isRealAdmin && <Button size="sm" variant="ghost" title="Eliminar" className="text-slate-400 hover:text-red-600" onClick={() => eliminar(r)}><Trash2 className="w-4 h-4" /></Button>}
                      </div>
                    </div>

                    {ajuste?.rollo.id === r.id && (
                      <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-wrap items-end gap-2">
                        <div className="space-y-1"><Label className="text-xs">Metros disponibles reales</Label><Input type="number" min="0" step="any" className="w-32" value={ajuste.metros} onChange={(e) => setAjuste({ ...ajuste, metros: e.target.value })} /></div>
                        <div className="space-y-1 flex-1 min-w-[180px]"><Label className="text-xs">Motivo *</Label><Input value={ajuste.nota} onChange={(e) => setAjuste({ ...ajuste, nota: e.target.value })} placeholder="Ej: medición real, merma, error de digitación" /></div>
                        <Button size="sm" onClick={guardarAjuste} className="bg-amber-600 hover:bg-amber-700">Guardar ajuste</Button>
                        <Button size="sm" variant="outline" onClick={() => setAjuste(null)}>Cancelar</Button>
                      </div>
                    )}

                    {open && (
                      <div className="mt-3 border-t pt-2 space-y-1">
                        {(r.movimientos || []).length === 0 && <p className="text-xs text-slate-400">Sin movimientos.</p>}
                        {(r.movimientos || []).map((m, i) => (
                          <p key={i} className="text-xs text-slate-600">
                            • {fmtDay(m.fecha)} — {m.tipo === "entrada" ? "Entrada" : m.tipo === "consumo" ? "Consumo" : "Ajuste"}{" "}
                            <b className={n(m.metros) < 0 || m.tipo === "consumo" ? "text-red-600" : "text-emerald-700"}>
                              {n(m.metros) > 0 && m.tipo !== "consumo" ? "+" : ""}{fmtNum(m.tipo === "consumo" ? -Math.abs(n(m.metros)) : m.metros)} m
                            </b>
                            {m.nota ? ` · ${m.nota}` : ""}
                          </p>
                        ))}
                        {n(r.costo_por_metro) > 0 && <p className="text-[11px] text-slate-400 pt-1">Costo: {money(r.costo_total)} ({money(r.costo_por_metro)}/m · se pagó por {r.unidad_compra === "kilos" ? "kilo" : "metro"})</p>}
                      </div>
                    )}
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
