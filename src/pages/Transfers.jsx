import React, { useState, useEffect, useCallback } from "react";
import { Inventory, Product, Location, User } from "@/entities/all";
import { localClient } from "@/api/localClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRightLeft, Package, History, Loader2, Plus, X, Building2, InboxIcon, Send, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import TransferHistory from "../components/transfers/TransferHistory";
import TransferReceive from "../components/transfers/TransferReceive";

const Traslado = localClient.entities.Traslado;

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "2-digit" });
}

const ESTADO_CFG = {
  pendiente:  { label: "Pendiente",  color: "bg-amber-100 text-amber-700" },
  aceptado:   { label: "Aceptado",   color: "bg-green-100 text-green-700" },
  rechazado:  { label: "Rechazado",  color: "bg-red-100 text-red-600" },
};

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState("enviar");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [traslados, setTraslados] = useState([]);
  const [receivingId, setReceivingId] = useState(null);

  const [form, setForm] = useState(/** @type {{origen:string,destino:string,notas:string,items:any[],lonas:any[]}} */
    ({ origen: "", destino: "", notas: "", items: [], lonas: [] }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [user, locs, prods, tras] = await Promise.all([
        User.me(),
        Location.filter({ is_active: true }),
        Product.filter({ is_active: true }),
        Traslado.list("-created_date"),
      ]);
      setCurrentUser(user);
      setLocations(locs || []);
      setProducts(prods || []);
      setTraslados(tras || []);
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Pendientes para este usuario ──────────────────────────────────────────
  const myLocationIds = currentUser?.location_id
    ? [currentUser.location_id]
    : locations.map(l => l.id);

  const pendientesRecibir = traslados.filter(t =>
    t.estado === "pendiente" && myLocationIds.includes(t.destino_location_id)
  );
  const pendientesEnviar = traslados.filter(t =>
    t.estado === "pendiente" && myLocationIds.includes(t.origen_location_id)
  );
  const historialTraslados = traslados.filter(t => t.estado === "aceptado" || t.estado === "rechazado");

  // ── Helpers del formulario ────────────────────────────────────────────────
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_id: "", nombre: "", cantidad: "" }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === "product_id") {
        const prod = products.find(p => p.id === value || p.sku === value);
        items[idx].nombre = prod?.name || "";
      }
      return { ...f, items };
    });
  };

  const nextNumero = () => {
    const nums = traslados.map(t => parseInt((t.numero_traslado || "").replace(/\D/g, "")) || 0);
    return "TRA-" + String(Math.max(0, ...nums) + 1).padStart(4, "0");
  };

  // ── Helpers de lonas ────────────────────────────────────────────────────────
  const addLona = () => setForm(f => ({
    ...f, lonas: [...f.lonas, { id: Date.now(), items: [] }]
  }));
  const removeLona = (lonaId) => setForm(f => ({ ...f, lonas: f.lonas.filter(l => l.id !== lonaId) }));
  const addLonaItem = (lonaId) => setForm(f => ({
    ...f, lonas: f.lonas.map(l => l.id === lonaId
      ? { ...l, items: [...l.items, { product_id: "", nombre: "", cantidad: "" }] }
      : l)
  }));
  const updateLonaItem = (lonaId, idx, field, value) => setForm(f => ({
    ...f, lonas: f.lonas.map(l => {
      if (l.id !== lonaId) return l;
      const items = [...l.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === "product_id") {
        const prod = products.find(p => p.sku === value || p.id === value);
        items[idx].nombre = prod?.name || "";
      }
      return { ...l, items };
    })
  }));
  const removeLonaItem = (lonaId, idx) => setForm(f => ({
    ...f, lonas: f.lonas.map(l => l.id === lonaId
      ? { ...l, items: l.items.filter((_, i) => i !== idx) }
      : l)
  }));

  const totalEnLonas = form.lonas.reduce((s, l) =>
    s + l.items.reduce((si, i) => si + (Number(i.cantidad) || 0), 0), 0);
  const totalItems = form.items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);

  const handleEnviar = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.origen || !form.destino) return setError("Selecciona origen y destino.");
    if (form.origen === form.destino) return setError("Origen y destino deben ser diferentes.");
    if (form.items.length === 0) return setError("Agrega al menos un producto.");
    if (form.items.some(i => !i.product_id || !i.cantidad)) return setError("Completa todos los productos.");

    setSaving(true);
    try {
      const origen = locations.find(l => l.id === form.origen);
      const destino = locations.find(l => l.id === form.destino);
      await Traslado.create({
        numero_traslado: nextNumero(),
        origen_location_id: form.origen,
        origen_nombre: origen?.name || "",
        destino_location_id: form.destino,
        destino_nombre: destino?.name || "",
        items: form.items.map(i => ({
          product_id: i.product_id,
          nombre: i.nombre,
          cantidad_enviada: Number(i.cantidad),
        })),
        lonas: form.lonas.map((l, idx) => ({
          numero: idx + 1,
          items: l.items
            .filter(i => i.product_id && i.cantidad)
            .map(i => ({ product_id: i.product_id, nombre: i.nombre, cantidad: Number(i.cantidad) })),
          total: l.items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0),
        })),
        estado: "pendiente",
        notas: form.notas,
        creado_por: currentUser?.email || "",
      });
      setForm({ origen: "", destino: "", notas: "", items: [], lonas: [] });
      await loadData();
      setActiveTab("recibir");
    } catch (err) {
      setError("Error al crear el traslado: " + (err instanceof Error ? err.message : String(err)));
    }
    setSaving(false);
  };

  if (isLoading) return (
    <div className="p-6 flex justify-center items-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  const receivingTraslado = receivingId ? traslados.find(t => t.id === receivingId) : null;

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Traslados</h1>
            <p className="text-slate-500 text-sm mt-0.5">Prendas terminadas entre sucursales</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { id: "enviar", label: "Enviar", icon: Send },
            { id: "recibir", label: `Recibir${pendientesRecibir.length > 0 ? ` (${pendientesRecibir.length})` : ""}`, icon: InboxIcon },
            { id: "historial", label: "Historial", icon: History },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setActiveTab(id); setReceivingId(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── TAB: ENVIAR ── */}
        {activeTab === "enviar" && (
          <Card className="border-slate-200">
            <CardContent className="p-5">
              <form onSubmit={handleEnviar} className="space-y-5">
                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Origen *</label>
                    <select value={form.origen} onChange={e => setForm(f => ({ ...f, origen: e.target.value }))}
                      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm">
                      <option value="">Seleccionar sucursal...</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Destino *</label>
                    <select value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
                      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm">
                      <option value="">Seleccionar sucursal...</option>
                      {locations.filter(l => l.id !== form.origen).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Productos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">Productos *</label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
                    </Button>
                  </div>
                  {form.items.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
                      Sin productos — haz clic en Agregar
                    </p>
                  )}
                  <div className="space-y-2">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-50 rounded-lg p-2">
                        <select value={item.product_id} onChange={e => updateItem(idx, "product_id", e.target.value)}
                          className="flex-1 h-8 px-2 text-xs border border-slate-200 rounded">
                          <option value="">Seleccionar producto...</option>
                          {products.map(p => <option key={p.id} value={p.sku || p.id}>{p.name}</option>)}
                        </select>
                        <Input type="number" min="1" value={item.cantidad}
                          onChange={e => updateItem(idx, "cantidad", e.target.value)}
                          className="w-24 h-8 text-xs" placeholder="Cantidad" />
                        <button type="button" onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lonas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Lonas de empaque</label>
                      <p className="text-xs text-slate-400">Define el contenido de cada lona (puede ser mixto)</p>
                    </div>
                    <button type="button" onClick={addLona}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                      <Plus className="w-3.5 h-3.5" /> Lona
                    </button>
                  </div>
                  {form.lonas.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">
                      Opcional — agrega lonas si quieres detallar el empaque
                    </p>
                  )}
                  <div className="space-y-2">
                    {form.lonas.map((lona, lonaIdx) => {
                      const lonaTotal = lona.items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
                      return (
                        <div key={lona.id} className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-700">Lona {lonaIdx + 1}
                              {lonaTotal > 0 && <span className="ml-1 font-normal text-indigo-500">· {lonaTotal} prendas</span>}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => addLonaItem(lona.id)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                                <Plus className="w-3 h-3" /> producto
                              </button>
                              <button type="button" onClick={() => removeLona(lona.id)}
                                className="p-0.5 text-red-400 hover:text-red-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {lona.items.length === 0 && (
                            <p className="text-xs text-indigo-400 italic">Sin contenido — haz clic en "+ producto"</p>
                          )}
                          {lona.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex gap-1.5 items-center">
                              <select value={item.product_id}
                                onChange={e => updateLonaItem(lona.id, itemIdx, "product_id", e.target.value)}
                                className="flex-1 h-7 px-2 text-xs border border-indigo-200 rounded bg-white">
                                <option value="">Producto...</option>
                                {products.map(p => <option key={p.id} value={p.sku || p.id}>{p.name}</option>)}
                              </select>
                              <input type="number" min="1" value={item.cantidad}
                                onChange={e => updateLonaItem(lona.id, itemIdx, "cantidad", e.target.value)}
                                className="w-16 h-7 px-2 text-xs border border-indigo-200 rounded bg-white"
                                placeholder="Uds" />
                              <button type="button"
                                onClick={() => removeLonaItem(lona.id, itemIdx)}
                                className="p-0.5 text-red-400 hover:text-red-600">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  {form.lonas.length > 0 && totalItems > 0 && (
                    <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${totalEnLonas === totalItems ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                      Total en lonas: {totalEnLonas} / {totalItems} prendas declaradas
                      {totalEnLonas !== totalItems && " — ajusta las cantidades"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Notas</label>
                  <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none"
                    placeholder="Opcional..." />
                </div>

                <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Crear traslado pendiente
                </Button>
              </form>

              {/* Traslados enviados pendientes */}
              {pendientesEnviar.length > 0 && (
                <div className="mt-6 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Enviados · esperando recepción</p>
                  {pendientesEnviar.map(t => (
                    <div key={t.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-800 text-sm">{t.numero_traslado}</p>
                        <Badge className={ESTADO_CFG.pendiente.color}>{ESTADO_CFG.pendiente.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        → {t.destino_nombre} · {(t.items || []).length} producto(s) · {fmtDate(t.created_date)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── TAB: RECIBIR ── */}
        {activeTab === "recibir" && (
          receivingTraslado ? (
            <TransferReceive
              traslado={receivingTraslado}
              productos={products}
              locations={locations}
              onDone={() => { setReceivingId(null); loadData(); }}
              onCancel={() => setReceivingId(null)}
            />
          ) : (
            <div className="space-y-3">
              {pendientesRecibir.length === 0 ? (
                <Card className="border-slate-200">
                  <CardContent className="p-12 text-center text-slate-400">
                    <InboxIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No hay traslados pendientes de recepción</p>
                  </CardContent>
                </Card>
              ) : pendientesRecibir.map(t => {
                const origen = locations.find(l => l.id === t.origen_location_id);
                const totalUds = (t.items || []).reduce((s, i) => s + (Number(i.cantidad_enviada) || 0), 0);
                return (
                  <Card key={t.id} className="border-amber-200 bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-bold text-slate-800">{t.numero_traslado}</p>
                          <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-red-500" />
                            <span>{origen?.name || t.origen_nombre}</span>
                            <span>·</span>
                            <span>{(t.items || []).length} producto(s)</span>
                            <span>·</span>
                            <span>{totalUds} uds</span>
                            <span>·</span>
                            <span>{fmtDate(t.created_date)}</span>
                          </div>
                          {(t.items || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {t.items.map((i, idx) => (
                                <span key={idx} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                  {i.nombre || i.product_id} · {i.cantidad_enviada} uds
                                </span>
                              ))}
                            </div>
                          )}
                          {t.notas && <p className="text-xs text-slate-400 mt-1 italic">{t.notas}</p>}
                        </div>
                        <Button onClick={() => setReceivingId(t.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                          <Package className="w-4 h-4 mr-1.5" /> Recibir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {/* ── TAB: HISTORIAL ── */}
        {activeTab === "historial" && (
          <div className="space-y-3">
            {historialTraslados.length === 0 ? (
              <Card className="border-slate-200">
                <CardContent className="p-12 text-center text-slate-400">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Sin traslados completados aún</p>
                </CardContent>
              </Card>
            ) : historialTraslados.map(t => {
              const origen = locations.find(l => l.id === t.origen_location_id);
              const destino = locations.find(l => l.id === t.destino_location_id);
              const cfg = ESTADO_CFG[t.estado] || ESTADO_CFG.pendiente;
              const totalEnviado = (t.items || []).reduce((s, i) => s + (Number(i.cantidad_enviada) || 0), 0);
              const totalRecibido = (t.conteo_receptor || []).reduce((s, i) => s + (Number(i.total_recibido) || 0), 0);
              const hasDiff = t.estado === "aceptado" && totalRecibido !== totalEnviado;
              return (
                <Card key={t.id} className="border-slate-200">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800">{t.numero_traslado}</p>
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                        {hasDiff && <Badge className="bg-amber-100 text-amber-700">Con diferencia</Badge>}
                      </div>
                      <span className="text-xs text-slate-400">{fmtDate(t.created_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="text-red-700 font-medium">{origen?.name || t.origen_nombre}</span>
                      <span className="text-slate-400">→</span>
                      <Building2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-green-700 font-medium">{destino?.name || t.destino_nombre}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(t.items || []).map((i, idx) => {
                        const recibido = t.conteo_receptor?.find(c => c.product_id === i.product_id);
                        return (
                          <span key={idx} className={`text-xs px-2 py-0.5 rounded ${recibido && recibido.total_recibido !== i.cantidad_enviada ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                            {i.nombre || i.product_id}
                            {" · "}{i.cantidad_enviada} env
                            {recibido ? ` / ${recibido.total_recibido} rec` : ""}
                          </span>
                        );
                      })}
                    </div>
                    {t.notas_receptor && (
                      <p className="text-xs text-slate-400 italic">"{t.notas_receptor}"</p>
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
