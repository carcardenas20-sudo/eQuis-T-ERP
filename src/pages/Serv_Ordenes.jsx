import React, { useState, useEffect } from "react";
import { OrdenServicio, Servicio, MateriaPrima } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, FileText, DollarSign, User, Clock, CheckCircle, ChevronDown, ChevronUp, CreditCard } from "lucide-react";

function fmtCOP(n) {
  return "$" + (Number(n) || 0).toLocaleString("es-CO");
}

function todayCol() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function nextConsecutivo(ordenes) {
  const nums = ordenes.map(o => parseInt((o.numero_orden || "").replace(/\D/g, "")) || 0);
  return "ORD-" + String((Math.max(0, ...nums) + 1)).padStart(4, "0");
}

const ESTADOS = {
  borrador: { label: "Borrador", color: "bg-slate-100 text-slate-600" },
  confirmada: { label: "Confirmada", color: "bg-blue-100 text-blue-700" },
  en_proceso: { label: "En proceso", color: "bg-amber-100 text-amber-700" },
  lista: { label: "Lista", color: "bg-emerald-100 text-emerald-700" },
  pagada: { label: "Pagada", color: "bg-green-100 text-green-700" },
  credito: { label: "Crédito", color: "bg-orange-100 text-orange-700" },
};

const EMPTY_FORM = {
  numero_orden: "",
  cliente_nombre: "",
  cliente_contacto: "",
  estado: "confirmada",
  fecha_orden: todayCol(),
  fecha_estimada: "",
  notas: "",
  items: [],       // [{ servicio_id, nombre, cantidad, precio_unitario, subtotal }]
  pagos: [],       // [{ fecha, monto, metodo, nota }]
};

