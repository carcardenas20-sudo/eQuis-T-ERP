import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Copy, ChevronDown } from "lucide-react";

// Paleta flotante que se renderiza fuera del contenedor con overflow
function FloatingPalette({ anchorRef, children, onClose }) {
  const [pos, setPos] = useState(null);
  const paletteRef = useRef(null);

  useEffect(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const paletteW = 220;
    let left = rect.left + rect.width / 2 - paletteW / 2;
    // Evitar que se salga por la derecha
    if (left + paletteW > window.innerWidth - 8) left = window.innerWidth - paletteW - 8;
    if (left < 8) left = 8;
    // Si queda cortada abajo, ponerla arriba
    const spaceBelow = window.innerHeight - rect.bottom;
    let top = rect.bottom + 4;
    if (spaceBelow < 200) top = rect.top - 200;
    setPos({ top, left });
  }, [anchorRef]);

  if (!pos) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        ref={paletteRef}
        className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl p-3"
        style={{ top: pos.top, left: pos.left, width: 220, maxHeight: 200, overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

export default function GestorCombinacionesPredefinidas({ formData, setFormData, materiasPrimas = [], colores = [] }) {
  const combinaciones = formData.combinaciones_predefinidas || [];
  const materiales = formData.materiales_requeridos || [];

  // openCell: { combId, rowId, ref } | null
  // fillOpen: { rowId, ref } | null
  const [openCell, setOpenCell] = useState(null);
  const [fillOpen, setFillOpen] = useState(null);

  const mpMap = useMemo(() => new Map(materiasPrimas.map(mp => [mp.id, mp])), [materiasPrimas]);
  const coloresMap = useMemo(() => new Map(colores.map(c => [c.id, c])), [colores]);
  const coloresActivos = useMemo(() => colores.filter(c => c.activo !== false), [colores]);

  const materialesVariables = useMemo(() =>
    materiales.filter(m => {
      const mp = mpMap.get(m.materia_prima_id);
      return mp && !mp.color_fijo;
    }), [materiales, mpMap]);

  const newId = () => `comb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const closeAll = () => { setOpenCell(null); setFillOpen(null); };

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
    setOpenCell(null);
  }, [coloresMap, setFormData]);

  const aplicarATodas = useCallback((rowId, colorId) => {
    const colorObj = coloresMap.get(colorId);
    setFormData(prev => ({
      ...prev,
      combinaciones_predefinidas: (prev.combinaciones_predefinidas || []).map(comb => {
        const existentes = comb.colores_por_material || [];
        const existe = existentes.find(cm => cm.row_id === rowId);
        const actualizados = existe
          ? existentes.map(cm => cm.row_id === rowId ? { ...cm, color_id: colorId, color_nombre: colorObj?.nombre || '' } : cm)
          : [...existentes, { row_id: rowId, color_id: colorId, color_nombre: colorObj?.nombre || '' }];
        return { ...comb, colores_por_material: actualizados };
      })
    }));
    setFillOpen(null);
  }, [coloresMap, setFormData]);

  const getColorDeComb = (comb, rowId) => {
    const entry = (comb.colores_por_material || []).find(cm => cm.row_id === rowId);
    return entry?.color_id || '';
  };

  const getTextColor = (hex) => {
    if (!hex || hex.length < 7) return '#ffffff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#333333' : '#ffffff';
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
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">
          {combinaciones.length} combinación{combinaciones.length !== 1 ? 'es' : ''}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={agregarCombinacion}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs h-7">
          <Plus className="w-3 h-3 mr-1" /> Nueva
        </Button>
      </div>

      {combinaciones.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
          Sin combinaciones. Crea la primera.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg">
          <div className="overflow-x-auto overflow-y-auto max-h-[460px]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 w-8">
                    <span className="text-xs font-semibold text-slate-400">#</span>
                  </th>
                  {materialesVariables.map(mat => {
                    const mp = mpMap.get(mat.materia_prima_id);
                    return (
                      <HeaderCell
                        key={mat.row_id}
                        mat={mat}
                        mp={mp}
                        fillOpen={fillOpen}
                        setFillOpen={setFillOpen}
                        setOpenCell={setOpenCell}
                        coloresActivos={coloresActivos}
                        aplicarATodas={aplicarATodas}
                        getSeccionLabel={getSeccionLabel}
                        closeAll={closeAll}
                      />
                    );
                  })}
                  <th className="w-14 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {combinaciones.map((comb, idx) => {
                  const completa = materialesVariables.every(m => getColorDeComb(comb, m.row_id));
                  return (
                    <tr
                      key={comb.id}
                      className={`border-b border-slate-100 last:border-0 ${completa ? 'bg-indigo-50/30' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <td className="px-3 py-2 text-xs font-bold text-slate-400">{idx + 1}</td>

                      {materialesVariables.map(mat => (
                        <ColorCell
                          key={mat.row_id}
                          comb={comb}
                          mat={mat}
                          openCell={openCell}
                          setOpenCell={setOpenCell}
                          setFillOpen={setFillOpen}
                          coloresMap={coloresMap}
                          coloresActivos={coloresActivos}
                          getColorDeComb={getColorDeComb}
                          getTextColor={getTextColor}
                          actualizarColor={actualizarColor}
                          closeAll={closeAll}
                        />
                      ))}

                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => duplicarCombinacion(idx)}
                            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="Duplicar fila"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarCombinacion(comb.id)}
                            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Usa "Todas" en la cabecera para rellenar una columna de un clic, luego duplica y ajusta el color que varía.
      </p>
    </div>
  );
}

