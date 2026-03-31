
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Calculator, RefreshCw, GripVertical, CheckSquare, ShoppingCart, DollarSign, TrendingUp, Plus } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function CalculadoraMateriales({
  materiales,
  totalManoObra,
  margenGanancia,
  totalGeneral,
  colores,
  onMargenChange,
  onMaterialesChange,
  onResetCalculations
}) {

  // Función para manejar el final del arrastre
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(materiales);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onMaterialesChange(items);
  };

  const actualizarMaterial = (index, campo, valor) => {
    const nuevosMateriales = [...materiales];
    const material = { ...nuevosMateriales[index] };
    const valorNumerico = parseFloat(valor) || 0;

    if (campo === 'precio_unitario') {
      material.precio_unitario = valorNumerico;
    } else if (campo === 'cantidad_total') {
      material.cantidad_total = valorNumerico;
    }
    
    material.costo_total = material.cantidad_total * material.precio_unitario;
    nuevosMateriales[index] = material;
    onMaterialesChange(nuevosMateriales);
  };
  
  const toggleComprado = (index, checked) => {
    const nuevosMateriales = [...materiales];
    const material = { ...nuevosMateriales[index] };
    material.comprado = checked;
    nuevosMateriales[index] = material;
    onMaterialesChange(nuevosMateriales);
  };
  
  // ✨ CÁLCULOS DE SEGUIMIENTO DE COMPRAS
  const totalMateriales = materiales.reduce((sum, m) => sum + (m.costo_total || 0), 0);
  const totalComprado = materiales.reduce((sum, m) => sum + (m.comprado ? (m.costo_total || 0) : 0), 0);
  const totalFaltante = totalMateriales - totalComprado;
  const porcentajeComprado = totalMateriales > 0 ? (totalComprado / totalMateriales) * 100 : 0;
  
  const subtotal = totalMateriales + totalManoObra;
  const totalCompraSinManoObra = totalComprado;
  const totalFaltanteSinManoObra = totalFaltante;

  // ✨ FUNCIÓN PARA AGREGAR MATERIAL MANUALMENTE
  const agregarMaterialManual = () => {
    const nuevoMaterial = {
      materia_prima_id: `manual_${Date.now()}`,
      nombre: 'Material personalizado',
      color: 'A definir',
      precio_unitario: 0,
      unidad_medida: 'unidad',
      cantidad_total: 0,
      costo_total: 0,
      tipo_material: 'otro',
      comprado: false
    };
    
    onMaterialesChange([...materiales, nuevoMaterial]);
  };

  return (
    <Card className="bg-gradient-to-r from-slate-50 to-green-50 border-slate-200">
      <CardHeader className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-6 h-6 text-green-600" />
            <CardTitle className="text-xl font-bold text-slate-900">
              Materiales y Costos
            </CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={agregarMaterialManual}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <Plus className="w-3 h-3 mr-2" />
              Agregar Manual
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResetCalculations}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              Recalcular
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          ✨ <strong>Sistema Híbrido:</strong> Cálculo automático + edición manual cuando necesites ajustes específicos
        </p>
      </CardHeader>
      
      <CardContent className="p-6">
        {materiales.length > 0 ? (
          <div className="space-y-6">
            {/* ✨ NUEVO: RESUMEN DE PROGRESO DE COMPRAS */}
            <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-slate-900">Progreso de Compras</h4>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    {porcentajeComprado.toFixed(1)}% completado
                  </Badge>
                </div>
                
                <Progress value={porcentajeComprado} className="mb-4" />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white/50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckSquare className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-slate-700">Ya Comprado</span>
                    </div>
                    <div className="text-lg font-bold text-green-700">
                      ${totalComprado.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="bg-white/50 rounded-lg p-3 border border-orange-200">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-orange-600" />
                      <span className="font-medium text-slate-700">Faltante</span>
                    </div>
                    <div className="text-lg font-bold text-orange-700">
                      ${totalFaltante.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="bg-white/50 rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-slate-600" />
                      <span className="font-medium text-slate-700">Total Materiales</span>
                    </div>
                    <div className="text-lg font-bold text-slate-700">
                      ${totalMateriales.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 p-0"></TableHead>
                    <TableHead className="w-12 text-center">
                      <CheckSquare className="w-5 h-5 mx-auto text-slate-500" title="Comprado"/>
                    </TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-right">Cantidad Total</TableHead>
                    <TableHead className="text-right">Precio Unitario</TableHead>
                    <TableHead className="text-right">Costo Total</TableHead>
                  </TableRow>
                </TableHeader>
                
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="materiales-calculados">
                    {(provided) => (
                      <TableBody {...provided.droppableProps} ref={provided.innerRef}>
                        {materiales.map((material, index) => {
                          const colorInfo = colores?.find(c => c.id === material.color_id);
                          
                          return (
                            <Draggable 
                              key={`${material.materia_prima_id}-${material.color_id || material.color}-${index}`}
                              draggableId={`${material.materia_prima_id}-${material.color_id || material.color}-${index}`} 
                              index={index}
                            >
                              {(providedDraggable, snapshot) => (
                                <TableRow
                                  ref={providedDraggable.innerRef}
                                  {...providedDraggable.draggableProps}
                                  className={`transition-colors ${snapshot.isDragging ? 'bg-green-100 shadow-lg' : 'hover:bg-slate-50'} ${material.comprado ? 'bg-green-50/50' : ''}`}
                                >
                                  <TableCell 
                                    {...providedDraggable.dragHandleProps} 
                                    className="w-8 cursor-grab active:cursor-grabbing text-slate-400 hover:text-green-600"
                                  >
                                    <GripVertical className="w-5 h-5" />
                                  </TableCell>
                                  <TableCell className="w-12 text-center">
                                    <Checkbox
                                      checked={!!material.comprado}
                                      onCheckedChange={(checked) => toggleComprado(index, checked)}
                                    />
                                  </TableCell>
                                  <TableCell className={`font-medium ${material.comprado ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                    {material.nombre}
                                    {material.tipo_material && (
                                        <Badge className="text-xs mt-1 bg-slate-100 text-slate-700">
                                            {material.tipo_material}
                                        </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {colorInfo ? (
                                      <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: colorInfo.codigo_hex }}></div>
                                        <span className="text-sm text-slate-700">{colorInfo.nombre}</span>
                                      </div>
                                    ) : (
                                      <Badge variant="outline" className="text-sm text-slate-700">{material.color}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={(material.cantidad_total || 0).toFixed(2)}
                                        onChange={(e) => actualizarMaterial(index, 'cantidad_total', e.target.value)}
                                        className="h-8 w-24 text-right border-slate-200 focus:ring-1 focus:ring-green-500"
                                      />
                                      <span className="text-xs text-slate-500 w-12">{material.unidad_medida}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end">
                                      <span className="text-sm mr-1 text-slate-500">$</span>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={(material.precio_unitario || 0).toFixed(2)}
                                        onChange={(e) => actualizarMaterial(index, 'precio_unitario', e.target.value)}
                                        className="h-8 w-24 text-right border-slate-200 focus:ring-1 focus:ring-green-500"
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className={`text-right font-semibold ${material.comprado ? 'text-green-600' : 'text-slate-800'}`}>
                                    ${(material.costo_total || 0).toFixed(2)}
                                    {material.comprado && (
                                      <Badge className="ml-2 bg-green-100 text-green-700 text-xs">
                                        ✓ Pagado
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </TableBody>
                    )}
                  </Droppable>
                </DragDropContext>
              </Table>
            </div>

            {/* Resumen de costos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-700">
                      Margen de Ganancia
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={margenGanancia}
                        onChange={(e) => onMargenChange(parseFloat(e.target.value) || 0)}
                        className="border-slate-200 focus:ring-2 focus:ring-green-500"
                      />
                      <span className="text-sm text-slate-500">%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ✨ RESUMEN MEJORADO CON SEGUIMIENTO */}
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Materiales Total:</span>
                      <span className="font-medium">${totalMateriales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-700">
                      <span>└ Ya Comprado:</span>
                      <span className="font-medium">-${totalComprado.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-orange-700">
                      <span>└ Por Comprar:</span>
                      <span className="font-medium">${totalFaltante.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Mano de Obra:</span>
                      <span className="font-medium">${totalManoObra.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Subtotal:</span>
                      <span className="font-medium">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-900">TOTAL FINAL:</span>
                        <span className="font-bold text-xl text-green-600">
                          ${totalGeneral.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Calculator className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No hay materiales calculados aún</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
