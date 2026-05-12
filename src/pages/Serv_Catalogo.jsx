import React, { useState, useEffect } from "react";
import { Servicio, MateriaPrima } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, X, Package, User } from "lucide-react";

function fmtCOP(n) {
  return "$" + (Number(n) || 0).toLocaleString("es-CO");
}

const UNIDADES = ["unidad", "cm", "metro", "hora", "par", "docena", "kg", "ml"];

const EMPTY_FORM = {
  nombre: "",
  descripcion: "",
  precio_venta: "",
  costo_manufactura: "",
  unidad_cobro: "unidad",
  activo: true,
  materiales: [],       // [{ materia_prima_id, nombre, cantidad_por_unidad, unidad_medida }]
  precios_clientes: [], // [{ cliente, precio }]
};

export default function Serv_Catalogo() {
  const [servicios, setServicios] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [svcs, mps] = await Promise.all([Servicio.list(), MateriaPrima.list()]);
    setServicios(svcs);
    setMateriasPrimas(mps);
    setLoading(false);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (svc) => {
    setEditingId(svc.id);
    setForm({
      nombre: svc.nombre || "",
      descripcion: svc.descripcion || "",
      precio_venta: svc.precio_venta || "",
      costo_manufactura: svc.costo_manufactura || "",
      unidad_cobro: svc.unidad_cobro || "unidad",
      activo: svc.activo !== false,
      materiales: svc.materiales || [],
      precios_clientes: svc.precios_clientes || [],
    });
    setShowForm(true);
  };

  const handleDelete = async (svc) => {
    if (!confirm(`¿Eliminar el servicio "${svc.nombre}"?`)) return;
    await Servicio.delete(svc.id);
    setServicios(prev => prev.filter(s => s.id !== svc.id));
  };

  // ── Materiales ──────────────────────────────────────────────────
  const addMaterial = () => {
    setForm(f => ({ ...f, materiales: [...f.materiales, { materia_prima_id: "", nombre: "", cantidad_por_unidad: 1, unidad_medida: "" }] }));
  };
  const updateMaterial = (idx, field, value) => {
    setForm(f => {
      const mats = [...f.materiales];
      mats[idx] = { ...mats[idx], [field]: value };
      if (field === "materia_prima_id") {
        const mp = materiasPrimas.find(m => m.id === value);
        if (mp) { mats[idx].nombre = mp.nombre; mats[idx].unidad_medida = mp.unidad_medida || ""; }
      }
      return { ...f, materiales: mats };
    });
  };
  const removeMaterial = (idx) => setForm(f => ({ ...f, materiales: f.materiales.filter((_, i) => i !== idx) }));

  // ── Precios por cliente ─────────────────────────────────────────
  const addPrecioCliente = () => {
    setForm(f => ({ ...f, precios_clientes: [...f.precios_clientes, { cliente: "", precio: "" }] }));
  };
  const updatePrecioCliente = (idx, field, value) => {
    setForm(f => {
      const pcs = [...f.precios_clientes];
      pcs[idx] = { ...pcs[idx], [field]: value };
      return { ...f, precios_clientes: pcs };
    });
  };
  const removePrecioCliente = (idx) => setForm(f => ({ ...f, precios_clientes: f.precios_clientes.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return alert("El nombre es obligatorio.");
    setSaving(true);
    const data = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      precio_venta: parseFloat(form.precio_venta) || 0,
      costo_manufactura: parseFloat(form.costo_manufactura) || 0,
      unidad_cobro: form.unidad_cobro || "unidad",
      activo: form.activo,
      materiales: form.materiales.filter(m => m.materia_prima_id),
      precios_clientes: form.precios_clientes.filter(pc => pc.cliente.trim() && parseFloat(pc.precio) > 0)
        .map(pc => ({ cliente: pc.cliente.trim(), precio: parseFloat(pc.precio) })),
    };
    if (editingId) {
      const updated = await Servicio.update(editingId, data);
      setServicios(prev => prev.map(s => s.id === editingId ? { ...s, ...updated } : s));
    } else {
      const created = await Servicio.create(data);
      setServicios(prev => [created, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
  };

  const costoMateriales = (svc) => {
    return (svc.materiales || []).reduce((sum, m) => {
      const mp = materiasPrimas.find(p => p.id === m.materia_prima_id);
      return sum + (Number(m.cantidad_por_unidad) || 0) * (mp?.precio_por_unidad || 0);
    }, 0);
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Catálogo de Servicios</h1>
            <p className="text-slate-500 text-sm mt-1">Servicios prestados a terceros con sus materiales y costos</p>
          </div>
          <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Nuevo servicio
          </Button>
        </div>

        {/* Modal formulario */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-bold text-slate-900">{editingId ? "Editar servicio" : "Nuevo servicio"}</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></Button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label>Nombre del servicio *</Label>
                    <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="ej. Sesgado, Bordado, Estampado" className="mt-1" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Descripción</Label>
                    <Input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción opcional" className="mt-1" />
                  </div>
                  <div>
                    <Label>Unidad de cobro</Label>
                    <select
                      value={UNIDADES.includes(form.unidad_cobro) ? form.unidad_cobro : "otro"}
                      onChange={e => setForm(f => ({ ...f, unidad_cobro: e.target.value === "otro" ? "" : e.target.value }))}
                      className="mt-1 w-full h-9 px-3 border border-slate-200 rounded text-sm"
                    >
                      {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                      <option value="otro">Otro...</option>
                    </select>
                    {!UNIDADES.includes(form.unidad_cobro) && (
                      <Input value={form.unidad_cobro} onChange={e => setForm(f => ({ ...f, unidad_cobro: e.target.value }))} placeholder="ej. prenda, rollo..." className="mt-1" />
                    )}
                  </div>
                  <div>
                    <Label>Precio base (por {form.unidad_cobro || "unidad"})</Label>
                    <Input type="number" min="0" step="any" value={form.precio_venta} onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))} placeholder="0" className="mt-1" />
                  </div>
                  <div>
                    <Label>Costo manufactura (por {form.unidad_cobro || "unidad"})</Label>
                    <Input type="number" min="0" step="any" value={form.costo_manufactura} onChange={e => setForm(f => ({ ...f, costo_manufactura: e.target.value }))} placeholder="0" className="mt-1" />
                  </div>
                </div>

                {/* Precios por cliente */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Precios especiales por cliente</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addPrecioCliente}>
                      <Plus className="w-3 h-3 mr-1" /> Agregar
                    </Button>
                  </div>
                  {form.precios_clientes.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-3 border border-dashed rounded-lg">Sin precios especiales — se usará el precio base</p>
                  )}
                  <div className="space-y-2">
                    {form.precios_clientes.map((pc, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-blue-50 rounded-lg p-2">
                        <Input
                          value={pc.cliente}
                          onChange={e => updatePrecioCliente(idx, "cliente", e.target.value)}
                          placeholder="Nombre del cliente"
                          className="flex-1 h-8 text-xs"
                        />
                        <Input
                          type="number" min="0" step="any"
                          value={pc.precio}
                          onChange={e => updatePrecioCliente(idx, "precio", e.target.value)}
                          placeholder={`Precio/${form.unidad_cobro || "unidad"}`}
                          className="w-28 h-8 text-xs"
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removePrecioCliente(idx)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Materiales */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Materias primas consumidas (por {form.unidad_cobro || "unidad"})</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
                      <Plus className="w-3 h-3 mr-1" /> Agregar
                    </Button>
                  </div>
                  {form.materiales.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-3 border border-dashed rounded-lg">Sin materiales configurados</p>
                  )}
                  <div className="space-y-2">
                    {form.materiales.map((mat, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-50 rounded-lg p-2">
                        <select
                          value={mat.materia_prima_id}
                          onChange={e => updateMaterial(idx, "materia_prima_id", e.target.value)}
                          className="flex-1 h-8 text-xs px-2 border border-slate-200 rounded"
                        >
                          <option value="">Seleccionar materia prima</option>
                          {materiasPrimas.map(mp => <option key={mp.id} value={mp.id}>{mp.nombre}</option>)}
                        </select>
                        <Input
                          type="number" min="0" step="any"
                          value={mat.cantidad_por_unidad}
                          onChange={e => updateMaterial(idx, "cantidad_por_unidad", e.target.value)}
                          className="w-20 h-8 text-xs"
                          placeholder="Cant."
                        />
                        <span className="text-xs text-slate-400 w-12">{mat.unidad_medida}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removeMaterial(idx)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                    {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear servicio"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-slate-200 rounded-xl animate-pulse" />)}
          </div>
        ) : servicios.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay servicios configurados</p>
            <p className="text-sm mt-1">Crea el primero para empezar a facturar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {servicios.map(svc => {
              const cMat = costoMateriales(svc);
              const cTotal = cMat + Number(svc.costo_manufactura || 0);
              const margen = svc.precio_venta > 0 ? ((svc.precio_venta - cTotal) / svc.precio_venta) * 100 : null;
              const unidad = svc.unidad_cobro || "unidad";
              return (
                <Card key={svc.id} className="bg-white border-slate-200 hover:border-indigo-300 transition-all">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900">{svc.nombre}</CardTitle>
                        {svc.descripcion && <p className="text-xs text-slate-500 mt-0.5">{svc.descripcion}</p>}
                        <Badge className="mt-1 text-xs bg-slate-100 text-slate-600">por {unidad}</Badge>
                        {!svc.activo && <Badge className="mt-1 ml-1 text-xs bg-slate-100 text-slate-500">Inactivo</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-indigo-600" onClick={() => openEdit(svc)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-600" onClick={() => handleDelete(svc)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {svc.precio_venta > 0 && (
                        <div className="bg-green-50 rounded-lg px-3 py-2">
                          <p className="text-xs text-green-600">Precio base</p>
                          <p className="text-sm font-bold text-green-800">{fmtCOP(svc.precio_venta)}<span className="text-xs font-normal text-green-600">/{unidad}</span></p>
                        </div>
                      )}
                      {cTotal > 0 && (
                        <div className="bg-slate-50 rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500">Costo total</p>
                          <p className="text-sm font-bold text-slate-700">{fmtCOP(cTotal)}<span className="text-xs font-normal text-slate-400">/{unidad}</span></p>
                        </div>
                      )}
                    </div>
                    {margen !== null && (
                      <div className={`rounded-lg px-3 py-2 text-xs font-semibold flex justify-between ${margen >= 40 ? 'bg-emerald-50 text-emerald-700' : margen >= 20 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        <span>Margen</span>
                        <span>{margen.toFixed(1)}%</span>
                      </div>
                    )}
                    {(svc.precios_clientes || []).length > 0 && (
                      <div className="border-t pt-2 space-y-1">
                        <p className="text-xs text-slate-400 flex items-center gap-1"><User className="w-3 h-3" /> Precios especiales</p>
                        {svc.precios_clientes.map((pc, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-slate-600 truncate">{pc.cliente}</span>
                            <span className="font-semibold text-blue-700">{fmtCOP(pc.precio)}/{unidad}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(svc.materiales || []).length > 0 && (
                      <p className="text-xs text-slate-400">{svc.materiales.length} material{svc.materiales.length !== 1 ? 'es' : ''} configurado{svc.materiales.length !== 1 ? 's' : ''}</p>
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
