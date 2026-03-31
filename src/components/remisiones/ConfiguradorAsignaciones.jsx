import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Zap, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ConfiguradorAsignaciones({ presupuesto, productos, colores, onGenerar, onCancelar }) {
  const [configuraciones, setConfiguraciones] = useState(() => {
    const config = {};
    
    (presupuesto.productos || []).forEach(productoItem => {
      const productoInfo = productos.find(p => p.id === productoItem.producto_id);
      
      (productoItem.combinaciones || []).forEach((combinacion, combIndex) => {
        const combId = `${productoItem.id}_${combIndex}`;
        
        config[combId] = {
          producto_id: productoItem.producto_id,
          producto_nombre: productoInfo?.nombre || 'Producto',
          combinacion,
          colores_texto: Object.entries(combinacion.colores || {})
            .map(([seccion, colorId]) => {
              const colorObj = colores.find(c => c.id === colorId);
              return `${seccion}: ${colorObj?.nombre || 'N/A'}`;
            })
            .join(', '),
          tallas: (combinacion.tallas_cantidades || []).map(tc => ({
            talla: tc.talla,
            cantidad_total: tc.cantidad,
            cantidad_por_operario: 0,
            num_operarios: 0
          }))
        };
      });
    });
    
    return config;
  });

  const actualizarTalla = (combId, tallaIndex, campo, valor) => {
    setConfiguraciones(prev => {
      const nuevaConfig = { ...prev };
      nuevaConfig[combId] = { ...nuevaConfig[combId] };
      nuevaConfig[combId].tallas = [...nuevaConfig[combId].tallas];
      nuevaConfig[combId].tallas[tallaIndex] = {
        ...nuevaConfig[combId].tallas[tallaIndex],
        [campo]: parseInt(valor) || 0
      };
      return nuevaConfig;
    });
  };

  const autoLlenarTalla = (combId, tallaIndex, sugerencia) => {
    setConfiguraciones(prev => {
      const nuevaConfig = { ...prev };
      nuevaConfig[combId] = { ...nuevaConfig[combId] };
      nuevaConfig[combId].tallas = [...nuevaConfig[combId].tallas];
      nuevaConfig[combId].tallas[tallaIndex] = {
        ...nuevaConfig[combId].tallas[tallaIndex],
        cantidad_por_operario: sugerencia.cantidad_por_operario,
        num_operarios: sugerencia.num_operarios
      };
      return nuevaConfig;
    });
  };

  const validaciones = useMemo(() => {
    const result = {};
    
    Object.entries(configuraciones).forEach(([combId, config]) => {
      config.tallas.forEach((talla, idx) => {
        const total_asignado = talla.cantidad_por_operario * talla.num_operarios;
        const key = `${combId}_${idx}`;
        
        result[key] = {
          valido: total_asignado === talla.cantidad_total,
          total_asignado,
          diferencia: total_asignado - talla.cantidad_total
        };
      });
    });
    
    return result;
  }, [configuraciones]);

  const todoValido = useMemo(() => {
    return Object.values(validaciones).every(v => v.valido);
  }, [validaciones]);

  const handleGenerar = () => {
    if (!todoValido) {
      alert('Por favor ajusta las cantidades. Todas las tallas deben estar completamente asignadas.');
      return;
    }
    
    onGenerar(configuraciones);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full"
        style={{ 
          maxWidth: '1200px',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-2xl" style={{ flexShrink: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-6 h-6 text-purple-600" />
                Configurar Asignaciones Individuales
              </h2>
              <p className="text-slate-600 mt-1">
                Especifica cuántas unidades por operario y cuántos operarios para cada talla
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancelar}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div 
          className="p-6" 
          style={{ 
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          <div className="space-y-6">
            {Object.entries(configuraciones).map(([combId, config]) => (
              <Card key={combId} className="border-2 border-slate-200">
                <CardHeader className="bg-slate-50 pb-3">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{config.producto_nombre}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {config.colores_texto.split(', ').map((color, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {color}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {config.tallas.map((talla, tallaIndex) => {
                      const validacionKey = `${combId}_${tallaIndex}`;
                      const validacion = validaciones[validacionKey];
                      
                      const sugerencias = [];
                      
                      if (talla.cantidad_total > 0) {
                        sugerencias.push({
                          nombre: '1 operario',
                          cantidad_por_operario: talla.cantidad_total,
                          num_operarios: 1
                        });
                      }
                      
                      if (talla.cantidad_total >= 20) {
                        const cantPorOp = 20;
                        const numOp = Math.ceil(talla.cantidad_total / cantPorOp);
                        sugerencias.push({
                          nombre: `~20 c/u`,
                          cantidad_por_operario: Math.ceil(talla.cantidad_total / numOp),
                          num_operarios: numOp
                        });
                      }
                      
                      if (talla.cantidad_total >= 10) {
                        for (let numOp of [2, 3, 4, 5]) {
                          if (talla.cantidad_total % numOp === 0) {
                            sugerencias.push({
                              nombre: `${numOp} operarios`,
                              cantidad_por_operario: talla.cantidad_total / numOp,
                              num_operarios: numOp
                            });
                            break;
                          }
                        }
                      }

                      return (
                        <div key={tallaIndex} className="border border-slate-200 rounded-lg p-4 bg-white">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Badge className="bg-indigo-100 text-indigo-700 text-sm font-bold">
                                Talla {talla.talla}
                              </Badge>
                              <span className="text-sm text-slate-600">
                                Total disponible: <strong>{talla.cantidad_total}</strong> unidades
                              </span>
                            </div>
                            
                            {validacion && (
                              <div className="flex items-center gap-2">
                                {validacion.valido ? (
                                  <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Completo
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {validacion.diferencia > 0 ? `+${validacion.diferencia}` : validacion.diferencia} unidades
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>

                          {sugerencias.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2">
                              <span className="text-xs text-slate-500 self-center mr-2">Sugerencias:</span>
                              {sugerencias.map((sug, idx) => (
                                <Button
                                  key={idx}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => autoLlenarTalla(combId, tallaIndex, sug)}
                                  className="h-7 text-xs"
                                >
                                  <Zap className="w-3 h-3 mr-1" />
                                  {sug.nombre}
                                </Button>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label className="text-xs text-slate-600 mb-1 block">
                                Cantidad por operario
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                value={talla.cantidad_por_operario || ''}
                                onChange={(e) => actualizarTalla(combId, tallaIndex, 'cantidad_por_operario', e.target.value)}
                                placeholder="Ej: 15"
                                className="h-9"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-slate-600 mb-1 block">
                                Número de operarios
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                value={talla.num_operarios || ''}
                                onChange={(e) => actualizarTalla(combId, tallaIndex, 'num_operarios', e.target.value)}
                                placeholder="Ej: 3"
                                className="h-9"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-slate-600 mb-1 block">
                                Total asignado
                              </Label>
                              <div className={`h-9 flex items-center justify-center rounded-md border-2 font-bold ${
                                validacion?.valido 
                                  ? 'bg-green-50 border-green-300 text-green-700' 
                                  : 'bg-slate-50 border-slate-300 text-slate-700'
                              }`}>
                                {validacion?.total_asignado || 0} / {talla.cantidad_total}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl" style={{ flexShrink: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {todoValido ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 font-medium">
                    Todas las tallas están correctamente asignadas
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span className="text-amber-700 font-medium">
                    Ajusta las cantidades para continuar
                  </span>
                </>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancelar}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerar}
                disabled={!todoValido}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <Zap className="w-4 h-4 mr-2" />
                Generar Asignaciones
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}