export default function Serv_Ordenes() {
  const [ordenes, setOrdenes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [pagoModal, setPagoModal] = useState({ open: false, ordenId: null, monto: "", metodo: "efectivo", nota: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [ords, svcs] = await Promise.all([OrdenServicio.list("-fecha_orden"), Servicio.list()]);
    setOrdenes(ords);
    setServicios(svcs.filter(s => s.activo !== false));
    setLoading(false);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, numero_orden: nextConsecutivo(ordenes), fecha_orden: todayCol() });
    setShowForm(true);
  };

  const openEdit = (ord) => {
    setEditingId(ord.id);
    setForm({
      numero_orden: ord.numero_orden || "",
      cliente_nombre: ord.cliente_nombre || "",
      cliente_contacto: ord.cliente_contacto || "",
      estado: ord.estado || "confirmada",
      fecha_orden: ord.fecha_orden || todayCol(),
      fecha_estimada: ord.fecha_estimada || "",
      notas: ord.notas || "",
      items: ord.items || [],
      pagos: ord.pagos || [],
    });
    setShowForm(true);
  };

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { servicio_id: "", nombre: "", cantidad: 1, unidad: "unidad", precio_unitario: 0, subtotal: 0 }] }));
  };

  // Busca precio especial para el cliente actual (comparación case-insensitive)
  const getPrecioParaCliente = (svc, clienteNombre) => {
    if (!clienteNombre || !(svc.precios_clientes || []).length) return svc.precio_venta || 0;
    const nombre = clienteNombre.trim().toLowerCase();
    const match = svc.precios_clientes.find(pc => pc.cliente.toLowerCase().includes(nombre) || nombre.includes(pc.cliente.toLowerCase()));
    return match ? match.precio : (svc.precio_venta || 0);
  };

  const updateItem = (idx, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === "servicio_id") {
        const svc = servicios.find(s => s.id === value);
        if (svc) {
          items[idx].nombre = svc.nombre;
          items[idx].unidad = svc.unidad_cobro || "unidad";
          items[idx].precio_unitario = getPrecioParaCliente(svc, f.cliente_nombre);
        }
      }
      const cant = Number(items[idx].cantidad) || 0;
      const precio = Number(items[idx].precio_unitario) || 0;
      items[idx].subtotal = cant * precio;
      return { ...f, items };
    });
  };

  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const calcTotal = (items) => items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
  const calcSaldo = (total, pagos) => total - (pagos || []).reduce((s, p) => s + (Number(p.monto) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cliente_nombre.trim()) return alert("El nombre del cliente es obligatorio.");
    if (form.items.length === 0) return alert("Agrega al menos un servicio.");
    setSaving(true);
    const total = calcTotal(form.items);
    const saldo = calcSaldo(total, form.pagos);
    const data = {
      numero_orden: form.numero_orden,
      cliente_nombre: form.cliente_nombre.trim(),
      cliente_contacto: form.cliente_contacto.trim(),
      estado: saldo <= 0 ? "pagada" : form.estado,
      fecha_orden: form.fecha_orden,
      fecha_estimada: form.fecha_estimada || null,
      notas: form.notas.trim(),
      items: form.items.filter(i => i.servicio_id),
      pagos: form.pagos,
      total,
      saldo_pendiente: Math.max(0, saldo),
    };
    if (editingId) {
      const updated = await OrdenServicio.update(editingId, data);
      setOrdenes(prev => prev.map(o => o.id === editingId ? { ...o, ...updated } : o));
    } else {
      const created = await OrdenServicio.create(data);
      setOrdenes(prev => [created, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
  };

  const handleRegistrarPago = async () => {
    const { ordenId, monto, metodo, nota } = pagoModal;
    if (!monto || Number(monto) <= 0) return alert("Ingresa un monto válido.");
    const orden = ordenes.find(o => o.id === ordenId);
    if (!orden) return;
    const nuevoPago = { fecha: todayCol(), monto: Number(monto), metodo, nota };
    const pagos = [...(orden.pagos || []), nuevoPago];
    const saldo = calcSaldo(orden.total, pagos);
    const updated = await OrdenServicio.update(ordenId, {
      pagos,
      saldo_pendiente: Math.max(0, saldo),
      estado: saldo <= 0 ? "pagada" : "credito",
    });
    setOrdenes(prev => prev.map(o => o.id === ordenId ? { ...o, ...updated } : o));
    setPagoModal({ open: false, ordenId: null, monto: "", metodo: "efectivo", nota: "" });
  };

  const handleEstado = async (ord, nuevoEstado) => {
    const updated = await OrdenServicio.update(ord.id, { estado: nuevoEstado });
    setOrdenes(prev => prev.map(o => o.id === ord.id ? { ...o, ...updated } : o));
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Órdenes de Servicio</h1>
            <p className="text-slate-500 text-sm mt-1">Facturación de servicios a clientes externos</p>
          </div>
          <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Nueva orden
          </Button>
        </div>

        {/* Modal formulario */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-bold text-slate-900">{editingId ? "Editar orden" : "Nueva orden"} · {form.numero_orden}</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></Button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Cliente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Cliente *</Label>
                    <Input value={form.cliente_nombre} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))} placeholder="Nombre o empresa" className="mt-1" />
                  </div>
                  <div>
                    <Label>Contacto</Label>
                    <Input value={form.cliente_contacto} onChange={e => setForm(f => ({ ...f, cliente_contacto: e.target.value }))} placeholder="Teléfono o correo" className="mt-1" />
                  </div>
                  <div>
                    <Label>Fecha orden</Label>
                    <Input type="date" value={form.fecha_orden} onChange={e => setForm(f => ({ ...f, fecha_orden: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Fecha estimada entrega</Label>
                    <Input type="date" value={form.fecha_estimada} onChange={e => setForm(f => ({ ...f, fecha_estimada: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} className="mt-1 w-full h-9 px-3 border border-slate-200 rounded text-sm">
                      {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Notas internas</Label>
                    <Input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Opcional" className="mt-1" />
                  </div>
                </div>

                {/* Servicios */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Servicios</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Agregar</Button>
                  </div>
                  {form.items.length === 0 && <p className="text-xs text-slate-400 text-center py-3 border border-dashed rounded-lg">Sin servicios agregados</p>}
                  <div className="space-y-2">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-2 space-y-1.5">
                        <div className="flex gap-2 items-center">
                          <select value={item.servicio_id} onChange={e => updateItem(idx, "servicio_id", e.target.value)} className="flex-1 h-8 text-xs px-2 border border-slate-200 rounded">
                            <option value="">Seleccionar servicio</option>
                            {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removeItem(idx)}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="flex items-center gap-1 flex-1">
                            <Input type="number" min="0" step="any" value={item.cantidad} onChange={e => updateItem(idx, "cantidad", e.target.value)} className="w-24 h-8 text-xs" placeholder="Cantidad" />
                            <span className="text-xs text-slate-500 shrink-0">{item.unidad || "unidad"}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-1">
                            <span className="text-xs text-slate-400 shrink-0">$</span>
                            <Input type="number" min="0" step="any" value={item.precio_unitario} onChange={e => updateItem(idx, "precio_unitario", e.target.value)} className="flex-1 h-8 text-xs" placeholder={`Precio/${item.unidad || "unidad"}`} />
                          </div>
                          <span className="text-xs text-emerald-700 font-bold w-20 text-right shrink-0">{fmtCOP(item.subtotal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {form.items.length > 0 && (
                    <div className="flex justify-end mt-2 px-2">
                      <span className="text-sm font-bold text-slate-800">Total: {fmtCOP(calcTotal(form.items))}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                    {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear orden"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal registrar pago */}
        {pagoModal.open && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Registrar pago</h3>
                <Button variant="ghost" size="icon" onClick={() => setPagoModal(m => ({ ...m, open: false }))}><X className="w-4 h-4" /></Button>
              </div>
              <div>
                <Label>Monto</Label>
                <Input type="number" min="0" step="any" value={pagoModal.monto} onChange={e => setPagoModal(m => ({ ...m, monto: e.target.value }))} placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label>Medio de pago</Label>
                <select value={pagoModal.metodo} onChange={e => setPagoModal(m => ({ ...m, metodo: e.target.value }))} className="mt-1 w-full h-9 px-3 border border-slate-200 rounded text-sm">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>
              <div>
                <Label>Nota</Label>
                <Input value={pagoModal.nota} onChange={e => setPagoModal(m => ({ ...m, nota: e.target.value }))} placeholder="Opcional" className="mt-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPagoModal(m => ({ ...m, open: false }))}>Cancelar</Button>
                <Button onClick={handleRegistrarPago} className="bg-emerald-600 hover:bg-emerald-700">Registrar</Button>
              </div>
            </div>
          </div>
        )}

        {/* Lista órdenes */}
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />)}</div>
        ) : ordenes.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay órdenes de servicio</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ordenes.map(ord => {
              const est = ESTADOS[ord.estado] || ESTADOS.borrador;
              const isExpanded = expandedId === ord.id;
              const saldo = Number(ord.saldo_pendiente || 0);
              return (
                <Card key={ord.id} className="bg-white border-slate-200">
                  <div
                    className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
                    onClick={() => setExpandedId(isExpanded ? null : ord.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{ord.numero_orden}</span>
                          <span className="text-sm text-slate-600 truncate">{ord.cliente_nombre}</span>
                          <Badge className={`text-xs ${est.color}`}>{est.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                          <span>{ord.fecha_orden}</span>
                          {ord.fecha_estimada && <span>· Entrega: {ord.fecha_estimada}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-bold text-slate-900">{fmtCOP(ord.total)}</p>
                      {saldo > 0 && <p className="text-xs text-orange-600">Saldo: {fmtCOP(saldo)}</p>}
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-4 border-t border-slate-100 space-y-4">
                      {/* Info cliente */}
                      {ord.cliente_contacto && (
                        <p className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> {ord.cliente_contacto}</p>
                      )}

                      {/* Items */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Servicios</p>
                        <div className="divide-y divide-slate-100">
                          {(ord.items || []).map((item, i) => (
                            <div key={i} className="flex justify-between py-1.5 text-sm">
                              <span className="text-slate-700">
                                {item.nombre}
                                <span className="text-slate-400"> · {Number(item.cantidad).toLocaleString("es-CO")} {item.unidad || "unid"} × {fmtCOP(item.precio_unitario)}</span>
                              </span>
                              <span className="font-medium">{fmtCOP(item.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pagos */}
                      {(ord.pagos || []).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Pagos recibidos</p>
                          <div className="divide-y divide-slate-100">
                            {ord.pagos.map((p, i) => (
                              <div key={i} className="flex justify-between py-1.5 text-sm">
                                <span className="text-slate-500">{p.fecha} · {p.metodo}{p.nota ? ` · ${p.nota}` : ""}</span>
                                <span className="font-medium text-emerald-700">{fmtCOP(p.monto)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {ord.estado !== "pagada" && (
                          <Button size="sm" variant="outline" className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => setPagoModal({ open: true, ordenId: ord.id, monto: saldo > 0 ? saldo : "", metodo: "efectivo", nota: "" })}>
                            <DollarSign className="w-3 h-3 mr-1" /> Registrar pago
                          </Button>
                        )}
                        {ord.estado === "confirmada" && (
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => handleEstado(ord, "en_proceso")}>
                            <Clock className="w-3 h-3 mr-1" /> Marcar en proceso
                          </Button>
                        )}
                        {ord.estado === "en_proceso" && (
                          <Button size="sm" variant="outline" className="text-xs border-emerald-300 text-emerald-700" onClick={() => handleEstado(ord, "lista")}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Marcar lista
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => openEdit(ord)}>
                          Editar
                        </Button>
                      </div>

                      {ord.notas && <p className="text-xs text-slate-400 italic">{ord.notas}</p>}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
