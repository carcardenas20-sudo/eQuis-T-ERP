import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Truck } from "lucide-react";
import _ from 'lodash';

export default function FormularioRemision({ presupuesto, operaciones, onSubmit, onCancel }) {
  const [remisionData, setRemisionData] = useState({
    tipo_remision: '',
    subtipo_corte: '',
    operario_asignado: '',
    fecha_entrega: '',
    observaciones: '',
  });

  const tiposDeRemision = useMemo(() => {
    const tipos = (operaciones || [])
      .filter(op => op.activa)
      .map(op => ({
        id: op.nombre.replace(/\s/g, '_'),
        label: op.nombre,
        es_corte: op.nombre.toLowerCase() === 'corte'
      }));
    return _.uniqBy(tipos, 'id');
  }, [operaciones]);

  const subtiposDeCorte = useMemo(() => {
    if (remisionData.tipo_remision !== 'Corte') return [];
    
    const materialesCorte = (presupuesto.materiales_calculados || [])
      .filter(m => ['tela', 'forro'].includes(m.tipo_material));
    
    return _.uniq(materialesCorte.map(m => m.nombre));
  }, [remisionData.tipo_remision, presupuesto.materiales_calculados]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRemisionData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setRemisionData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!remisionData.tipo_remision) {
      alert("Debes seleccionar un tipo de remisión.");
      return;
    }
    
    if (remisionData.tipo_remision === 'Corte' && !remisionData.subtipo_corte) {
      alert("Debes seleccionar un material para la remisión de corte.");
      return;
    }

    const timestamp = Date.now();
    let finalRemision = {
      ...remisionData,
      presupuesto_id: presupuesto.id,
      numero_remision: `REM-${presupuesto.numero_presupuesto.replace('PRE-', '')}-${remisionData.tipo_remision.substring(0,4)}-${timestamp}`,
      estado: 'pendiente'
    };

    if (remisionData.tipo_remision === 'Corte') {
      const materialesParaEsteCorte = presupuesto.materiales_calculados.filter(
        m => m.nombre === remisionData.subtipo_corte
      );
      finalRemision.detalles_corte = materialesParaEsteCorte.map(m => ({
        color: m.color,
        cantidad_total: m.cantidad_total,
        unidad_medida: m.unidad_medida,
      }));
      finalRemision.productos_asignados = []; // En corte no se asignan productos directamente
    } else {
      finalRemision.productos_asignados = presupuesto.productos || [];
      finalRemision.detalles_corte = [];
    }
    
    onSubmit(finalRemision);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-6 h-6 text-teal-600" />
                Crear Nueva Remisión
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X />
              </Button>
            </div>
            <p className="text-sm text-slate-500 pt-1">
              Desde Presupuesto: {presupuesto.numero_presupuesto}
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="tipo_remision">Tipo de Remisión *</Label>
                <Select
                  value={remisionData.tipo_remision}
                  onValueChange={(value) => handleSelectChange('tipo_remision', value)}
                >
                  <SelectTrigger id="tipo_remision">
                    <SelectValue placeholder="Selecciona un tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposDeRemision.map(tipo => (
                      <SelectItem key={tipo.id} value={tipo.id}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {remisionData.tipo_remision === 'Corte' && (
                <div>
                  <Label htmlFor="subtipo_corte">Material a Cortar *</Label>
                  <Select
                    value={remisionData.subtipo_corte}
                    onValueChange={(value) => handleSelectChange('subtipo_corte', value)}
                  >
                    <SelectTrigger id="subtipo_corte">
                      <SelectValue placeholder="Selecciona un material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subtiposDeCorte.map(subtipo => (
                        <SelectItem key={subtipo} value={subtipo}>
                          {subtipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="operario_asignado">Operario Asignado</Label>
                <Input
                  id="operario_asignado"
                  name="operario_asignado"
                  value={remisionData.operario_asignado}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="fecha_entrega">Fecha de Entrega</Label>
                <Input
                  id="fecha_entrega"
                  name="fecha_entrega"
                  type="date"
                  value={remisionData.fecha_entrega}
                  onChange={handleInputChange}
                />
              </div>
              
              <div>
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  name="observaciones"
                  value={remisionData.observaciones}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button type="submit">Crear Remisión</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}