// Celda de cabecera con "Aplicar a todas"
function HeaderCell({ mat, mp, fillOpen, setFillOpen, setOpenCell, coloresActivos, aplicarATodas, getSeccionLabel, closeAll }) {
  const btnRef = useRef(null);
  const isOpenFill = fillOpen?.rowId === mat.row_id;

  return (
    <th className="px-2 py-2 text-center">
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs font-semibold text-slate-600">{mp?.nombre || '?'}</span>
        <span className="text-xs text-slate-400">{getSeccionLabel(mat.seccion)}</span>
        <div className="mt-1">
          <button
            ref={btnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFillOpen(isOpenFill ? null : { rowId: mat.row_id, ref: btnRef });
              setOpenCell(null);
            }}
            className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition"
          >
            Todas <ChevronDown className="w-3 h-3" />
          </button>
          {isOpenFill && (
            <FloatingPalette anchorRef={btnRef} onClose={closeAll}>
              <p className="text-xs text-slate-500 mb-2 font-medium">Aplicar a todas las filas:</p>
              <div className="flex flex-wrap gap-1.5">
                {coloresActivos.map(color => (
                  <button
                    key={color.id}
                    type="button"
                    title={color.nombre}
                    onClick={() => aplicarATodas(mat.row_id, color.id)}
                    className="w-6 h-6 rounded-full border-2 border-transparent hover:border-slate-500 hover:scale-110 transition-all"
                    style={{ backgroundColor: color.codigo_hex }}
                  />
                ))}
              </div>
            </FloatingPalette>
          )}
        </div>
      </div>
    </th>
  );
}

// Celda de color individual
function ColorCell({ comb, mat, openCell, setOpenCell, setFillOpen, coloresMap, coloresActivos, getColorDeComb, getTextColor, actualizarColor, closeAll }) {
  const btnRef = useRef(null);
  const selectedId = getColorDeComb(comb, mat.row_id);
  const selectedColor = coloresMap.get(selectedId);
  const isOpenPalette = openCell?.combId === comb.id && openCell?.rowId === mat.row_id;

  return (
    <td className="px-2 py-2 text-center">
      <div className="inline-block">
        <button
          ref={btnRef}
          type="button"
          title={selectedColor?.nombre || 'Seleccionar color'}
          onClick={(e) => {
            e.stopPropagation();
            setOpenCell(isOpenPalette ? null : { combId: comb.id, rowId: mat.row_id, ref: btnRef });
            setFillOpen(null);
          }}
          className={`w-11 h-11 rounded-full border-2 mx-auto flex items-center justify-center overflow-hidden transition-all hover:scale-105 ${
            selectedColor
              ? 'border-slate-300 shadow-sm'
              : 'border-dashed border-slate-300 bg-slate-100'
          }`}
          style={selectedColor ? { backgroundColor: selectedColor.codigo_hex } : {}}
        >
          {selectedColor && (
            <span
              className="text-center leading-tight px-0.5 break-words pointer-events-none select-none"
              style={{
                fontSize: '6.5px',
                color: getTextColor(selectedColor.codigo_hex),
                lineHeight: '1.15',
                maxWidth: '90%',
                wordBreak: 'break-word',
              }}
            >
              {selectedColor.nombre}
            </span>
          )}
        </button>
        {isOpenPalette && (
          <FloatingPalette anchorRef={btnRef} onClose={closeAll}>
            <div className="flex flex-wrap gap-1.5">
              {coloresActivos.map(color => {
                const isSel = selectedId === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    title={color.nombre}
                    onClick={() => actualizarColor(comb.id, mat.row_id, color.id)}
                    className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                      isSel ? 'border-slate-900 scale-110 shadow-md' : 'border-transparent hover:border-slate-400'
                    }`}
                    style={{ backgroundColor: color.codigo_hex }}
                  />
                );
              })}
            </div>
          </FloatingPalette>
        )}
      </div>
    </td>
  );
}
