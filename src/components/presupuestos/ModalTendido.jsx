import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { X, Plus, Trash2, ChevronRight, Layers } from "lucide-react";

export default function ModalTendido({ productos, colores, materiasPrimas, onGenerate, onCancel }) {
  const [paso, setPaso] = useState(1);
  const [filas, setFilas] = useState([{ id: `f_${Date.now()}`, producto_id: '', talla: '', cant_hoja: 1 }]);
  const [coloresTendido, setColoresTendido] = useState([{ id: `c_${Date.now()}`, color_id: '', hojas: 10 }]);
  // key: `${producto_id}::${predef_id}` → cantidad seleccionada
  const [cantidades, setCantidades] = useState({});

  const coloresMap = useMemo(() => new Map((colores || []).map(c => [c.id, c])), [colores]);
  const mpMap = useMemo(() => new Map((materiasPrimas || []).map(mp => [mp.id, mp])), [materiasPrimas]);

  const filasValidas = filas.filter(f => f.producto_id && f.talla);
  const coloresValidos = coloresTendido.filter(c => c.color_id && c.hojas > 0);

  // Un entry por producto único que tenga combinaciones predefinidas
  const pairsToMap = useMemo(() => {
    const pairs = [];
    const seen = new Set();
    for (const fila of filasValidas) {
      if (seen.has(fila.producto_id)) continue;
      const producto = productos.find(p => p.id === fila.producto_id);
      if (!producto?.combinaciones_predefinidas?.length) continue;
      seen.add(fila.producto_id);
      pairs.push({ key: fila.producto_id, producto_id: fila.producto_id, producto });
    }
    return pairs;
  }, [filas, productos]);

  const addFila = () => setFilas(prev => [...prev, { id: `f_${Date.now()}`, producto_id: '', talla: '', cant_hoja: 1 }]);
  const removeFila = (id) => setFilas(prev => prev.filter(f => f.id !== id));
  const updateFila = (id, field, value) => setFilas(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));

  const addColor = () => setColoresTendido(prev => [...prev, { id: `c_${Date.now()}`, color_id: '', hojas: 10 }]);
  const removeColor = (id) => setColoresTendido(prev => prev.filter(c => c.id !== id));
  const updateColor = (id, field, value) => setColoresTendido(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  // Secciones que no vienen de ESTE tendido de tela:
  // - forro/central: tendidos complementarios (piezas internas)
  // - contraste: material de acento (hilo, vivo, cinta) — viene de bobina aparte, no del tendido
  const SECCIONES_NO_TENDIDO = new Set(['forro', 'central', 'contraste']);

  // Para capacidad y compatibilidad: solo colores del tejido principal
  const getCapacityColors = (producto, predef) => {
    return (predef.colores_por_material || []).filter(cm => {
      if (!cm.color_id) return false;
      const mat = producto?.materiales_requeridos?.find(m => m.row_id === cm.row_id);
      const mp = mpMap.get(mat?.materia_prima_id);
      if (mp?.color_fijo && !mat?.color_independiente) return false;
      if (mat?.seccion === 'color_propio' && !mat?.color_independiente) return false;
      if (SECCIONES_NO_TENDIDO.has(mat?.seccion)) return false;
      return true;
    });
  };

  // Para mostrar en pantalla: incluye contraste (referencia visual), oculta forro/central
  const getDisplayColors = (producto, predef) => {
    return (predef.colores_por_material || []).filter(cm => {
      if (!cm.color_id) return false;
      const mat = producto?.materiales_requeridos?.find(m => m.row_id === cm.row_id);
      const mp = mpMap.get(mat?.materia_prima_id);
      if (mp?.color_fijo && !mat?.color_independiente) return false;
      if (mat?.seccion === 'color_propio' && !mat?.color_independiente) return false;
      if (['forro', 'central'].includes(mat?.seccion)) return false;
      return true;
    });
  };

  // Capacidad disponible por color = hojas totales (los productos se cortan simultáneamente,
  // no compiten entre sí por las hojas)
  const hojasPorColor = useMemo(() => {
    const map = {};
    for (const ct of coloresValidos) map[ct.color_id] = ct.hojas;
    return map;
  }, [coloresValidos]);

  // Combinación compatible si todos sus colores de capacidad están en el tendido
  const isCompatibleCombination = (producto, predef) => {
    const tendidoColorIds = new Set(coloresValidos.map(c => c.color_id));
    const capColors = getCapacityColors(producto, predef);
    if (capColors.length === 0) return true;
    return capColors.every(cm => tendidoColorIds.has(cm.color_id));
  };

  // Máximo de esta combinación = min(hojas de cada color distinto de capacidad)
  // El contraste NO cuenta: viene de bobina aparte
  const getMaxUnits = (productoId, predef, producto) => {
    const capColors = getCapacityColors(producto, predef);
    const distinctColors = new Set(capColors.map(cm => cm.color_id));
    if (distinctColors.size === 0) return 0;
    let max = Infinity;
    for (const cid of distinctColors) {
      max = Math.min(max, hojasPorColor[cid] ?? 0);
    }
    return max === Infinity ? 0 : max;
  };

  const canGoNext = filasValidas.length > 0 && coloresValidos.length > 0;

  const allMapped = pairsToMap.every(pair => {
    const total = (pair.producto.combinaciones_predefinidas || []).reduce(
      (sum, predef) => sum + (cantidades[`${pair.key}::${predef.id}`] || 0), 0
    );
    return total > 0;
  });

  const renderCombColors = (producto, predef) => {
    const secLabels = { superior: 'Sup', central: 'Cen', inferior: 'Inf', forro: 'Fo', contraste: 'K', fondo_entero: 'FE' };
    const activos = getDisplayColors(producto, predef);
    if (activos.length === 0) return <span className="text-xs text-slate-400 italic">Sin colores definidos</span>;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {activos.map(cm => {
          const c = coloresMap.get(cm.color_id);
          const mat = producto?.materiales_requeridos?.find(m => m.row_id === cm.row_id);
          const sec = secLabels[mat?.seccion] || '';
          const esContraste = mat?.seccion === 'contraste';
          if (!c) return null;
          return (
            <div key={cm.row_id} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-full border shrink-0 ${esContraste ? 'border-dashed border-slate-400' : 'border-slate-200'}`}
                style={{ backgroundColor: c.codigo_hex }} />
              <span className={`text-xs ${esContraste ? 'text-slate-400' : 'text-slate-600'}`}>
                {c.nombre}{sec ? ` (${sec})` : ''}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Vista previa del cruce (paso 1)
  const preview = useMemo(() => {
    const result = {};
    for (const fila of filasValidas) {
      const producto = productos.find(p => p.id === fila.producto_id);
      if (!result[fila.producto_id]) result[fila.producto_id] = { nombre: producto?.nombre || '?', tallas: {} };
      const total = coloresValidos.reduce((s, c) => s + (fila.cant_hoja || 1) * c.hojas, 0);
      result[fila.producto_id].tallas[fila.talla] = (result[fila.producto_id].tallas[fila.talla] || 0) + total;
    }
    return Object.values(result);
  }, [filas, coloresTendido, productos]);

  const handleGenerate = () => {
    const productoGroups = {};

    // Productos con combinaciones seleccionadas
    for (const pair of pairsToMap) {
      const filasDelProducto = filasValidas.filter(f => f.producto_id === pair.producto_id);

      for (const predef of (pair.producto.combinaciones_predefinidas || [])) {
        const qty = cantidades[`${pair.key}::${predef.id}`] || 0;
        if (qty <= 0) continue;

        if (!productoGroups[pair.producto_id]) {
          productoGroups[pair.producto_id] = {
            producto_id: pair.producto_id,
            unidades_por_asignacion: 20,
            combinaciones: [],
            objetivo_por_talla: {},
          };
        }

        const tallas_cantidades = filasDelProducto.map(f => ({
          talla: f.talla,
          cantidad: (f.cant_hoja || 1) * qty,
        }));

        productoGroups[pair.producto_id].combinaciones.push({
          id: `tend_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          predefinida_id: predef.id,
          colores_por_material: predef.colores_por_material || [],
          tallas_cantidades,
        });

        for (const tc of tallas_cantidades) {
          productoGroups[pair.producto_id].objetivo_por_talla[tc.talla] =
            (productoGroups[pair.producto_id].objetivo_por_talla[tc.talla] || 0) + tc.cantidad;
        }
      }
    }

    // Productos sin combinaciones predefinidas: usar cruce directo
    for (const fila of filasValidas) {
      const producto = productos.find(p => p.id === fila.producto_id);
      if (producto?.combinaciones_predefinidas?.length) continue;
      if (!productoGroups[fila.producto_id]) {
        productoGroups[fila.producto_id] = {
          producto_id: fila.producto_id,
          unidades_por_asignacion: 20,
          combinaciones: [],
          objetivo_por_talla: {},
        };
      }
      const totalQty = coloresValidos.reduce((s, c) => s + (fila.cant_hoja || 1) * c.hojas, 0);
      productoGroups[fila.producto_id].objetivo_por_talla[fila.talla] =
        (productoGroups[fila.producto_id].objetivo_por_talla[fila.talla] || 0) + totalQty;
    }

    const tendidoConfig = {
      filas: filasValidas.map(f => ({
        producto_id: f.producto_id,
        producto_nombre: productos.find(p => p.id === f.producto_id)?.nombre || '?',
        talla: f.talla,
        cant_hoja: f.cant_hoja || 1,
      })),
      colores: coloresValidos.map(ct => {
        const c = coloresMap.get(ct.color_id);
        return { color_id: ct.color_id, color_nombre: c?.nombre || '?', codigo_hex: c?.codigo_hex || '#ccc', hojas: ct.hojas };
      }),
    };

    onGenerate(Object.values(productoGroups), tendidoConfig);
  };

  const handleNext = () => pairsToMap.length > 0 ? setPaso(2) : handleGenerate();

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
              {paso === 1 ? 'Define las referencias y los colores del tendido'
                : 'Define cuántas unidades de cada combinación de colores'}
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
                          type="number" min="1" title="Unidades por hoja"
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
                  {coloresTendido.map((ct, idx) => {
                    const colorObj = coloresMap.get(ct.color_id);
                    return (
                      <div key={ct.id} className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 w-4 shrink-0">{idx + 1}</span>
                        {colorObj && (
                          <div className="w-5 h-5 rounded-full border border-slate-300 shrink-0"
                            style={{ backgroundColor: colorObj.codigo_hex }} />
                        )}
                        <select
                          className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={ct.color_id}
                          onChange={e => updateColor(ct.id, 'color_id', e.target.value)}
                        >
                          <option value="">Color...</option>
                          {(colores || []).map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                        <input
                          type="number" min="1" title="Cantidad de hojas"
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
                    );
                  })}
                  <button onClick={addColor} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-1">
                    <Plus className="w-3.5 h-3.5" /> Agregar color
                  </button>
                </div>

                {/* Vista previa */}
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
                      En {coloresValidos.length} color(es): {coloresValidos.map(c => `${coloresMap.get(c.color_id)?.nombre || '?'} (${c.hojas}h)`).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

          ) : (
            /* ── Paso 2: cantidades por combinación ── */
            <div className="space-y-5">

              {/* Referencia de hojas por color */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-2">Hojas disponibles por color</p>
                <div className="space-y-1.5">
                  {coloresValidos.map(ct => {
                    const colorObj = coloresMap.get(ct.color_id);
                    return (
                      <div key={ct.id} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorObj?.codigo_hex || '#ccc' }} />
                        <span className="text-xs text-slate-700 w-24 truncate">{colorObj?.nombre || '?'}</span>
                        <div className="flex-1 h-2 bg-emerald-200 rounded-full overflow-hidden">
                          <div className="h-full w-full bg-emerald-400 rounded-full" />
                        </div>
                        <span className="text-xs font-semibold w-16 text-right text-emerald-700">
                          {ct.hojas} hojas
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-2">Cada hoja produce 1 pieza de cada referencia y talla del tendido</p>
              </div>

              {/* Cards por producto */}
              {pairsToMap.map(pair => {
                const filasProducto = filasValidas.filter(f => f.producto_id === pair.producto_id);
                const compatibles = (pair.producto.combinaciones_predefinidas || []).filter(
                  predef => isCompatibleCombination(pair.producto, predef)
                );
                const totalSel = compatibles.reduce(
                  (sum, predef) => sum + (cantidades[`${pair.key}::${predef.id}`] || 0), 0
                );

                return (
                  <div key={pair.key} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex items-start justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <div>
                        <span className="font-semibold text-slate-800 text-sm">{pair.producto.nombre}</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {filasProducto.map((f, i) => (
                            <span key={i} className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
                              {f.talla} ×{f.cant_hoja}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${totalSel > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                        {totalSel > 0 ? `${totalSel} hojas sel.` : 'Sin selección'}
                      </span>
                    </div>

                    <div className="p-3 space-y-2">
                      {compatibles.length === 0 ? (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Sin combinaciones compatibles con los colores del tendido.
                        </p>
                      ) : compatibles.map((predef, idx) => {
                        const key = `${pair.key}::${predef.id}`;
                        const qty = cantidades[key] || 0;
                        const maxUnits = getMaxUnits(pair.producto_id, predef, pair.producto);
                        const agotado = maxUnits === 0;
                        const excedido = qty > maxUnits;
                        const piezasPorTalla = filasProducto.map(f => ({
                          talla: f.talla,
                          cantidad: qty * (f.cant_hoja || 1),
                        }));

                        return (
                          <div key={predef.id}
                            className={`p-2.5 rounded-lg border ${
                              qty > 0 ? 'border-indigo-300 bg-indigo-50/40'
                              : agotado ? 'border-slate-100 bg-slate-50 opacity-50'
                              : 'border-slate-200 bg-white'
                            }`}>
                            <div className="flex items-start gap-3">
                              <span className="text-xs text-slate-400 w-5 shrink-0 mt-0.5">#{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                {renderCombColors(pair.producto, predef)}
                                <p className={`text-xs mt-0.5 ${agotado ? 'text-red-400' : 'text-slate-400'}`}>
                                  Máx: {maxUnits} hojas disponibles
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number" min="0"
                                  className={`w-16 text-sm border rounded-lg px-1.5 py-1 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                                    excedido ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200'
                                  }`}
                                  value={qty || ''}
                                  placeholder="0"
                                  disabled={agotado}
                                  onChange={e => {
                                    const v = Math.max(0, parseInt(e.target.value) || 0);
                                    setCantidades(prev => ({ ...prev, [key]: v }));
                                  }}
                                />
                                <span className="text-xs text-slate-400">h.</span>
                              </div>
                            </div>
                            {qty > 0 && (
                              <div className="mt-2 ml-8 flex flex-wrap gap-1.5">
                                {piezasPorTalla.map((pt, i) => (
                                  <span key={i} className="text-xs bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 font-medium">
                                    {pt.cantidad} {pt.talla}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0">
          <Button variant="outline" onClick={paso === 1 ? onCancel : () => setPaso(1)}>
            {paso === 1 ? 'Cancelar' : '← Volver'}
          </Button>
          {paso === 1 ? (
            <Button disabled={!canGoNext} onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              {pairsToMap.length > 0 ? 'Siguiente: Combinaciones' : 'Generar Presupuesto'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button disabled={!allMapped} onClick={handleGenerate} className="bg-green-600 hover:bg-green-700">
              Generar Presupuesto
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
