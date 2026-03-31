import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Wand2, X, Check } from "lucide-react";

/**
 * GeneradorCombinaciones
 * Permite seleccionar múltiples colores por sección y cantidades por talla,
 * luego genera todas las combinaciones posibles (producto cartesiano).
 */
export default function GeneradorCombinaciones({ producto, colores, onGenerar, onCancelar }) {
  const secciones = getSecciones(producto);
  
  // { [seccionKey]: [colorId, colorId, ...] }
  const [colorSeleccionados, setColorSeleccionados] = useState({});
  // [{ talla, cantidad }]
  const [tallaCantidades, setTallaCantidades] = useState(
    (producto?.tallas || ['S', 'M', 'L', 'XL']).map(t => ({ talla: t, cantidad: 0 }))
  );

  const toggleColor = (seccionKey, colorId) => {
    setColorSeleccionados(prev => {
      const actuales = prev[seccionKey] || [];
      const existe = actuales.includes(colorId);
      return {
        ...prev,
        [seccionKey]: existe ? actuales.filter(id => id !== colorId) : [...actuales, colorId]
      };
    });
  };

  const actualizarCantidadTalla = (index, cantidad) => {
    setTallaCantidades(prev => {
      const nuevo = [...prev];
      nuevo[index] = { ...nuevo[index], cantidad: parseInt(cantidad) || 0 };
      return nuevo;
    });
  };

  // Producto cartesiano de arrays
  const cartesiano = (arrays) => {
    if (arrays.length === 0) return [[]];
    const [primero, ...resto] = arrays;
    const subProducto = cartesiano(resto);
    return primero.flatMap(val => subProducto.map(sub => [val, ...sub]));
  };

  const calcularCombinaciones = () => {
    const seccionesConColores = secciones.filter(s => (colorSeleccionados[s.key] || []).length > 0);
    if (seccionesConColores.length === 0) return [];
    
    const arrays = seccionesConColores.map(s => colorSeleccionados[s.key]);
    const combinacionesKeys = cartesiano(arrays);
    
    return combinacionesKeys.map(combo => {
      const coloresObj = {};
      seccionesConColores.forEach((sec, i) => {
        coloresObj[sec.key] = combo[i];
      });
      return coloresObj;
    });
  };

  const totalCombinaciones = calcularCombinaciones().length;
  const totalUnidades = tallaCantidades.reduce((sum, tc) => sum + tc.cantidad, 0);

  const handleGenerar = () => {
    const combinaciones = calcularCombinaciones();
    if (combinaciones.length === 0) return;
    
    const tallasFiltradas = tallaCantidades.filter(tc => tc.cantidad > 0);
    if (tallasFiltradas.length === 0) return;

    const nuevasCombinaciones = combinaciones.map(coloresObj => ({
      id: `${Date.now()}_${Math.random()}`,
      colores: coloresObj,
      tallas_cantidades: tallasFiltradas.map(tc => ({ talla: tc.talla, cantidad: tc.cantidad }))
    }));

    onGenerar(nuevasCombinaciones);
  };

  const coloresActivos = colores.filter(c => c.activo);

  return (
    <div className="space-y-5 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
      <div className="flex items-center gap-2">
        <Wand2 className="w-5 h-5 text-indigo-600" />
        <h4 className="font-semibold text-indigo-900">Generador Masivo de Combinaciones</h4>
      </div>

      {/* Selección de colores por sección */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-slate-700">1. Selecciona colores por sección</Label>
        {secciones.map(seccion => (
          <div key={seccion.key}>
            <Label className="text-xs text-slate-500 mb-1 block">{seccion.label}</Label>
            <div className="flex flex-wrap gap-2">
              {coloresActivos.map(color => {
                const seleccionado = (colorSeleccionados[seccion.key] || []).includes(color.id);
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => toggleColor(seccion.key, color.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium transition-all ${
                      seleccionado
                        ? 'border-indigo-500 bg-indigo-100 text-indigo-800 shadow-sm'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full border border-white/50 shrink-0"
                      style={{ backgroundColor: color.codigo_hex }}
                    />
                    {color.nombre}
                    {seleccionado && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Cantidades por talla */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-slate-700">2. Define cantidades por talla (se aplican a todas las combinaciones)</Label>
        <div className="flex flex-wrap gap-2">
          {tallaCantidades.map((tc, i) => (
            <div key={tc.talla} className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
              <span className="text-xs font-bold text-slate-700 w-6 text-center">{tc.talla}</span>
              <Input
                type="number"
                min="0"
                value={tc.cantidad}
                onChange={(e) => actualizarCantidadTalla(i, e.target.value)}
                className="w-14 h-6 text-xs text-center"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Preview y acción */}
      <Card className={`border-2 ${totalCombinaciones > 0 && totalUnidades > 0 ? 'border-indigo-300 bg-white' : 'border-slate-200 bg-slate-50'}`}>
        <CardContent className="p-3">
          {totalCombinaciones > 0 && totalUnidades > 0 ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-indigo-800">
                  Se generarán <span className="text-indigo-600">{totalCombinaciones} combinaciones</span>
                </p>
                <p className="text-xs text-slate-500">
                  Cada una con {totalUnidades} unidades totales por talla definida
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCancelar} className="text-xs">
                  <X className="w-3 h-3 mr-1" />
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={handleGenerar} className="bg-indigo-600 hover:bg-indigo-700 text-xs">
                  <Wand2 className="w-3 h-3 mr-1" />
                  Generar {totalCombinaciones} combinaciones
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-1">
              Selecciona al menos un color y define cantidades para ver el preview
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getSecciones(producto) {
  if (producto?.tipo_diseno === 'fondo_entero') {
    return [
      { key: 'fondo_entero', label: 'Fondo Entero' },
      { key: 'forro', label: 'Forro' },
      { key: 'contraste', label: 'Contraste' }
    ];
  }
  return [
    { key: 'superior', label: 'Superior' },
    { key: 'central', label: 'Central' },
    { key: 'inferior', label: 'Inferior' },
    { key: 'forro', label: 'Forro' },
    { key: 'contraste', label: 'Contraste' }
  ];
}