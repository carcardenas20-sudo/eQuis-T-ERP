import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Trash2, Shirt, Package, Palette, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import GestorCombinacionesPredefinidas from './GestorCombinacionesPredefinidas';

export default function FormularioProducto({ producto, materiasPrimas, colores = [], familias = [], onSubmit, onCancel }) {
  const DRAFT_KEY = `producto_draft_${producto?.id || 'nuevo'}`;

  const [formData, setFormData] = useState(() => {
    // Intentar recuperar borrador guardado
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        // Solo restaurar si el borrador es más reciente que hace 24h
        if (parsed._savedAt && Date.now() - parsed._savedAt < 24 * 60 * 60 * 1000) {
          const { _savedAt, ...data } = parsed;
          return data;
        }
      }
    } catch (_) {}

    return producto ? {
      ...producto,
      materiales_requeridos: producto.materiales_requeridos || [],
      combinaciones_predefinidas: producto.combinaciones_predefinidas || [],
      reference: producto.reference || "",
      familia_id: producto.familia_id || "",
      precio_venta: producto.precio_venta || 0,
      precio_empleado: producto.precio_empleado || 0,
    } : {
      nombre: "",
      descripcion: "",
      tipo_diseno: "por_secciones",
      tallas: [],
      materiales_requeridos: [],
      combinaciones_predefinidas: [],
      costo_mano_obra: 0,
      tiempo_fabricacion_horas: 0,
      imagen_url: "",
      reference: "",
      familia_id: "",
      precio_venta: 0,
      precio_empleado: 0,
    };
  });

  const [hasDraft, setHasDraft] = useState(() => {
    try {
      const draft = localStorage.getItem(`producto_draft_${producto?.id || 'nuevo'}`);
      if (!draft) return false;
      const parsed = JSON.parse(draft);
      return !!(parsed._savedAt && Date.now() - parsed._savedAt < 24 * 60 * 60 * 1000);
    } catch (_) { return false; }
  });

  const isFirstRender = useRef(true);

  // Auto-guardar en localStorage con debounce (evita escrituras excesivas)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...formData, _savedAt: Date.now() }));
      } catch (_) {}
    }, 800);
    return () => clearTimeout(timer);
  }, [formData]);

  const [tallaInput, setTallaInput] = useState("");

  const costoTotalMateriales = useMemo(() => {
    return (formData.materiales_requeridos || []).reduce((total, material) => {
      const mp = materiasPrimas.find(m => m.id === material.materia_prima_id);
      return total + (mp?.precio_por_unidad || 0) * (material.cantidad_por_unidad || 0);
    }, 0);
  }, [formData.materiales_requeridos, materiasPrimas]);

  const agregarTalla = () => {
    if (tallaInput.trim() && !formData.tallas.includes(tallaInput.trim())) {
      setFormData({ ...formData, tallas: [...formData.tallas, tallaInput.trim()] });
      setTallaInput("");
    }
  };

  const removerTalla = (talla) => {
    setFormData({ ...formData, tallas: formData.tallas.filter(t => t !== talla) });
  };

  const agregarMaterial = () => {
    const nuevoMaterial = {
      row_id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      materia_prima_id: "",
      seccion: "superior",
      cantidad_por_unidad: 0,
      piezas_por_unidad: 1,
      etiqueta_cantidad: "",
      nombre_seccion_display: "",
      es_opcional: false
    };
    setFormData({ ...formData, materiales_requeridos: [...formData.materiales_requeridos, nuevoMaterial] });
  };

  const removerMaterial = (index) => {
    setFormData(prev => ({
      ...prev,
      materiales_requeridos: prev.materiales_requeridos.filter((_, i) => i !== index)
    }));
  };

  const actualizarMaterial = (index, campo, valor) => {
    setFormData(prev => ({
      ...prev,
      materiales_requeridos: prev.materiales_requeridos.map((m, i) => i === index ? { ...m, [campo]: valor } : m)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) { alert("El nombre del producto es obligatorio."); return; }
    // Limpiar borrador al guardar exitosamente
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    onSubmit(formData);
  };

  const descartarBorrador = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    setHasDraft(false);
    // Restaurar datos originales
    setFormData(producto ? {
      ...producto,
      materiales_requeridos: producto.materiales_requeridos || [],
      combinaciones_predefinidas: producto.combinaciones_predefinidas || [],
      reference: producto.reference || "",
      familia_id: producto.familia_id || "",
      precio_venta: producto.precio_venta || 0,
      precio_empleado: producto.precio_empleado || 0,
    } : {
      nombre: "", descripcion: "", tipo_diseno: "por_secciones", tallas: [],
      materiales_requeridos: [], combinaciones_predefinidas: [],
      costo_mano_obra: 0, tiempo_fabricacion_horas: 0, imagen_url: "",
      reference: "", familia_id: "",
      precio_venta: 0, precio_empleado: 0,
    });
  };

  const esCopia = producto && !producto.id && producto.nombre?.includes(' - Copia');

  const SECCIONES = formData.tipo_diseno === 'fondo_entero'
    ? [{ key: 'fondo_entero', label: 'Fondo Entero' }, { key: 'forro', label: 'Forro' }, { key: 'contraste', label: 'Contraste' }, { key: 'color_propio', label: 'Color Propio' }]
    : [{ key: 'superior', label: 'Superior' }, { key: 'central', label: 'Central' }, { key: 'inferior', label: 'Inferior' }, { key: 'forro', label: 'Forro' }, { key: 'contraste', label: 'Contraste' }, { key: 'color_propio', label: 'Color Propio' }];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="bg-white shadow-2xl border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-slate-900">
                  {producto?.id ? 'Editar Producto' : 'Nuevo Producto'}
                </CardTitle>
                {esCopia && (
                  <p className="text-sm text-indigo-600 mt-1 flex items-center gap-2">
                    <Copy className="w-4 h-4" />
                    Copiado desde producto original
                  </p>
                )}
                {hasDraft && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <span>⚠️ Se recuperó un borrador guardado automáticamente.</span>
                    <button type="button" onClick={descartarBorrador}
                      className="underline text-amber-600 hover:text-amber-800 shrink-0">
                      Descartar y usar datos originales
                    </button>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs defaultValue="info" className="space-y-4">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="info" className="text-xs sm:text-sm">
                    <Shirt className="w-3 h-3 mr-1" /> Info
                  </TabsTrigger>
                  <TabsTrigger value="materiales" className="text-xs sm:text-sm">
                    <Package className="w-3 h-3 mr-1" /> Materiales
                    {formData.materiales_requeridos.length > 0 && (
                      <Badge className="ml-1 text-xs bg-purple-100 text-purple-700 hidden sm:inline-flex">{formData.materiales_requeridos.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="combinaciones" className="text-xs sm:text-sm">
                    <Palette className="w-3 h-3 mr-1" /> Combinaciones
                    {(formData.combinaciones_predefinidas || []).length > 0 && (
                      <Badge className="ml-1 text-xs bg-indigo-100 text-indigo-700 hidden sm:inline-flex">{formData.combinaciones_predefinidas.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* TAB: INFO */}
                <TabsContent value="info" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Shirt className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-base font-semibold text-slate-900">Detalles del Producto</h3>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre del Producto *</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Chaqueta Bomber Clásica"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descripcion">Descripción</Label>
                      <Textarea
                        id="descripcion"
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        placeholder="Breve descripción del diseño..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de Diseño *</Label>
                      <Select value={formData.tipo_diseno} onValueChange={(v) => setFormData({ ...formData, tipo_diseno: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fondo_entero">Fondo Entero</SelectItem>
                          <SelectItem value="por_secciones">Por Secciones</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tallas Disponibles *</Label>
                      <div className="flex gap-2">
                        <Input
                          value={tallaInput}
                          onChange={(e) => setTallaInput(e.target.value.toUpperCase())}
                          placeholder="Ej: S, M, L"
                        />
                        <Button type="button" variant="outline" onClick={agregarTalla}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.tallas.map(talla => (
                          <Badge key={talla} className="flex items-center gap-1 bg-indigo-100 text-indigo-800">
                            {talla}
                            <button type="button" onClick={() => removerTalla(talla)} className="ml-1 text-indigo-500 hover:text-indigo-700">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                      <div className="space-y-2">
                        <Label>Código de Despacho (Ref.)</Label>
                        <Input
                          value={formData.reference || ""}
                          onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                          placeholder="Ej: 001, 002"
                          maxLength={10}
                        />
                        <p className="text-xs text-slate-500">Código corto para despachos a operarios</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Familia POS</Label>
                        <Select
                          value={formData.familia_id || ""}
                          onValueChange={(v) => setFormData({ ...formData, familia_id: v === "_none" ? "" : v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sin familia" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Sin familia</SelectItem>
                            {familias.map(f => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.name} {f.sku ? `(${f.sku})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">Grupo comercial en el POS — <span className="font-medium text-indigo-600">requerido para sincronizar precios</span></p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                      <div className="space-y-2">
                        <Label>Precio Venta Público ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="100"
                          value={formData.precio_venta || ""}
                          onChange={(e) => setFormData({ ...formData, precio_venta: parseFloat(e.target.value) || 0 })}
                          placeholder="0"
                        />
                        <p className="text-xs text-slate-500">POS → lista <span className="font-semibold text-green-700">Detal (RETAIL)</span></p>
                      </div>
                      <div className="space-y-2">
                        <Label>Precio Compra Empleados ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="100"
                          value={formData.precio_empleado || ""}
                          onChange={(e) => setFormData({ ...formData, precio_empleado: parseFloat(e.target.value) || 0 })}
                          placeholder="0"
                        />
                        <p className="text-xs text-slate-500">POS → lista <span className="font-semibold text-blue-700">Mayorista (WHOLESALE)</span></p>
                      </div>
                    </div>

                    {(formData.precio_venta > 0 || formData.precio_empleado > 0) && !formData.familia_id && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        <span className="text-base">⚠️</span>
                        <span>Los precios no se sincronizarán al POS hasta que se seleccione una <strong>Familia POS</strong>.</span>
                      </div>
                    )}

                    {(formData.precio_venta > 0 || formData.precio_empleado > 0) && formData.familia_id && (
                      <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
                        <span className="text-base">✓</span>
                        <span>Al guardar, los precios se actualizarán automáticamente en las listas del POS.</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                      <div className="space-y-2">
                        <Label>Costo Mano de Obra</Label>
                        <Input
                          type="number"
                          value={formData.costo_mano_obra}
                          onChange={(e) => setFormData({ ...formData, costo_mano_obra: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tiempo (Horas)</Label>
                        <Input
                          type="number"
                          value={formData.tiempo_fabricacion_horas}
                          onChange={(e) => setFormData({ ...formData, tiempo_fabricacion_horas: parseFloat(e.target.value) || 0 })}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 p-3 bg-slate-50 rounded-lg text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Costo Materiales:</span><span className="font-semibold">${costoTotalMateriales.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Mano de Obra:</span><span className="font-semibold">${(formData.costo_mano_obra || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between font-bold text-indigo-600 border-t pt-2">
                        <span>Total:</span><span>${(costoTotalMateriales + (formData.costo_mano_obra || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB: MATERIALES */}
                <TabsContent value="materiales" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-purple-600" />
                      <h3 className="text-base font-semibold text-slate-900">Materiales Requeridos</h3>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={agregarMaterial}
                      className="text-purple-600 border-purple-200 hover:bg-purple-50 text-xs">
                      <Plus className="w-3 h-3 mr-1" /> Agregar
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                    {formData.materiales_requeridos.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                        No hay materiales agregados.
                      </div>
                    ) : (
                      formData.materiales_requeridos.map((material, index) => {
                        const mp = materiasPrimas.find(m => m.id === material.materia_prima_id);
                        const costo = (mp?.precio_por_unidad || 0) * (material.cantidad_por_unidad || 0);
                        return (
                          <div key={material.row_id || index} className="border border-slate-200 rounded-lg bg-slate-50 p-3 space-y-2">
                            {/* Fila 1: Material + Sección + Cantidad */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                              <div className="sm:col-span-2">
                                <Label className="text-xs text-slate-500">Material</Label>
                                <Select value={material.materia_prima_id}
                                  onValueChange={(v) => actualizarMaterial(index, 'materia_prima_id', v)}>
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue placeholder="Seleccionar" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {materiasPrimas.map(mp => (
                                      <SelectItem key={mp.id} value={mp.id}>{mp.nombre}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs text-slate-500">Sección / Anclaje</Label>
                                <Select value={material.seccion || 'superior'}
                                  onValueChange={(v) => actualizarMaterial(index, 'seccion', v)}>
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SECCIONES.map(s => (
                                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-end gap-2">
                                <div className="flex-1">
                                  <Label className="text-xs text-slate-500">Cant/ud</Label>
                                  <Input type="number" step="0.01"
                                    value={material.cantidad_por_unidad}
                                    onChange={(e) => actualizarMaterial(index, 'cantidad_por_unidad', e.target.value)}
                                    className="h-8 text-xs mt-1" />
                                </div>
                                <div className="text-xs text-slate-500 pb-1">${costo.toFixed(2)}</div>
                                <Button type="button" variant="ghost" size="icon"
                                  onClick={() => removerMaterial(index)}
                                  className="text-red-400 hover:bg-red-50 h-8 w-8 shrink-0">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            {/* Toggle color independiente: para materiales con color fijo global que en este producto varían por combinación */}
                            {(() => {
                              const mp = materiasPrimas.find(mp => mp.id === material.materia_prima_id);
                              if (!mp || !mp.color_fijo) return null;
                              return (
                                <div className="flex items-center gap-2 pt-1 pb-0.5">
                                  <button
                                    type="button"
                                    onClick={() => actualizarMaterial(index, 'color_independiente', !material.color_independiente)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${material.color_independiente ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                  >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${material.color_independiente ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                  </button>
                                  <span className="text-xs text-slate-600">Color variable en este producto</span>
                                  {material.color_independiente && (
                                    <span className="text-xs text-indigo-500 font-medium">— aparece como columna en combinaciones</span>
                                  )}
                                </div>
                              );
                            })()}
                            {/* Fila 2: Campos para remisión individual */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200">
                              <div>
                                <Label className="text-xs text-slate-400">Nombre en remisión</Label>
                                <Input
                                  placeholder="Ej: BOLSILLO, MANGA"
                                  value={material.nombre_seccion_display || ""}
                                  onChange={(e) => actualizarMaterial(index, 'nombre_seccion_display', e.target.value)}
                                  className="h-7 text-xs mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-xs text-slate-400">Unidad en remisión</Label>
                                <Input
                                  placeholder="Ej: tiras, pares, mts"
                                  value={material.unidad_remision || material.etiqueta_cantidad || ""}
                                  onChange={(e) => actualizarMaterial(index, 'unidad_remision', e.target.value)}
                                  className="h-7 text-xs mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-xs text-slate-400">Descripción en remisión</Label>
                                <Input
                                  placeholder="Ej: tiras tejidas negras"
                                  value={material.descripcion_remision || ""}
                                  onChange={(e) => actualizarMaterial(index, 'descripcion_remision', e.target.value)}
                                  className="h-7 text-xs mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-xs text-slate-400">Fórmula remisión</Label>
                                <Select
                                  value={material.remision_formula || 'lineal'}
                                  onValueChange={(v) => actualizarMaterial(index, 'remision_formula', v)}>
                                  <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="lineal">N × factor</SelectItem>
                                    <SelectItem value="ceil_divide">⌈N ÷ divisor⌉</SelectItem>
                                    <SelectItem value="paso">Escalonado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            {/* Fila 3: Parámetros de fórmula de remisión */}
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1 border-t border-dashed border-slate-200">
                              {(!material.remision_formula || material.remision_formula === 'lineal') && (
                                <div className="col-span-3 sm:col-span-2">
                                  <Label className="text-xs text-slate-400">Factor (× N prendas)</Label>
                                  <Input type="number" min="0.01" step="0.01"
                                    value={material.piezas_por_unidad ?? 1}
                                    onChange={(e) => actualizarMaterial(index, 'piezas_por_unidad', e.target.value)}
                                    className="h-7 text-xs mt-0.5" />
                                </div>
                              )}
                              {material.remision_formula === 'ceil_divide' && (
                                <div className="col-span-3 sm:col-span-2">
                                  <Label className="text-xs text-slate-400">Divisor (N ÷ ?)</Label>
                                  <Input type="number" min="1" step="1"
                                    value={material.remision_divisor || 3}
                                    onChange={(e) => actualizarMaterial(index, 'remision_divisor', parseFloat(e.target.value) || 3)}
                                    className="h-7 text-xs mt-0.5" />
                                </div>
                              )}
                              {material.remision_formula === 'paso' && (<>
                                <div className="col-span-1">
                                  <Label className="text-xs text-slate-400">Umbral (N ≤)</Label>
                                  <Input type="number" min="1" step="1"
                                    value={material.remision_umbral || 15}
                                    onChange={(e) => actualizarMaterial(index, 'remision_umbral', parseFloat(e.target.value) || 15)}
                                    className="h-7 text-xs mt-0.5" />
                                </div>
                                <div className="col-span-1">
                                  <Label className="text-xs text-slate-400">Val. bajo</Label>
                                  <Input type="number" min="0" step="1"
                                    value={material.remision_val_bajo || 1}
                                    onChange={(e) => actualizarMaterial(index, 'remision_val_bajo', parseFloat(e.target.value) || 1)}
                                    className="h-7 text-xs mt-0.5" />
                                </div>
                                <div className="col-span-1">
                                  <Label className="text-xs text-slate-400">Val. alto</Label>
                                  <Input type="number" min="0" step="1"
                                    value={material.remision_val_alto || 2}
                                    onChange={(e) => actualizarMaterial(index, 'remision_val_alto', parseFloat(e.target.value) || 2)}
                                    className="h-7 text-xs mt-0.5" />
                                </div>
                              </>)}
                              <div className="col-span-3 sm:col-span-4 flex items-end pb-0.5">
                                <span className="text-xs text-slate-400 italic">
                                  {(() => {
                                    const f = material.remision_formula || 'lineal';
                                    const N = 12;
                                    if (f === 'lineal') return `Ej: ${N} prendas → ${N * (material.piezas_por_unidad || 1)} ${material.unidad_remision || 'uds'}`;
                                    if (f === 'ceil_divide') return `Ej: ${N} prendas → ${Math.ceil(N / (material.remision_divisor || 3))} ${material.unidad_remision || 'mts'}`;
                                    if (f === 'paso') return `Ej: N≤${material.remision_umbral || 15} → ${material.remision_val_bajo || 1}, N>${material.remision_umbral || 15} → ${material.remision_val_alto || 2}`;
                                    return '';
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <p className="text-xs text-slate-400">💡 La sección/anclaje define qué color toma este material en cada combinación.</p>
                </TabsContent>

                {/* TAB: COMBINACIONES */}
                <TabsContent value="combinaciones" className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-base font-semibold text-slate-900">Combinaciones Predefinidas</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Define las combinaciones de colores típicas de este producto. Al presupuestar, simplemente las seleccionas y pones cantidades por talla.
                  </p>
                  <GestorCombinacionesPredefinidas
                    formData={formData}
                    setFormData={setFormData}
                    materiasPrimas={materiasPrimas}
                    colores={colores}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8">
                  {producto?.id ? 'Actualizar' : 'Crear'} Producto
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}