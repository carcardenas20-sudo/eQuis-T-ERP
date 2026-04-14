import React, { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shuffle, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Selector de combinaciones + objetivo por talla en un solo lugar.
 * Flujo:
 *   1. Marcar qué combinaciones van (checkbox)
 *   2. Ingresar objetivo total por talla → "Distribuir equitativamente"
 *   3. Ajustar manualmente si alguna combinación tiene distribución distinta
 */
export default function SelectorCombinaciones({
  item, producto, materiasPrimas, colores,
  objetivoPorTalla = {}, onUpdateObjetivo,
  onChange
}) {
  const combinacionesPredefinidas = producto?.combinaciones_predefinidas || [];
  const tallas = producto?.tallas || ['S', 'M', 'L', 'XL'];
  const combinacionesActuales = item.combinaciones || [];

  // Cuáles combinaciones están expandidas para editar tallas manualmente
  const [expanded, setExpanded] = useState(new Set());

  const mpMap = useMemo(() => new Map((materiasPrimas || []).map(mp => [mp.id, mp])), [materiasPrimas]);
  const coloresMap = useMemo(() => new Map((colores || []).map(c => [c.id, c])), [colores]);

  const seleccionadas = useMemo(() => new Set(
    combinacionesActuales.filter(c => c.predefinida_id).map(c => c.predefinida_id)
  ), [combinacionesActuales]);

  // Unidades asignadas por talla sumando todas las combinaciones seleccionadas
  const asignadoPorTalla = useMemo(() => {
    const acc = {};
    combinacionesActuales.filter(c => c.predefinida_id).forEach(comb => {
      (comb.tallas_cantidades || []).forEach(tc => {
        acc[tc.talla] = (acc[tc.talla] || 0) + (tc.cantidad || 0);
      });
    });
    return acc;
  }, [combinacionesActuales]);

  const totalObjetivo = Object.values(objetivoPorTalla).reduce((s, v) => s + (v || 0), 0);
  const totalAsignado = Object.values(asignadoPorTalla).reduce((s, v) => s + v, 0);

  // Toggle selección de una combinación
  const toggleCombinacion = (predef) => {
    if (seleccionadas.has(predef.id)) {
      onChange(combinacionesActuales.filter(c => c.predefinida_id !== predef.id));
    } else {
      const nueva = {
        id: `${Date.now()}_${Math.random()}`,
        predefinida_id: predef.id,
        colores_por_material: predef.colores_por_material,
        tallas_cantidades: tallas.map(t => ({ talla: t, cantidad: 0 }))
      };
      onChange([...combinacionesActuales, nueva]);
    }
  };

  // Distribuir equitativamente el objetivo entre las combinaciones seleccionadas
  const distribuirEquitativamente = () => {
    const sel = combinacionesActuales.filter(c => c.predefinida_id);
    if (sel.length === 0) return;
    const distribuidas = sel.map((comb, idx) => ({
      ...comb,
      tallas_cantidades: tallas.map(talla => {
        const obj = objetivoPorTalla[talla] || 0;
        const base = Math.floor(obj / sel.length);
        const resto = obj % sel.length;
        return { talla, cantidad: base + (idx < resto ? 1 : 0) };
      })
    }));
    onChange(distribuidas);
  };

  // Actualizar cantidad de una talla en una combinación específica
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

  // Preview visual de colores variables de una combinación
  const renderColores = (predef) => {
    const activos = (predef.colores_por_material || []).filter(cm => {
      const mat = producto?.materiales_requeridos?.find(m => m.row_id === cm.row_id);
      const mp = mpMap.get(mat?.materia_prima_id);
      return !mp?.color_fijo && cm.color_id;
    });
    if (activos.length === 0) return <span className="text-xs text-slate-400 italic">Sin colores definidos</span>;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {activos.map(cm => {
          const c = coloresMap.get(cm.color_id);
          const mat = producto?.materiales_requeridos?.find(m => m.row_id === cm.row_id);
          const secLabels = { superior: 'S', central: 'C', inferior: 'I', forro: 'F', contraste: 'K', fondo_entero: 'FE' };
          const sec = secLabels[mat?.seccion] || mat?.seccion || '';
          if (!c) return null;
          return (
            <div key={cm.row_id} className="flex items-center gap-0.5">
              <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: c.codigo_hex }} title={c.nombre} />
              {sec && <span className="text-slate-400 text-xs">{sec}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  if (combinacionesPredefinidas.length === 0) {
    return (
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
        Este producto no tiene combinaciones predefinidas. Ve a <strong>Productos</strong> y configúralas.
      </div>
    );
  }

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">

      {/* PASO 1 + 2: Objetivo por talla + botón distribuir */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-600">Objetivo total por talla</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={distribuirEquitativamente}
            disabled={seleccionadas.size === 0 || totalObjetivo === 0}
            className="text-xs h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1"
            title="Repartir el objetivo equitativamente entre las combinaciones seleccionadas"
          >
            <Shuffle className="w-3 h-3" />
            Distribuir ({seleccionadas.size} comb.)
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tallas.map(talla => {
            const obj = objetivoPorTalla[talla] || 0;
            const asig = asignadoPorTalla[talla] || 0;
            const diff = asig - obj;
            const statusColor = obj === 0
              ? 'border-slate-200 bg-white text-slate-500'
              : diff === 0 && asig > 0 ? 'border-green-300 bg-green-50 text-green-700'
              : diff > 0 ? 'border-red-300 bg-red-50 text-red-700'
              : asig > 0 ? 'border-orange-300 bg-orange-50 text-orange-700'
              : 'border-slate-200 bg-white text-slate-500';
            return (
              <div key={talla} className={`flex items-center gap-1 border rounded-lg px-2 py-1 ${statusColor}`}>
                <span className="text-xs font-bold w-5 text-center">{talla}</span>
                <Input
                  type="number" min="0"
                  value={obj || ''}
                  placeholder="0"
                  onChange={(e) => onUpdateObjetivo(talla, e.target.value)}
                  className="w-12 h-5 text-xs text-center border-0 bg-transparent p-0 font-medium"
                />
                {obj > 0 && (
                  <span className="text-xs opacity-60">
                    {diff === 0 && asig > 0 ? '✓' : `${asig}/${obj}`}
                  </span>
                )}
              </div>
            );
          })}
          {totalObjetivo > 0 && (
            <div className={`flex items-center px-2 py-1 rounded-lg text-xs font-medium border ${
              totalAsignado === totalObjetivo && totalAsignado > 0
                ? 'bg-green-100 text-green-700 border-green-200'
                : totalAsignado > totalObjetivo
                ? 'bg-red-100 text-red-700 border-red-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {totalAsignado === totalObjetivo && totalAsignado > 0
                ? `✓ ${totalObjetivo} uds`
                : `${totalAsignado}/${totalObjetivo} uds`}
            </div>
          )}
        </div>
      </div>

      {/* PASO 3: Lista de combinaciones */}
      <div className="space-y-1.5">
        {combinacionesPredefinidas.map((predef, idx) => {
          const isSelected = seleccionadas.has(predef.id);
          const combActual = combinacionesActuales.find(c => c.predefinida_id === predef.id);
          const totalComb = isSelected
            ? (combActual?.tallas_cantidades || []).reduce((s, tc) => s + (tc.cantidad || 0), 0)
            : 0;
          const isExpanded = expanded.has(predef.id);

          return (
            <div key={predef.id}
              className={`border rounded-lg transition-all ${isSelected ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white'}`}>

              {/* Fila principal */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                onClick={() => toggleCombinacion(predef)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  onClick={e => e.stopPropagation()}
                  className="cursor-pointer shrink-0"
                />
                <span className="text-xs font-bold text-slate-400 w-5 shrink-0">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  {renderColores(predef)}
                </div>

                {/* Resumen de tallas asignadas */}
                {isSelected && combActual && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-slate-500 font-medium">{totalComb} uds</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); toggleExpand(predef.id); }}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 transition"
                      title={isExpanded ? 'Colapsar' : 'Ajustar cantidades'}
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Tallas expandidas para ajuste manual */}
              {isSelected && combActual && isExpanded && (
                <div className="px-3 pb-2 pt-0 border-t border-indigo-100">
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(combActual.tallas_cantidades || []).map(tc => (
                      <div key={tc.talla} className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-xs font-semibold text-slate-500 w-5 text-center">{tc.talla}</span>
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
