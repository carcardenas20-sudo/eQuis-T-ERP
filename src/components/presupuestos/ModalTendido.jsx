import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { X, Plus, Trash2, ChevronRight, Layers } from "lucide-react";

export default function ModalTendido({ productos, colores, materiasPrimas, onGenerate, onCancel }) {
  const [paso, setPaso] = useState(1);
  const [filas, setFilas] = useState([{ id: `f_${Date.now()}`, producto_id: '', talla: '', cant_hoja: 1 }]);
  const [coloresTendido, setColoresTendido] = useState([{ id: `c_${Date.now()}`, nombre: '', hojas: 10 }]);
  const [mapeos, setMapeos] = useState({});

  const coloresMap = useMemo(() => new Map((colores || []).map(c => [c.id, c])), [colores]);
  const mpMap = useMemo(() => new Map((materiasPrimas || []).map(mp => [mp.id, mp])), [materiasPrimas]);

  const filasValidas = filas.filter(f => f.producto_id && f.talla);
  const coloresValidos = coloresTendido.filter(c => c.nombre && c.hojas > 0);

  // Unique (producto, color) pairs that need combination mapping
  const pairsToMap = useMemo(() => {
    const pairs = [];
    const seen = new Set();
    for (const fila of filasValidas) {
      const producto = productos.find(p => p.id === fila.producto_id);
      if (!producto?.combinaciones_predefinidas?.length) continue;
      for (const color of coloresValidos) {
        const key = `${fila.producto_id}__${color.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ key, producto_id: fila.producto_id, producto, color });
        }
      }
    }
    return pairs;
  }, [filas, coloresTendido, productos]);

  const canGoNext = filasValidas.length > 0 && coloresValidos.length > 0;
  const allMapped = pairsToMap.every(pair => mapeos[pair.key]);

  const addFila = () => setFilas(prev => [...prev, { id: `f_${Date.now()}`, producto_id: '', talla: '', cant_hoja: 1 }]);
  const removeFila = (id) => setFilas(prev => prev.filter(f => f.id !== id));
  const updateFila = (id, field, value) => setFilas(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));

  const addColor = () => setColoresTendido(prev => [...prev, { id: `c_${Date.now()}`, nombre: '', hojas: 10 }]);
  const removeColor = (id) => setColoresTendido(prev => prev.filter(c => c.id !== id));
  const updateColor = (id, field, value) => setColoresTendido(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  const renderCombColors = (producto, predef) => {
    const secLabels = { superior: 'S', central: 'C', inferior: 'I', forro: 'F', contraste: 'K', fondo_entero: 'FE' };
    const activos = (predef.colores_por_material || []).filter(cm => {
      if (!cm.color_id) return false;
      const mat = producto?.materiales_requeridos?.find(m => m.row_id === cm.row_id);
      const mp = mpMap.get(mat?.materia_prima_id);
      if (mp?.color_fijo && !mat?.color_independiente) return false;
      if (mat?.seccion === 'color_propio' && !mat?.color_independiente) return false;
      return true;
    });
    if (activos.length === 0) return <span className="text-xs text-slate-400 italic">Sin colores definidos</span>;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {activos.map(cm => {
          const c = coloresMap.get(cm.color_id);
          const mat = producto?.materiales_requeridos?.find(m => m.row_id === cm.row_id);
          const sec = secLabels[mat?.seccion] || '';
          if (!c) return null;
          return (
            <div key={cm.row_id} className="flex items-center gap-1">
              <div className="w-3.5 h-3.5 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: c.codigo_hex }} />
              <span className="text-xs text-slate-600">{c.nombre}{sec ? ` (${sec})` : ''}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Preview: total units per (producto, talla) across all colors
  const preview = useMemo(() => {
    const result = {};
    for (const fila of filasValidas) {
      const producto = productos.find(p => p.id === fila.producto_id);
      if (!result[fila.producto_id]) result[fila.producto_id] = { nombre: producto?.nombre || '?', tallas: {} };
      const totalUnidades = coloresValidos.reduce((s, c) => s + (fila.cant_hoja || 1) * c.hojas, 0);
      result[fila.producto_id].tallas[fila.talla] = (result[fila.producto_id].tallas[fila.talla] || 0) + totalUnidades;
    }
    return Object.values(result);
  }, [filas, coloresTendido, productos]);

  const handleGenerate = () => {
    const productoGroups = {};

    for (const fila of filasValidas) {
      if (!productoGroups[fila.producto_id]) {
        productoGroups[fila.producto_id] = {
          producto_id: fila.producto_id,
          unidades_por_asignacion: 20,
          combinaciones: [],
          objetivo_por_talla: {},
        };
      }

      for (const colorTend of coloresValidos) {
        const mapKey = `${fila.producto_id}__${colorTend.id}`;
        const predefinidaId = mapeos[mapKey];
        if (!predefinidaId) continue;

        const producto = productos.find(p => p.id === fila.producto_id);
        const predef = producto?.combinaciones_predefinidas?.find(c => c.id === predefinidaId);
        if (!predef) continue;

        const cantidad = (fila.cant_hoja || 1) * colorTend.hojas;

        let comb = productoGroups[fila.producto_id].combinaciones.find(c => c.predefinida_id === predefinidaId);
        if (!comb) {
          comb = {
            id: `tend_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            predefinida_id: predefinidaId,
            colores_por_material: predef.colores_por_material || [],
            tallas_cantidades: [],
          };
          productoGroups[fila.producto_id].combinaciones.push(comb);
        }

        const existingTalla = comb.tallas_cantidades.find(tc => tc.talla === fila.talla);
        if (existingTalla) {
          existingTalla.cantidad += cantidad;
        } else {
          comb.tallas_cantidades.push({ talla: fila.talla, cantidad });
        }

        productoGroups[fila.producto_id].objetivo_por_talla[fila.talla] =
          (productoGroups[fila.producto_id].objetivo_por_talla[fila.talla] || 0) + cantidad;
      }
    }

    onGenerate(Object.values(productoGroups));
  };

  const handleNext = () => {
    if (pairsToMap.length > 0) {
      setPaso(2);
    } else {
      handleGenerate();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Asistente de Tendido
            </h2>
            <p className="text-sm text-slate-500">
              {paso === 1
                ? 'Define las referencias y los colores del tendido'
                : 'Asocia cada color con la combinación del producto'}
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {paso === 1 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ── Referencias ── */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Referencias y Tallas</h3>
                <div className="space-y-2">
                  {filas.map((fila, idx) => {
                    const prod = productos.find(p => p.id === fila.producto_id);
                    return (
                      <div key={fila.id} className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 w-4 shrink-0">{idx + 1}</span>
                        <select
                          className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={fila.producto_id}
                          onChange={e => { updateFila(fila.id, 'producto_id', e.target.value); updateFila(fila.id, 'talla', ''); }}
                        >
                          <option value="">Referencia...</option>
                          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                        <select
                          className="w-14 text-sm border border-slate-200 rounded-lg px-1 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={fila.talla}
                          onChange={e => updateFila(fila.id, 'talla', e.target.value)}
                          disabled={!fila.producto_id}
                        >
                          <option value="">T.</option>
                          {(prod?.tallas || []).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input
                          type="number" min="1"
                          title="Unidades por hoja"
                          className="w-12 text-sm border border-slate-200 rounded-lg px-1 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={fila.cant_hoja}
                          onChange={e => updateFila(fila.id, 'cant_hoja', Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <button onClick={() => removeFila(fila.id)} disabled={filas.length === 1}
                          className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <button onClick={addFila} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-1">
                    <Plus className="w-3.5 h-3.5" /> Agregar fila
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">Último campo: unidades de esa referencia+talla por hoja</p>
              </div>

              {/* ── Colores ── */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Colores del Tendido</h3>
                <div className="space-y-2">
                  {coloresTendido.map((ct, idx) => (
                    <div key={ct.id} className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 w-4 shrink-0">{idx + 1}</span>
                      <input
                        className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Nombre del color..."
                        value={ct.nombre}
                        onChange={e => updateColor(ct.id, 'nombre', e.target.value)}
                      />
                      <input
                        type="number" min="1"
                        title="Cantidad de hojas"
                        className="w-16 text-sm border border-slate-200 rounded-lg px-1 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={ct.hojas}
                        onChange={e => updateColor(ct.id, 'hojas', Math.max(1, parseInt(e.target.value) || 1))}
                      />
                      <span className="text-xs text-slate-400 shrink-0">h.</span>
                      <button onClick={() => removeColor(ct.id)} disabled={coloresTendido.length === 1}
                        className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={addColor} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-1">
                    <Plus className="w-3.5 h-3.5" /> Agregar color
                  </button>
                </div>

                {/* Preview del cruce */}
                {preview.length > 0 && coloresValidos.length > 0 && (
                  <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <p className="text-xs font-semibold text-indigo-700 mb-2">Vista previa del cruce:</p>
                    {preview.map((p, i) => (
                      <div key={i} className="text-xs text-slate-700 mb-0.5">
                        <span className="font-medium">{p.nombre}:</span>{' '}
                        {Object.entries(p.tallas).map(([t, q]) => `${t}×${q}`).join(', ')} uds
                      </div>
                    ))}
                    <p className="text-xs text-indigo-500 mt-1.5">
                      En {coloresValidos.length} color(es): {coloresValidos.map(c => `${c.nombre} (${c.hojas}h)`).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Paso 2: mapeo de combinaciones ── */
            <div className="space-y-5">
              {pairsToMap.map(pair => (
                <div key={pair.key} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-semibold text-slate-800 text-sm">{pair.producto.nombre}</span>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Tendido {pair.color.nombre} · {pair.color.hojas} hojas
                    </span>
                    {mapeos[pair.key] && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full ml-auto">✓ Asignada</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">¿Cuál combinación corresponde a este color?</p>
                  <div className="space-y-1.5">
                    {(pair.producto.combinaciones_predefinidas || []).map((predef, idx) => {
                      const isSelected = mapeos[pair.key] === predef.id;
                      return (
                        <div key={predef.id}
                          onClick={() => setMapeos(prev => ({ ...prev, [pair.key]: predef.id }))}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                            isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-indigo-500' : 'border-slate-300'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                          </div>
                          <span className="text-xs text-slate-400 w-5 shrink-0">#{idx + 1}</span>
                          {renderCombColors(pair.producto, predef)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0">
          <Button variant="outline" onClick={paso === 1 ? onCancel : () => setPaso(1)}>
            {paso === 1 ? 'Cancelar' : '← Volver'}
          </Button>
          {paso === 1 ? (
            <Button
              disabled={!canGoNext}
              onClick={handleNext}
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
            >
              {pairsToMap.length > 0 ? 'Siguiente: Combinaciones' : 'Generar Presupuesto'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              disabled={!allMapped}
              onClick={handleGenerate}
              className="bg-green-600 hover:bg-green-700"
            >
              Generar Presupuesto
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
