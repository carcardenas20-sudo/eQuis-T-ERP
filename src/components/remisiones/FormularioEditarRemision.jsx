import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Save, Shirt, Package } from "lucide-react";

export default function FormularioEditarRemision({ remision, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    operario_asignado: remision.operario_asignado || '',
    fecha_entrega: remision.fecha_entrega || '',
    estado: remision.estado || 'pendiente',
    observaciones: remision.observaciones || '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-2xl">
        <Card className="border-0">
          <CardHeader className="border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Save className="w-6 h-6 text-teal-600" />
                Editar Remisión
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X />
              </Button>
            </div>
            <div className="text-sm text-slate-500">
              <p><strong>Número:</strong> {remision.numero_remision}</p>
              <p><strong>Tipo:</strong> {remision.tipo_remision.replace(/_/g, ' ')}</p>
            </div>
          </CardHeader>
          <CardContent className="p-6 max-h-[75vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="operario_asignado">Operario Asignado</Label>
                  <Input
                    id="operario_asignado"
                    name="operario_asignado"
                    value={formData.operario_asignado}
                    onChange={handleInputChange}
                    placeholder="Nombre del operario"
                  />
                </div>

                <div>
                  <Label htmlFor="estado">Estado</Label>
                  <Select
                    value={formData.estado}
                    onValueChange={(value) => handleSelectChange('estado', value)}
                  >
                    <SelectTrigger id="estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="en_proceso">En Proceso</SelectItem>
                      <SelectItem value="completado">Completado</SelectItem>
                      <SelectItem value="pausado">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="fecha_entrega">Fecha de Entrega</Label>
                <Input
                  id="fecha_entrega"
                  name="fecha_entrega"
                  type="date"
                  value={formData.fecha_entrega}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="observaciones">Observaciones Generales</Label>
                <Textarea
                  id="observaciones"
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Observaciones adicionales sobre la remisión..."
                />
              </div>
              
              {/* Resumen de Asignaciones (Solo Lectura) */}
              <div className="space-y-4 border-t pt-4">
                {remision.productos_asignados && remision.productos_asignados.length > 0 && (
                  <div>
                    <Label className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-2">
                      <Shirt className="w-5 h-5 text-teal-600" />
                      Resumen de Productos Asignados
                    </Label>
                    <div className="text-xs text-slate-500 space-y-1">
                      {remision.productos_asignados.map((p, i) => (
                        <p key={i}>- <strong>{p.total_unidades}x</strong> {p.producto_nombre}</p>
                      ))}
                    </div>
                  </div>
                )}
                
                {remision.materiales_calculados && remision.materiales_calculados.length > 0 && (
                  <div>
                    <Label className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-2">
                      <Package className="w-5 h-5 text-blue-600" />
                      Resumen de Materiales
                    </Label>
                    <div className="text-xs text-slate-500 space-y-1">
                      {remision.materiales_calculados.map((m, i) => (
                        <p key={i}>- {m.nombre} ({m.color}): <strong>{m.cantidad_total} {m.unidad_medida}</strong></p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}