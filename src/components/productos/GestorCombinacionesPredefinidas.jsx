import React, { useMemo, useCallback, memo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Celda de color con paleta visual en popover
const CeldaColor = ({ entry, mat, comb, coloresById, coloresActivos, onActualizar }) => {
  const [openPopover, setOpenPopover] = useState(false);
  const colorObj = coloresById[entry?.color_id] || null;
  
  return (
    <td key={mat.row_id} className="px-0.5 py-1">
      <Popover open={openPopover} onOpenChange={setOpenPopover}>
        <PopoverTrigger asChild>
          <button
            title={colorObj?.nombre || 'sin color'}
            className="flex items-center gap-1 px-1.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 transition h-7 text-xs w-full"
          >
            {colorObj ? (
              <>
                <span className="w-3 h-3 rounded-full shrink-0 border border-slate-300"
                  style={{ backgroundColor: colorObj.codigo_hex }} />
                <span className="truncate max-w-[52px] sm:max-w-[72px] text-slate-700">{colorObj.nombre}</span>
              </>
            ) : (
              <span className="text-slate-400 text-xs">—</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="grid grid-cols-4 gap-2">
            {coloresActivos.map(color => (
              <button
                key={color.id}
                onClick={() => {
                  onActualizar(comb.id, mat.row_id, color.id);
                  setOpenPopover(false);
                }}
                className="flex flex-col items-center gap-1 p-2 rounded hover:bg-slate-100 transition group"
                title={color.nombre}
              >
                <div className="w-8 h-8 rounded-lg border-2 transition-all"
                  style={{
                    backgroundColor: color.codigo_hex,
                    borderColor: entry?.color_id === color.id ? '#1e293b' : '#e2e8f0'
                  }}
                />
                {entry?.color_id === color.id && (
                  <Check className="w-3 h-3 text-slate-700" />
                )}
                <span className="text-xs text-slate-500 text-center truncate w-full group-hover:text-slate-700">
                  {color.nombre.substring(0, 8)}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </td>
  );
};

// Fila de combinación
const FilaCombinacion = ({ comb, idx, sincronizados, materialesVariables, coloresById, onActualizar, onDuplicar, onEliminar, coloresActivos }) => {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-2 py-1.5 text-slate-400 font-medium text-xs">{idx + 1}</td>
      {materialesVariables.map(mat => {
        const entry = sincronizados.get(mat.row_id);
        return (
          <CeldaColor
            key={mat.row_id}
            entry={entry}
            mat={mat}
            comb={comb}
            coloresById={coloresById}
            coloresActivos={coloresActivos}
            onActualizar={onActualizar}
          />
        );
      })}
      <td className="px-0.5 py-1">
        <div className="flex gap-0">
          <Button type="button" variant="ghost" size="icon"
            onClick={() => onDuplicar(idx)}
            className="h-6 w-6 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
            title="Duplicar">
            <Copy className="w-3 h-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon"
            onClick={() => onEliminar(comb.id)}
            className="h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-red-50"
            title="Eliminar">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

export default function GestorCombinacionesPredefinidas({ formData, setFormData, materiasPrimas = [], colores = [] }) {
  const combinaciones = formData.combinaciones_predefinidas || [];
  const materiales = formData.materiales_requeridos || [];

  // Maps para lookups O(1) en vez de .find() O(n)
  const mpMap = useMemo(() => new Map(materiasPrimas.map(mp => [mp.id, mp])), [materiasPrimas]);
  const coloresMap = useMemo(() => new Map(colores.map(c => [c.id, c])), [colores]);
  const coloresActivos = useMemo(() => colores.filter(c => c.activo), [colores]);
  
  // Crear objeto estable de colores por ID para evitar loops de actualización
  const coloresById = useMemo(() => {
    const map = {};
    colores.forEach(c => { map[c.id] = c; });
    return map;
  }, [colores]);

  // Materiales variables (no fijo)
  const materialesVariables = useMemo(() =>
    materiales.filter(m => {
      const mp = mpMap.get(m.materia_prima_id);
      return mp && !mp.color_fijo;
    }), [materiales, mpMap]);

  const newId = () => `comb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  // Sincronizar colores inline para evitar dependencias circulares
  const sincronizarColores = (comb) => {
    const existentes = comb.colores_por_material || [];
    const dedup = existentes.filter((cm, idx, arr) => arr.findIndex(x => x.row_id === cm.row_id) === idx);
    const existentesSet = new Set(dedup.map(d => d.row_id));
    const faltantes = materiales.filter(m => !existentesSet.has(m.row_id));
    return [...dedup, ...faltantes.map(m => ({ row_id: m.row_id, color_id: '', color_nombre: '' }))];
  };

  // Pre-calcular todas las combinaciones resueltas
  const combinacionesResueltas = useMemo(() => {
    return combinaciones.map(comb => {
      const sincronizados = sincronizarColores(comb);
      return new Map(sincronizados.map(cm => [cm.row_id, cm]));
    });
  }, [combinaciones, materiales]);

  const agregarCombinacion = useCallback(() => {
    const nueva = {
      id: newId(),
      colores_por_material: materiales.map(m => ({ row_id: m.row_id, color_id: '', color_nombre: '' }))
    };
    setFormData(prev => ({
      ...prev,
      combinaciones_predefinidas: [...(prev.combinaciones_predefinidas || []), nueva]
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
        const coloresActualizados = (comb.colores_por_material || []).map(cm =>
          cm.row_id === rowId ? { ...cm, color_id: colorId, color_nombre: colorObj?.nombre || '' } : cm
        );
        return { ...comb, colores_por_material: coloresActualizados };
      })
    }));
  }, [coloresMap, setFormData]);

  if (materiales.length === 0) {
    return (
      <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
        Primero agrega los materiales del producto para poder crear combinaciones.
      </div>
    );
  }

  if (materialesVariables.length === 0) {
    return (
      <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
        Todos los materiales tienen color fijo. No se pueden crear combinaciones variables.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {combinaciones.length} combinación{combinaciones.length !== 1 ? 'es' : ''}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={agregarCombinacion}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs">
          <Plus className="w-3 h-3 mr-1" /> Nueva
        </Button>
      </div>

      {combinaciones.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
          Sin combinaciones. Crea la primera y luego duplícala para ir rápido.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="px-2 py-2 text-left font-semibold text-slate-500 w-8">#</th>
                {materialesVariables.map(mat => {
                  const mp = mpMap.get(mat.materia_prima_id);
                  return (
                    <th key={mat.row_id} className="px-1 py-2 text-left font-semibold text-slate-600 min-w-[80px] sm:min-w-[110px]">
                      <div className="truncate">{mp?.nombre || '—'}</div>
                      <div className="text-slate-400 font-normal capitalize">{mat.seccion}</div>
                    </th>
                  );
                })}
                <th className="px-1 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {combinaciones.map((comb, idx) => (
               <FilaCombinacion
                 key={comb.id}
                 comb={comb}
                 idx={idx}
                 sincronizados={combinacionesResueltas[idx]}
                 materialesVariables={materialesVariables}
                 coloresById={coloresById}
                 coloresActivos={coloresActivos}
                 onActualizar={actualizarColor}
                 onDuplicar={duplicarCombinacion}
                 onEliminar={eliminarCombinacion}
               />
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        💡 Crea una combinación, duplícala y cambia solo el color que varía.
      </p>
    </div>
  );
}