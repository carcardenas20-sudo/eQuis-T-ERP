import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Settings } from "lucide-react";
import { motion } from "framer-motion";

const TIPOS_MATERIALES = [
  { value: 'tela', label: 'Tela', color: 'bg-blue-100 text-blue-800' },
  { value: 'forro', label: 'Forro', color: 'bg-purple-100 text-purple-800' },
  { value: 'cremallera', label: 'Cremallera', color: 'bg-green-100 text-green-800' },
  { value: 'boton', label: 'Botón', color: 'bg-orange-100 text-orange-800' },
  { value: 'hilo', label: 'Hilo', color: 'bg-pink-100 text-pink-800' },
  { value: 'accesorio', label: 'Accesorio', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'otro', label: 'Otro', color: 'bg-gray-100 text-gray-800' }
];

export default function FormularioOperacion({ operacion, materiasPrimas, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(operacion || {
    nombre: "",
    descripcion: "",
    tipos_materiales_requeridos: [],
    materiales_especificos: [],
    condicion_logica: "cualquiera",
    activa: true,
    orden_procesamiento: 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      alert("El nombre de la operación es obligatorio.");
      return;
    }
    
    if (formData.tipos_materiales_requeridos.length === 0 && formData.materiales_especificos.length === 0) {
      alert("Debe seleccionar al menos un tipo de material o material específico.");
      return;
    }
    
    onSubmit(formData);
  };

  const toggleTipoMaterial = (tipo) => {
    const current = formData.tipos_materiales_requeridos || [];
    const updated = current.includes(tipo)
      ? current.filter(t => t !== tipo)
      : [...current, tipo];
    
    setFormData({
      ...formData,
      tipos_materiales_requeridos: updated
    });
  };

  const toggleMaterialEspecifico = (materialId) => {
    const current = formData.materiales_especificos || [];
    const updated = current.includes(materialId)
      ? current.filter(id => id !== materialId)
      : [...current, materialId];
    
    setFormData({
      ...formData,
      materiales_especificos: updated
    });
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
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="bg-white shadow-2xl border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-amber-600" />
                <CardTitle className="text-2xl font-bold text-slate-900">
                  {operacion ? 'Editar Operación' : 'Nueva Operación'}
                </CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-white/50">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Información Básica */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  Información Básica
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre" className="text-sm font-medium text-slate-700">
                      Nombre de la Operación *
                    </Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                      placeholder="Ej: Termofijado, Sesgado"
                      className="border-slate-200 focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="orden_procesamiento" className="text-sm font-medium text-slate-700">
                      Orden de Procesamiento
                    </Label>
                    <Input
                      id="orden_procesamiento"
                      type="number"
                      value={formData.orden_procesamiento}
                      onChange={(e) => setFormData({...formData, orden_procesamiento: parseInt(e.target.value) || 0})}
                      placeholder="0"
                      className="border-slate-200 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion" className="text-sm font-medium text-slate-700">
                    Descripción
                  </Label>
                  <Textarea
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    placeholder="Describe qué hace esta operación..."
                    rows={3}
                    className="border-slate-200 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Tipos de Materiales */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  Tipos de Materiales que Activan esta Operación
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {TIPOS_MATERIALES.map((tipo) => (
                    <div key={tipo.value} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <Checkbox
                        id={`tipo-${tipo.value}`}
                        checked={(formData.tipos_materiales_requeridos || []).includes(tipo.value)}
                        onCheckedChange={() => toggleTipoMaterial(tipo.value)}
                      />
                      <Label htmlFor={`tipo-${tipo.value}`} className="flex-1 cursor-pointer">
                        <Badge className={`${tipo.color} border-0`}>
                          {tipo.label}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Condición Lógica
                  </Label>
                  <Select
                    value={formData.condicion_logica}
                    onValueChange={(value) => setFormData({...formData, condicion_logica: value})}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-2 focus:ring-amber-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cualquiera">Activar si hay CUALQUIER material seleccionado</SelectItem>
                      <SelectItem value="todos">Activar solo si están TODOS los materiales seleccionados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Materiales Específicos (Opcional) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  Materiales Específicos (Opcional)
                </h3>
                <p className="text-sm text-slate-500">
                  Si seleccionas materiales específicos, la operación también se activará cuando estos estén presentes.
                </p>
                
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                  <div className="space-y-2">
                    {materiasPrimas.map((material) => (
                      <div key={material.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded">
                        <Checkbox
                          id={`material-${material.id}`}
                          checked={(formData.materiales_especificos || []).includes(material.id)}
                          onCheckedChange={() => toggleMaterialEspecifico(material.id)}
                        />
                        <Label htmlFor={`material-${material.id}`} className="flex-1 cursor-pointer text-sm">
                          {material.nombre}
                          {material.tipo_material && (
                            <Badge className="ml-2 text-xs" variant="outline">
                              {material.tipo_material}
                            </Badge>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Estado */}
              <div className="flex items-center justify-between py-2">
                <Label htmlFor="activa" className="text-sm font-medium text-slate-700">
                  Operación Activa
                </Label>
                <Switch
                  id="activa"
                  checked={formData.activa}
                  onCheckedChange={(checked) => setFormData({...formData, activa: checked})}
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-8"
                >
                  {operacion ? 'Actualizar' : 'Crear'} Operación
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}