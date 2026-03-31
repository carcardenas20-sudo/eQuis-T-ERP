import React, { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Palette } from "lucide-react";

/**
 * Muestra las combinaciones predefinidas de un producto para seleccionar en el presupuesto.
 * Permite marcar cuáles se incluyen y definir cantidades por talla.
 * También permite agregar combinaciones ad-hoc si el producto no tiene predefinidas.
 */
export default function SelectorCombinaciones({ item, producto, materiasPrimas, colores, onChange }) {
  const combinacionesPredefinidas = producto?.combinaciones_predefinidas || [];
  const tallas = producto?.tallas || ['S', 'M', 'L', 'XL'];
  const combinacionesActuales = item.combinaciones || [];

  // IDs de combinaciones predefinidas que están seleccionadas (memoizado para evitar loops)
  const seleccionadas = useMemo(() => new Set(
    combinacionesActuales
      .filter(c => c.predefinida_id)
      .map(c => c.predefinida_id)
  ), [combinacionesActuales]);

  const toggleCombinacion = (predef) => {
    if (seleccionadas.has(predef.id)) {
      // Quitar
      onChange(combinacionesActuales.filter(c => c.predefinida_id !== predef.id));
    } else {
      // Agregar con tallas vacías
      const nueva = {
        id: `${Date.now()}_${Math.random()}`,
        predefinida_id: predef.id,
        colores_por_material: predef.colores_por_material,
        tallas_cantidades: tallas.map(t => ({ talla: t, cantidad: 0 }))
      };
      onChange([...combinacionesActuales, nueva]);
    }
  };

  const actualizarCantidad = (combId, talla, cantidad) => {
    onChange(combinacionesActuales.map(c => {
      if (c.id !== combId) return c;
      return {
        ...c,
        tallas_cantidades: c.tallas_cantidades.map(tc =>
          tc.talla === talla ? { ...tc, cantidad: parseInt(cantidad) || 0 } : tc
        )
      };
    }));
  };

  const getMaterialNombre = (rowId) => {
    const mat = producto?.materiales_requeridos?.find(m => m.row_id === rowId);
    const mp = materiasPrimas.find(mp => mp.id === mat?.materia_prima_id);
    return mp?.nombre || '?';
  };

  const getSeccionLabel = (rowId) => {
    const secciones = {
      superior: 'Sup', central: 'Cen', inferior: 'Inf',
      forro: 'Forro', contraste: 'Contr', fondo_entero: 'Fondo', color_propio: 'Propio'
    };
    const mat = producto?.materiales_requeridos?.find(m => m.row_id === rowId);
    return secciones[mat?.seccion] || mat?.seccion || '';
  };

  const renderPreviewCombinacion = (predef) => {
    const activos = (predef.colores_por_material || []).filter(cm => {
      const mat = producto?.materiales_requeridos?.find(m => m.row_id === cm.row_id);
      const mp = materiasPrimas.find(mp => mp.id === mat?.materia_prima_id);
      return !mp?.color_fijo && cm.color_id;
    });
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {activos.map(cm => {
          const c = colores.find(x => x.id === cm.color_id);
          if (!c) return null;
          return (
            <div key={cm.row_id} className="flex items-center gap-1 text-xs text-slate-600">
              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: c.codigo_hex }} />
              <span className="text-slate-400 text-xs">{getSeccionLabel(cm.row_id)}</span>
              <span>{c.nombre}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (combinacionesPredefinidas.length === 0) {
    return (
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
        Este producto no tiene combinaciones predefinidas. Ve a <strong>Productos</strong> y configúralas para agilizar el presupuesto.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Lista de combinaciones predefinidas para seleccionar */}
      <div className="space-y-2">
        {combinacionesPredefinidas.map((predef, idx) => {
          const isSelected = seleccionadas.has(predef.id);
          const combActual = combinacionesActuales.find(c => c.predefinida_id === predef.id);
          const totalUnidades = isSelected
            ? (combActual?.tallas_cantidades || []).reduce((s, tc) => s + (tc.cantidad || 0), 0)
            : 0;

          return (
            <div key={predef.id}
              className={`border rounded-lg transition-all ${isSelected ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}>
              {/* Header: checkbox + preview de colores */}
              <div className="flex items-center gap-3 p-2.5 cursor-pointer" onClick={() => toggleCombinacion(predef)}>
                <input type="checkbox" checked={isSelected} onChange={() => {}} onClick={(e) => e.stopPropagation()} className="cursor-pointer" />
                <Palette className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-600 mb-0.5">Combinación {idx + 1}</div>
                  {renderPreviewCombinacion(predef)}
                </div>
                {isSelected && totalUnidades > 0 && (
                  <Badge className="bg-indigo-100 text-indigo-700 text-xs shrink-0">{totalUnidades} uds</Badge>
                )}
              </div>

              {/* Cantidades por talla (solo si está seleccionada) */}
              {isSelected && combActual && (
                <div className="px-3 pb-3 pt-1 border-t border-indigo-100">
                  <div className="flex flex-wrap gap-2">
                    {(combActual.tallas_cantidades || []).map(tc => (
                      <div key={tc.talla} className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-xs font-medium text-slate-600 w-6 text-center">{tc.talla}</span>
                        <Input
                          type="number"
                          value={tc.cantidad}
                          onChange={(e) => actualizarCantidad(combActual.id, tc.talla, e.target.value)}
                          className="w-14 h-6 text-xs text-center border-0 bg-transparent p-0"
                          min="0"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}