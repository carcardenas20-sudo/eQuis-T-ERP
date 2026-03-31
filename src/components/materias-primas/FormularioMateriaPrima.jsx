
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch"; // Added Switch import
import { X, Plus, Trash2, Building } from "lucide-react";
import { motion } from "framer-motion";
import { Proveedor } from "@/entities/Proveedor";

export default function FormularioMateriaPrima({ materia, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(materia || {
    nombre: "",
    precio_por_unidad: "",
    unidad_medida: "",
    tipo_material: "tela", // New field
    color_fijo: false, // New field
    color_por_defecto: "", // New field
    proveedores: [],
    stock_minimo: "",
    observaciones: ""
  });
  const [proveedoresDisponibles, setProveedoresDisponibles] = useState([]);

  useEffect(() => {
    loadProveedores();
  }, []);

  const loadProveedores = async () => {
    try {
      const data = await Proveedor.list();
      setProveedoresDisponibles(data.filter(p => p.activo));
    } catch (error) {
      console.error("Error loading proveedores:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      alert("El nombre de la materia prima es obligatorio.");
      return;
    }

    // Validar color por defecto si es color fijo
    if (formData.color_fijo && !formData.color_por_defecto.trim()) {
      alert("Debe especificar un color por defecto para materiales con color fijo.");
      return;
    }

    // Preparar datos
    const proveedorPrimario = formData.proveedores.find(p => p.tipo === 'primario');
    
    const dataToSubmit = {
      ...formData,
      proveedor: proveedorPrimario?.proveedor_nombre || "",
      precio_por_unidad: parseFloat(formData.precio_por_unidad) || 0,
      stock_minimo: parseFloat(formData.stock_minimo) || 0,
      // Si tiene color fijo, usar el color por defecto como color principal
      color: formData.color_fijo ? formData.color_por_defecto : (formData.color || "")
    };
    
    onSubmit(dataToSubmit);
  };

  const agregarProveedor = () => {
    const tiposDisponibles = ['primario', 'secundario', 'terciario'];
    const tiposUsados = formData.proveedores.map(p => p.tipo);
    const siguienteTipo = tiposDisponibles.find(tipo => !tiposUsados.includes(tipo));
    
    if (siguienteTipo) {
      setFormData({
        ...formData,
        proveedores: [
          ...formData.proveedores,
          {
            proveedor_id: "",
            proveedor_nombre: "",
            tipo: siguienteTipo,
            precio_especial: formData.precio_por_unidad || ""
          }
        ]
      });
    }
  };

  const actualizarProveedor = (index, campo, valor) => {
    const nuevosProveedores = [...formData.proveedores];
    
    if (campo === 'proveedor_id') {
      const proveedor = proveedoresDisponibles.find(p => p.id === valor);
      nuevosProveedores[index] = {
        ...nuevosProveedores[index],
        proveedor_id: valor,
        proveedor_nombre: proveedor?.nombre || ""
      };
    } else {
      nuevosProveedores[index] = {
        ...nuevosProveedores[index],
        [campo]: valor
      };
    }
    
    setFormData({
      ...formData,
      proveedores: nuevosProveedores
    });
  };

  const removerProveedor = (index) => {
    setFormData({
      ...formData,
      proveedores: formData.proveedores.filter((_, i) => i !== index)
    });
  };

  const getTipoColor = (tipo) => {
    const colors = {
      primario: 'bg-green-100 text-green-800 border-green-200',
      secundario: 'bg-blue-100 text-blue-800 border-blue-200',
      terciario: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[tipo] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const puedeAgregarProveedor = formData.proveedores.length < 3;
  const proveedores = formData.proveedores || [];

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
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="bg-white shadow-2xl border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900">
                {materia ? 'Editar Materia Prima' : 'Nueva Materia Prima'}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-white/50">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Información Básica */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  Información Básica
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="nombre" className="text-sm font-medium text-slate-700">
                      Nombre de la Materia Prima *
                    </Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                      placeholder="Ej: Gabardina Premium, Cremallera Metálica"
                      className="border-slate-200 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* New: Tipo de Material */}
                  <div className="space-y-2">
                    <Label htmlFor="tipo_material" className="text-sm font-medium text-slate-700">
                      Tipo de Material *
                    </Label>
                    <Select
                      value={formData.tipo_material}
                      onValueChange={(value) => setFormData({...formData, tipo_material: value})}
                      required
                    >
                      <SelectTrigger className="border-slate-200 focus:ring-2 focus:ring-blue-500">
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tela">Tela</SelectItem>
                        <SelectItem value="forro">Forro</SelectItem>
                        <SelectItem value="cremallera">Cremallera</SelectItem>
                        <SelectItem value="boton">Botón</SelectItem>
                        <SelectItem value="hilo">Hilo</SelectItem>
                        <SelectItem value="accesorio">Accesorio</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unidad_medida" className="text-sm font-medium text-slate-700">
                      Unidad de Medida *
                    </Label>
                    <Select
                      value={formData.unidad_medida}
                      onValueChange={(value) => setFormData({...formData, unidad_medida: value})}
                      required
                    >
                      <SelectTrigger className="border-slate-200 focus:ring-2 focus:ring-blue-500">
                        <SelectValue placeholder="Selecciona la unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metro">Metro</SelectItem>
                        <SelectItem value="unidad">Unidad</SelectItem>
                        <SelectItem value="gramos">Gramos</SelectItem>
                        <SelectItem value="centimetros">Centímetros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="precio_por_unidad" className="text-sm font-medium text-slate-700">
                      Precio Base por Unidad *
                    </Label>
                    <Input
                      id="precio_por_unidad"
                      type="number"
                      step="0.01"
                      value={formData.precio_por_unidad}
                      onChange={(e) => setFormData({...formData, precio_por_unidad: e.target.value})}
                      placeholder="0.00"
                      className="border-slate-200 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* New: Configuración de Color */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  Configuración de Color
                </h3>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor="color_fijo" className="text-sm font-medium text-slate-700">
                      Color Fijo
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Activar si este material siempre usa el mismo color (ej: cremalleras, botones)
                    </p>
                  </div>
                  <Switch
                    id="color_fijo"
                    checked={formData.color_fijo}
                    onCheckedChange={(checked) => setFormData({...formData, color_fijo: checked})}
                  />
                </div>

                {formData.color_fijo && (
                  <div className="space-y-2">
                    <Label htmlFor="color_por_defecto" className="text-sm font-medium text-slate-700">
                      Color por Defecto *
                    </Label>
                    <Input
                      id="color_por_defecto"
                      value={formData.color_por_defecto}
                      onChange={(e) => setFormData({...formData, color_por_defecto: e.target.value})}
                      placeholder="Ej: Negro, Plateado, Dorado"
                      className="border-slate-200 focus:ring-2 focus:ring-blue-500"
                      required={formData.color_fijo} // Make required if color_fijo is true
                    />
                    <p className="text-xs text-slate-500">
                      Este color se aplicará automáticamente en todos los presupuestos
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="stock_minimo" className="text-sm font-medium text-slate-700">
                    Stock Mínimo
                  </Label>
                  <Input
                    id="stock_minimo"
                    type="number"
                    step="0.01"
                    value={formData.stock_minimo}
                    onChange={(e) => setFormData({...formData, stock_minimo: e.target.value})}
                    placeholder="0"
                    className="border-slate-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Proveedores */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Proveedores</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Asigna hasta 3 proveedores para esta materia prima
                    </p>
                  </div>
                  {puedeAgregarProveedor && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={agregarProveedor}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Proveedor
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  {proveedores.map((proveedor, index) => (
                    <Card key={index} className="border-slate-200 bg-slate-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-slate-400" />
                            <Badge className={`${getTipoColor(proveedor.tipo)} border font-medium text-xs`}>
                              Proveedor {proveedor.tipo}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removerProveedor(index)}
                            className="text-red-500 hover:bg-red-50 h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-600">Empresa</Label>
                            <Select
                              value={proveedor.proveedor_id}
                              onValueChange={(value) => actualizarProveedor(index, 'proveedor_id', value)}
                            >
                              <SelectTrigger className="h-9 border-slate-200">
                                <SelectValue placeholder="Seleccionar proveedor" />
                              </SelectTrigger>
                              <SelectContent>
                                {proveedoresDisponibles.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-slate-600">Precio Especial</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={proveedor.precio_especial}
                              onChange={(e) => actualizarProveedor(index, 'precio_especial', parseFloat(e.target.value))}
                              placeholder="Precio con este proveedor"
                              className="h-9 border-slate-200"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {proveedores.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                      <Building className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-500 mb-4">No hay proveedores asignados</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={agregarProveedor}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Primer Proveedor
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-2">
                <Label htmlFor="observaciones" className="text-sm font-medium text-slate-700">
                  Observaciones
                </Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                  placeholder="Notas adicionales sobre la materia prima..."
                  rows={3}
                  className="border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8"
                >
                  {materia ? 'Actualizar' : 'Crear'} Materia Prima
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
