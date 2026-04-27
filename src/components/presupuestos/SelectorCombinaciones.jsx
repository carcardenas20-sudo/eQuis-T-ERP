import React, { useMemo } from 'react';
import { Input } from "@/components/ui/input";

export default function SelectorCombinaciones({
  item, producto, materiasPrimas, colores,
  onChange
}) {
  const combinacionesPredefinidas = producto?.combinaciones_predefinidas || [];
  const tallas = producto?.tallas?.length > 0 ? producto.tallas : ['S', 'M', 'L', 'XL'];
  const combinacionesActuales = item.combinaciones || [];

  const mpMap = useMemo(() => new Map((materiasPrimas || []).map(mp => [mp.id, mp])), [materiasPrimas]);
  const coloresMap = useMemo(() => new Map((colores || []).map(c => [c.id, c])), [colores]);

  const seleccionadas = useMemo(() => new Set(
    combinacionesActuales.filter(c => c.predefinida_id).map(c => c.predefinida_id)
  ), [combinacionesActuales]);

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

  const renderColores = (predef) => {
    const activos = (predef.colores_por_material || []).filter(cm => {
      const mat = producto?.materiales_requeridos?.find(m => m.row_id === cm.row_id);
      const mp = mpMap.get(mat?.materia_prima_id);
      if (!cm.color_id || mp?.color_fijo) return false;
      if (mat?.seccion === 'color_propio' && !mat?.color_independiente) return false;
      return true;
    });
    if (activos.length === 0) return <span className="text-xs text-slate-400 italic">Sin colores definidos</span>;
    const secLabels = { superior: 'S', central: 'C', inferior: 'I', forro: 'F', contraste: 'K', fondo_entero: 'FE' };
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {activos.map(cm => {
          const c = coloresMap.get(cm.color_id);
          const mat = producto?.materiales_requeridos?.find(m => m.row_id === cm.row_id);
          const sec = secLabels[mat?.seccion] || mat?.seccion || '';
          if (!c) return null;
          return (
            <div key={cm.row_id} className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: c.codigo_hex }} />
              <span className="text-xs text-slate-500">{c.nombre}{sec ? ` (${sec})` : ''}</span>
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

  return (
    <div className="space-y-1.5">
      {combinacionesPredefinidas.map((predef, idx) => {
        const isSelected = seleccionadas.has(predef.id);
        const combActual = combinacionesActuales.find(c => c.predefinida_id === predef.id);
        const totalComb = isSelected
          ? (combActual?.tallas_cantidades || []).reduce((s, tc) => s + (tc.cantidad || 0), 0)
          : 0;

        return (
          <div key={predef.id}
            className={`border rounded-lg transition-all ${isSelected ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white'}`}>

            {/* Fila principal: checkbox + colores */}
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
              {isSelected && totalComb > 0 && (
                <span className="text-xs font-semibold text-indigo-600 shrink-0">{totalComb} uds</span>
              )}
            </div>

            {/* Tallas: siempre visibles cuando está seleccionada */}
            {isSelected && combActual && (
              <div className="px-3 pb-2 border-t border-indigo-100">
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(combActual.tallas_cantidades || []).map(tc => (
                    <div key={tc.talla} className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                      <span className="text-xs font-semibold text-slate-500 w-5 text-center">{tc.talla}</span>
                      <Input
                        type="number"
                        value={tc.cantidad || ''}
                        placeholder="0"
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
  );
}
