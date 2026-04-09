import React, { useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Copy, Check } from "lucide-react";

export default function GestorCombinacionesPredefinidas({ formData, setFormData, materiasPrimas = [], colores = [] }) {
  const combinaciones = formData.combinaciones_predefinidas || [];
  const materiales = formData.materiales_requeridos || [];

  const mpMap = useMemo(() => new Map(materiasPrimas.map(mp => [mp.id, mp])), [materiasPrimas]);
  const coloresMap = useMemo(() => new Map(colores.map(c => [c.id, c])), [colores]);
  const coloresActivos = useMemo(() => colores.filter(c => c.activo !== false), [colores]);

  // Solo materiales de color variable (no fijo)
  const materialesVariables = useMemo(() =>
    materiales.filter(m => {
      const mp = mpMap.get(m.materia_prima_id);
      return mp && !mp.color_fijo;
    }), [materiales, mpMap]);

  const newId = () => `comb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const agregarCombinacion = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      combinaciones_predefinidas: [
        ...(prev.combinaciones_predefinidas || []),
        {
          id: newId(),
          colores_por_material: materiales.map(m => ({ row_id: m.row_id, color_id: '', color_nombre: '' }))
        }
      ]
    }));
  }, [materiales, setFormData]);

  const duplicarCombinacion = useCallback((idx) => {
    setFormData(prev => {
      const arr = [...(prev.combinaciones_predefinidas || [])];
      const copia = { ...JSON.parse(JSON.stringify(arr[idx])), id: newId() };
      arr.splice(idx + 1, 0, copia);
      return { ...prev, combinaciones_predefinidas: arr };
    });
  }, [setFormData]);

  const eliminarCombinacion = useCallback((id) => {
    setFormData(prev => ({
      ...prev,
      combinaciones_predefinidas: (prev.combinaciones_predefinidas || []).filter(c => c.id !== id)
    }));
  }, [setFormData]);

  const actualizarColor = useCallback((combId, rowId, colorId) => {
    const colorObj = coloresMap.get(colorId);
    setFormData(prev => ({
      ...prev,
      combinaciones_predefinidas: (prev.combinaciones_predefinidas || []).map(comb => {
        if (comb.id !== combId) return comb;
        const existentes = comb.colores_por_material || [];
        const existe = existentes.find(cm => cm.row_id === rowId);
        const actualizados = existe
          ? existentes.map(cm => cm.row_id === rowId ? { ...cm, color_id: colorId, color_nombre: colorObj?.nombre || '' } : cm)
          : [...existentes, { row_id: rowId, color_id: colorId, color_nombre: colorObj?.nombre || '' }];
        return { ...comb, colores_por_material: actualizados };
      })
    }));
  }, [coloresMap, setFormData]);

  const getColorDeComb = (comb, rowId) => {
    const entry = (comb.colores_por_material || []).find(cm => cm.row_id === rowId);
    return entry?.color_id || '';
  };

  const getSeccionLabel = (seccion) => {
    const labels = {
      superior: 'Superior', central: 'Central', inferior: 'Inferior',
      forro: 'Forro', contraste: 'Contraste', fondo_entero: 'Fondo Entero', color_propio: 'Color Propio'
    };
    return labels[seccion] || seccion;
  };

  if (materiales.length === 0) return (
    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
      Primero agrega los materiales del producto.
    </div>
  );

  if (materialesVariables.length === 0) return (
    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
      Todos los materiales tienen color fijo. No hay variables para combinar.
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Cabecera sticky */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-2 flex items-center justify-between border-b border-slate-100">
        <p className="text-xs text-slate-500 font-medium">
          {combinaciones.length} combinación{combinaciones.length !== 1 ? 'es' : ''}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={agregarCombinacion}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs h-7">
          <Plus className="w-3 h-3 mr-1" /> Nueva combinación
        </Button>
      </div>

      {combinaciones.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
          Sin combinaciones. Crea la primera y duplícala para ir rápido.
        </div>
      ) : (
        <div className="space-y-3">
          {combinaciones.map((comb, idx) => {
            // Resumen visual de colores seleccionados
            const resumen = materialesVariables
              .map(m => getColorDeComb(comb, m.row_id))
              .filter(Boolean)
              .map(cid => coloresMap.get(cid))
              .filter(Boolean);
            const completa = materialesVariables.every(m => getColorDeComb(comb, m.row_id));

            return (
              <div key={comb.id} className={`border rounded-xl overflow-hidden transition-all ${completa ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}>
                {/* Cabecera de la combinación — siempre visible */}
                <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 w-5">#{idx + 1}</span>
                    {/* Puntos resumen de colores ya asignados */}
                    <div className="flex items-center gap-1">
                      {resumen.length > 0 ? resumen.map((c, i) => (
                        <span key={i} className="w-4 h-4 rounded-full border border-white shadow-sm shrink-0"
                          style={{ backgroundColor: c.codigo_hex }} title={c.nombre} />
                      )) : (
                        <span className="text-xs text-slate-400">Sin colores</span>
                      )}
                    </div>
                    {completa && <Check className="w-3 h-3 text-indigo-500 ml-1" />}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => duplicarCombinacion(idx)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                      title="Duplicar">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => eliminarCombinacion(comb.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                      title="Eliminar">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Secciones de color — una por material variable */}
                <div className="p-3 space-y-2.5">
                  {materialesVariables.map(mat => {
                    const mp = mpMap.get(mat.materia_prima_id);
                    const selectedId = getColorDeComb(comb, mat.row_id);
                    const selectedColor = coloresMap.get(selectedId);

                    return (
                      <div key={mat.row_id}>
                        {/* Etiqueta de sección */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium text-slate-600">{mp?.nombre || '?'}</span>
                          <span className="text-xs text-slate-400">· {getSeccionLabel(mat.seccion)}</span>
                          {selectedColor && (
                            <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                              <span className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                                style={{ backgroundColor: selectedColor.codigo_hex }} />
                              {selectedColor.nombre}
                            </span>
                          )}
                        </div>
                        {/* Paleta de puntos — UN CLICK selecciona */}
                        <div className="flex flex-wrap gap-1.5">
                          {coloresActivos.map(color => {
                            const isSelected = selectedId === color.id;
                            return (
                              <button
                                key={color.id}
                                type="button"
                                title={color.nombre}
                                onClick={() => actualizarColor(comb.id, mat.row_id, color.id)}
                                className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 focus:outline-none ${
                                  isSelected
                                    ? 'border-slate-900 scale-110 shadow-md'
                                    : 'border-transparent hover:border-slate-400'
                                }`}
                                style={{ backgroundColor: color.codigo_hex }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400">
        💡 Crea una, duplícala y cambia solo el color que varía entre combinaciones.
      </p>
    </div>
  );
}
