
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export default function FormularioCompra({ compra, proveedores, materiasPrimas, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(compra || {
    numero_orden: `ORD-${Date.now()}`,
    proveedor_id: "",
    proveedor_nombre: "",
    fecha_orden: new Date().toISOString().split('T')[0],
    fecha_entrega_esperada: "",
    items: [],
    subtotal: 0,
    impuestos: 0,
    total: 0,
    estado: "borrador",
    observaciones: ""
  });
  
  const [aplicarImpuestos, setAplicarImpuestos] = useState(compra ? compra.impuestos > 0 : true);

  // Memoized function to calculate totals and update formData.items, subtotal, impuestos, total
  // This function is called when items are added, updated, or removed.
  // It also uses aplicarImpuestos to calculate taxes.
  const calcularTotales = useCallback((items) => {
    const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const impuestos = aplicarImpuestos ? subtotal * 0.19 : 0; // 19% IVA, opcional
    const total = subtotal + impuestos;
    
    setFormData(prev => ({
      ...prev,
      items, // Update the items array
      subtotal, // Update totals based on current items and aplicarImpuestos
      impuestos,
      total
    }));
  }, [aplicarImpuestos, setFormData]); // Dependencies: aplicarImpuestos and setFormData (stable)

  // useEffect hook to recalculate totals when `aplicarImpuestos` or `formData.items` change.
  // This ensures consistency of subtotal, impuestos, total with the current items and tax setting.
  useEffect(() => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const impuestos = aplicarImpuestos ? subtotal * 0.19 : 0;
    const total = subtotal + impuestos;
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      impuestos,
      total
    }));
  }, [aplicarImpuestos, formData.items, setFormData]); // Dependencies: aplicarImpuestos, formData.items, and setFormData (stable)

  const agregarItem = () => {
    const nuevoItem = {
      id: Date.now(),
      materia_prima_id: "",
      materia_prima_nombre: "",
      color: "",
      cantidad: 0,
      unidad_medida: "",
      precio_unitario: 0,
      subtotal: 0
    };
    
    const nuevosItems = [...formData.items, nuevoItem];
    calcularTotales(nuevosItems); // Use the memoized function
  };

  const actualizarItem = (index, campo, valor) => {
    const nuevosItems = [...formData.items];
    
    if (campo === 'materia_prima_id') {
      const materia = materiasPrimas.find(m => m.id === valor);
      if (materia) {
        nuevosItems[index] = {
          ...nuevosItems[index],
          materia_prima_id: valor,
          materia_prima_nombre: materia.nombre,
          unidad_medida: materia.unidad_medida,
          precio_unitario: materia.precio_por_unidad || 0
        };
      }
    } else {
      nuevosItems[index][campo] = valor;
    }
    
    // Recalcular subtotal del item
    if (['cantidad', 'precio_unitario'].includes(campo)) {
      const cantidad = parseFloat(nuevosItems[index].cantidad) || 0;
      const precio = parseFloat(nuevosItems[index].precio_unitario) || 0;
      nuevosItems[index].subtotal = cantidad * precio;
    }
    
    calcularTotales(nuevosItems); // Use the memoized function
  };

  const removerItem = (index) => {
    const nuevosItems = formData.items.filter((_, i) => i !== index);
    calcularTotales(nuevosItems); // Use the memoized function
  };

  const handleProveedorChange = (proveedorId) => {
    const proveedor = proveedores.find(p => p.id === proveedorId);
    setFormData({
      ...formData,
      proveedor_id: proveedorId,
      proveedor_nombre: proveedor?.nombre || ""
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.proveedor_id) {
      alert("Debe seleccionar un proveedor");
      return;
    }
    
    if (formData.items.length === 0) {
      alert("Debe agregar al menos un item");
      return;
    }
    
    onSubmit(formData);
  };

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
        className="w-full max-w-6xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="bg-white shadow-2xl border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900">
                {compra ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Información Básica */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="numero_orden">Número de Orden *</Label>
                  <Input
                    id="numero_orden"
                    value={formData.numero_orden}
                    onChange={(e) => setFormData({...formData, numero_orden: e.target.value})}
                    placeholder="ORD-001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="proveedor">Proveedor *</Label>
                  <Select
                    value={formData.proveedor_id}
                    onValueChange={handleProveedorChange}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {proveedores.filter(p => p.activo).map((proveedor) => (
                        <SelectItem key={proveedor.id} value={proveedor.id}>
                          {proveedor.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="estado">Estado</Label>
                  <Select
                    value={formData.estado}
                    onValueChange={(value) => setFormData({...formData, estado: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="borrador">Borrador</SelectItem>
                      <SelectItem value="enviada">Enviada</SelectItem>
                      <SelectItem value="confirmada">Confirmada</SelectItem>
                      <SelectItem value="recibida">Recibida</SelectItem>
                      <SelectItem value="facturada">Facturada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="fecha_orden">Fecha de Orden *</Label>
                  <Input
                    id="fecha_orden"
                    type="date"
                    value={formData.fecha_orden}
                    onChange={(e) => setFormData({...formData, fecha_orden: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="fecha_entrega_esperada">Fecha de Entrega Esperada</Label>
                  <Input
                    id="fecha_entrega_esperada"
                    type="date"
                    value={formData.fecha_entrega_esperada}
                    onChange={(e) => setFormData({...formData, fecha_entrega_esperada: e.target.value})}
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Items de la Orden</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={agregarItem}
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Item
                  </Button>
                </div>

                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <Card key={item.id} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">Item {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removerItem(index)}
                            className="text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                          <div className="md:col-span-2">
                            <Label className="text-xs">Materia Prima</Label>
                            <Select
                              value={item.materia_prima_id}
                              onValueChange={(value) => actualizarItem(index, 'materia_prima_id', value)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {materiasPrimas.map((materia) => (
                                  <SelectItem key={materia.id} value={materia.id}>
                                    {materia.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Color</Label>
                            <Input
                              value={item.color}
                              onChange={(e) => actualizarItem(index, 'color', e.target.value)}
                              placeholder="Color"
                              className="h-9"
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Cantidad</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.cantidad}
                              onChange={(e) => actualizarItem(index, 'cantidad', parseFloat(e.target.value) || 0)}
                              className="h-9"
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Precio Unit.</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.precio_unitario}
                              onChange={(e) => actualizarItem(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                              className="h-9"
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Subtotal</Label>
                            <div className="h-9 px-3 py-2 border rounded-md bg-slate-50 text-sm">
                              ${item.subtotal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {formData.items.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                      <p className="text-slate-500 mb-4">No hay items agregados</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={agregarItem}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Primer Item
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Totales */}
              {formData.items.length > 0 && (
                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-semibold">${formData.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA (19%):</span>
                        <span className="font-semibold">${formData.impuestos.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>${formData.total.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-4 mt-4 border-t">
                      <Checkbox
                        id="aplicar-impuestos"
                        checked={aplicarImpuestos}
                        onCheckedChange={setAplicarImpuestos}
                      />
                      <Label htmlFor="aplicar-impuestos" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Aplicar IVA (19%)
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Observaciones */}
              <div>
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {compra ? 'Actualizar' : 'Crear'} Orden
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
