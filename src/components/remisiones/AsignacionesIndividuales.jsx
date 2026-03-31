import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Printer, X, ChevronDown, ChevronUp, EyeOff, Eye, Settings2 } from "lucide-react";

const TIPOS_MATERIAL_ORDEN = ['tela', 'forro', 'cremallera', 'boton', 'hilo', 'lana', 'accesorio', 'otro'];

// Calcula los materiales para un corte dado un producto y tallas
// materialesOcultos: Set de materia_prima_id que NO deben aparecer en remisiones
function calcularMaterialesCorte(productoInfo, combinacion, tallasCorte, materiasPrimas, colores, materialesOcultos = new Set()) {
  const totalUnidades = tallasCorte.reduce((s, t) => s + (t.cantidad || 0), 0);
  if (totalUnidades === 0) return [];

  const grupos = {};

  (productoInfo.materiales_requeridos || []).forEach(mat => {
    const mp = materiasPrimas.find(m => m.id === mat.materia_prima_id);
    if (!mp) return;
    // Excluir materiales marcados como ocultos en el presupuesto
    if (materialesOcultos.has(mp.id)) return;

    // Resolver color
    let colorNombre = 'Sin definir';
    if (mp.color_fijo) {
      colorNombre = mp.color_por_defecto || 'Color Fijo';
    } else {
      const colorEntry = (combinacion.colores_por_material || []).find(cm => cm.row_id === mat.row_id);
      if (colorEntry?.color_nombre) {
        colorNombre = colorEntry.color_nombre;
      } else if (colorEntry?.color_id) {
        const c = colores.find(c => c.id === colorEntry.color_id);
        colorNombre = c?.nombre || '?';
      }
    }

    // Piezas por prenda (multiplicador para la remisión)
    const piezasPorUnidad = mat.piezas_por_unidad || 1;
    const cantidadBase = (mat.cantidad_por_unidad || 0) * totalUnidades;
    const cantidadFinal = cantidadBase * piezasPorUnidad;

    const tipo = mp.tipo_material || 'otro';
    if (!grupos[tipo]) grupos[tipo] = [];

    // unidad_remision sobreescribe etiqueta_cantidad (ej: hilaza comprada en gramos → tiras en remisión)
    const etiquetaFinal = mat.unidad_remision || mat.etiqueta_cantidad || mp.unidad_medida || 'unidades';
    // descripcion_remision sobreescribe nombre del material (ej: "tiras negras con letra en fondo blanco")
    const nombreFinal = mat.descripcion_remision || mat.nombre_seccion_display || mp.nombre;

    grupos[tipo].push({
      row_id: mat.row_id,
      materia_prima_id: mp.id,
      nombre: nombreFinal,
      nombre_mp: mp.nombre,
      color: colorNombre,
      cantidad: cantidadFinal,
      etiqueta: etiquetaFinal,
      tipo,
      es_color_fijo: !!mp.color_fijo,
      visible: true,
      observacion: ''
    });
  });

  // Ordenar por tipo según el orden definido
  const resultado = [];
  TIPOS_MATERIAL_ORDEN.forEach(tipo => {
    if (grupos[tipo]) resultado.push({ tipo: tipo.toUpperCase(), items: grupos[tipo] });
  });
  Object.keys(grupos).forEach(tipo => {
    if (!TIPOS_MATERIAL_ORDEN.includes(tipo)) resultado.push({ tipo: tipo.toUpperCase(), items: grupos[tipo] });
  });

  return resultado;
}

// Obtener nombre de colores de una combinación para mostrar
function getResumenColores(combinacion, productoInfo, materiasPrimas, colores) {
  const resultado = [];
  (combinacion.colores_por_material || []).forEach(cm => {
    const mat = (productoInfo?.materiales_requeridos || []).find(m => m.row_id === cm.row_id);
    if (!mat) return;
    const mp = materiasPrimas.find(m => m.id === mat.materia_prima_id);
    if (mp?.color_fijo) return;
    if (!cm.color_id && !cm.color_nombre) return;
    const c = colores.find(c => c.id === cm.color_id);
    const nombreColor = cm.color_nombre || c?.nombre || '?';
    const seccion = mat.nombre_seccion_display || mat.seccion || '';
    resultado.push({ seccion, color: nombreColor, hex: c?.codigo_hex });
  });
  return resultado;
}

// Componente para un corte individual
function TarjetaCorte({ corte, index, productoInfo, combinacion, materiasPrimas, colores, materialesOcultos, onActualizar, onEliminar }) {
  const [expandido, setExpandido] = useState(true);

  const materialesAgrupados = useMemo(() =>
    calcularMaterialesCorte(productoInfo, combinacion, corte.tallas, materiasPrimas, colores, materialesOcultos),
    [productoInfo, combinacion, corte.tallas, materiasPrimas, colores, materialesOcultos]
  );

  const totalUnidades = corte.tallas.reduce((s, t) => s + (t.cantidad || 0), 0);

  const actualizarTalla = (tallaIdx, valor) => {
    const nuevasTallas = corte.tallas.map((t, i) => i === tallaIdx ? { ...t, cantidad: parseInt(valor) || 0 } : t);
    onActualizar({ ...corte, tallas: nuevasTallas });
  };

  const actualizarObservacion = (val) => onActualizar({ ...corte, observacion: val });

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 cursor-pointer" onClick={() => setExpandido(!expandido)}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700 text-sm">Corte #{index + 1}</span>
          <Badge className="bg-indigo-100 text-indigo-700 text-xs">{totalUnidades} uds</Badge>
          {!expandido && corte.tallas.filter(t => t.cantidad > 0).map(t => (
            <span key={t.talla} className="text-xs text-slate-500">{t.cantidad}{t.talla}</span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400"
            onClick={(e) => { e.stopPropagation(); onEliminar(); }}>
            <Trash2 className="w-3 h-3" />
          </Button>
          {expandido ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {expandido && (
        <div className="p-3 space-y-3">
          {/* Tallas */}
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Cantidades por talla</Label>
            <div className="flex flex-wrap gap-2">
              {corte.tallas.map((t, idx) => (
                <div key={t.talla} className="flex items-center gap-1 bg-slate-50 border rounded px-2 py-1">
                  <span className="text-xs font-medium text-slate-600 w-5 text-center">{t.talla}</span>
                  <Input
                    type="number" min="0"
                    value={t.cantidad}
                    onChange={(e) => actualizarTalla(idx, e.target.value)}
                    className="w-14 h-6 text-center text-xs border-0 bg-transparent p-0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Vista previa de materiales */}
          {totalUnidades > 0 && materialesAgrupados.length > 0 && (
            <div className="text-xs space-y-1 bg-slate-50 rounded p-2 border">
              <p className="font-medium text-slate-600 mb-1">Vista previa materiales:</p>
              {materialesAgrupados.map(grupo => (
                <div key={grupo.tipo}>
                  <span className="font-semibold text-slate-500 uppercase text-xs">{grupo.tipo}: </span>
                  {grupo.items.map((item, i) => (
                    <span key={i} className="text-slate-600">
                      {item.nombre} ({item.color}) → {item.cantidad % 1 === 0 ? item.cantidad : item.cantidad.toFixed(2)} {item.etiqueta}
                      {i < grupo.items.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Observación */}
          <div>
            <Label className="text-xs text-slate-500">Observación del corte</Label>
            <Input
              placeholder="Ej: Talla M y L, urgente..."
              value={corte.observacion || ''}
              onChange={(e) => actualizarObservacion(e.target.value)}
              className="h-7 text-xs mt-1"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para una combinación con sus cortes
function PanelCombinacion({ combIndex, presupuestoItem, combinacion, productoInfo, materiasPrimas, colores, materialesOcultos, cortes, onActualizarCortes }) {
  const tallas = productoInfo?.tallas || [];
  const resumenColores = getResumenColores(combinacion, productoInfo, materiasPrimas, colores);

  // Total disponible por talla en esta combinación
  const totalPorTalla = {};
  (combinacion.tallas_cantidades || []).forEach(tc => { totalPorTalla[tc.talla] = tc.cantidad || 0; });

  // Total ya asignado en cortes
  const asignadoPorTalla = {};
  cortes.forEach(corte => {
    corte.tallas.forEach(t => {
      asignadoPorTalla[t.talla] = (asignadoPorTalla[t.talla] || 0) + (t.cantidad || 0);
    });
  });

  const disponiblePorTalla = {};
  Object.keys(totalPorTalla).forEach(talla => {
    disponiblePorTalla[talla] = totalPorTalla[talla] - (asignadoPorTalla[talla] || 0);
  });

  const totalDisponible = Object.values(disponiblePorTalla).reduce((s, v) => s + v, 0);
  const totalTotal = Object.values(totalPorTalla).reduce((s, v) => s + v, 0);

  const agregarCorte = () => {
    const nuevoCorte = {
      id: `corte_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      tallas: Object.keys(totalPorTalla).map(talla => ({ talla, cantidad: 0 })),
      observacion: ''
    };
    onActualizarCortes([...cortes, nuevoCorte]);
  };

  const actualizarCorte = (idx, corteActualizado) => {
    onActualizarCortes(cortes.map((c, i) => i === idx ? corteActualizado : c));
  };

  const eliminarCorte = (idx) => {
    onActualizarCortes(cortes.filter((_, i) => i !== idx));
  };

  const totalAsignado = Object.values(asignadoPorTalla).reduce((s, v) => s + v, 0);

  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-3 bg-indigo-50/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-sm font-bold text-indigo-900">
                {productoInfo?.nombre} — Combinación {combIndex + 1}
              </CardTitle>
              <Badge className={`text-xs ${totalDisponible === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                {totalAsignado}/{totalTotal} asignadas
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {resumenColores.map(({ seccion, color, hex }) => (
                <div key={seccion} className="flex items-center gap-1 text-xs text-slate-600 bg-white border rounded px-1.5 py-0.5">
                  {hex && <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: hex }} />}
                  <span className="text-slate-400 capitalize">{seccion}:</span>
                  <span className="font-medium">{color}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-1">
              {Object.entries(totalPorTalla).map(([talla, total]) => {
                const disp = disponiblePorTalla[talla] || 0;
                return (
                  <span key={talla} className={`text-xs ${disp === 0 ? 'text-green-600' : 'text-slate-500'}`}>
                    {talla}: {total - disp}/{total}
                  </span>
                );
              })}
            </div>
          </div>
          <Button type="button" size="sm" onClick={agregarCorte}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs shrink-0">
            <Plus className="w-3 h-3 mr-1" /> Corte
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        {cortes.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed rounded-lg text-slate-400 text-xs">
            Agrega cortes para distribuir las {totalTotal} unidades de esta combinación
          </div>
        ) : (
          cortes.map((corte, idx) => (
            <TarjetaCorte
              key={corte.id}
              corte={corte}
              index={idx}
              productoInfo={productoInfo}
              combinacion={combinacion}
              materiasPrimas={materiasPrimas}
              colores={colores}
              materialesOcultos={materialesOcultos}
              onActualizar={(c) => actualizarCorte(idx, c)}
              onEliminar={() => eliminarCorte(idx)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// PDF: 3 columnas por hoja carta
function generarHTMLRemisiones(remisiones, presupuesto) {
  const formatCantidad = (cantidad, etiqueta) => {
    if (typeof cantidad === 'number' && cantidad % 1 !== 0) {
      return `${cantidad.toFixed(2)} ${etiqueta}`;
    }
    return `${cantidad} ${etiqueta}`;
  };

  const htmlRemision = (rem) => {
    const tallasTexto = rem.tallas.filter(t => t.cantidad > 0).map(t => `${t.cantidad}${t.talla}`).join(' + ');
    const totalUds = rem.tallas.reduce((s, t) => s + (t.cantidad || 0), 0);

    const filasGrupos = rem.materialesAgrupados.map(grupo => {
      const filasTipo = `<tr style="background:#e8f4f8;"><td colspan="2" style="font-weight:bold;text-align:center;padding:3px;font-size:9px;color:#c0392b;border:1px solid #aaa;">${grupo.tipo}</td><td colspan="2" style="background:#e8f4f8;border:1px solid #aaa;"></td></tr>`;
      const filasItems = grupo.items.map(item =>
        `<tr>
          <td style="padding:2px 4px;font-size:8px;border:1px solid #ddd;text-transform:uppercase;font-style:italic;">${item.nombre}</td>
          <td style="padding:2px 4px;font-size:8px;border:1px solid #ddd;color:#c0392b;">${item.es_color_fijo ? '' : item.color}</td>
          <td style="padding:2px 4px;font-size:8px;border:1px solid #ddd;text-align:center;font-weight:bold;font-size:${item === grupo.items[0] ? '14px' : '8px'}">${item === grupo.items[0] ? totalUds : ''}</td>
          <td style="padding:2px 4px;font-size:8px;border:1px solid #ddd;">${formatCantidad(item.cantidad, item.etiqueta)}</td>
        </tr>`
      ).join('');
      return filasTipo + filasItems;
    }).join('');

    return `
      <div style="width:180px;font-family:Arial,sans-serif;border:2px solid #c0392b;padding:0;font-size:8px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#e8f4f8;">
            <td style="font-weight:bold;text-align:center;color:#c0392b;padding:2px;border:1px solid #aaa;font-size:8px;">NOMBRE</td>
            <td colspan="3" style="padding:2px;border:1px solid #aaa;font-size:8px;">&nbsp;</td>
          </tr>
          <tr style="background:#e8f4f8;">
            <td style="font-weight:bold;text-align:center;color:#c0392b;padding:2px;border:1px solid #aaa;font-size:8px;">FECHA</td>
            <td colspan="3" style="padding:2px;border:1px solid #aaa;font-size:8px;">&nbsp;</td>
          </tr>
          <tr style="background:#e8f4f8;">
            <td style="font-weight:bold;text-align:center;color:#c0392b;padding:2px;border:1px solid #aaa;font-size:8px;">ESTILO</td>
            <td colspan="3" style="padding:2px;border:1px solid #aaa;font-size:9px;font-weight:bold;font-style:italic;">${rem.productoNombre}</td>
          </tr>
          <tr style="background:#e8f4f8;">
            <td style="font-weight:bold;text-align:center;color:#c0392b;padding:2px;border:1px solid #aaa;font-size:8px;">INSUMO</td>
            <td style="font-weight:bold;text-align:center;color:#c0392b;padding:2px;border:1px solid #aaa;font-size:8px;">COLOR</td>
            <td style="font-weight:bold;text-align:center;color:#c0392b;padding:2px;border:1px solid #aaa;font-size:7px;">CANT.</td>
            <td style="font-weight:bold;text-align:center;color:#c0392b;padding:2px;border:1px solid #aaa;font-size:7px;">CHECK</td>
          </tr>
          ${filasGrupos}
          <tr style="background:#e8f4f8;">
            <td colspan="4" style="font-weight:bold;text-align:center;color:#c0392b;padding:2px;border:1px solid #aaa;font-size:8px;">OBSERVACIONES</td>
          </tr>
          <tr>
            <td colspan="4" style="padding:3px;border:1px solid #ddd;font-size:8px;">${rem.observacion || tallasTexto || '&nbsp;'}</td>
          </tr>
        </table>
      </div>
    `;
  };

  // Agrupar en grupos de 3
  const paginas = [];
  for (let i = 0; i < remisiones.length; i += 3) {
    const grupo = remisiones.slice(i, i + 3);
    paginas.push(grupo);
  }

  const htmlPaginas = paginas.map(grupo =>
    `<div style="display:flex;gap:8px;align-items:flex-start;page-break-after:always;padding:10px;">
      ${grupo.map(rem => htmlRemision(rem)).join('')}
    </div>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Remisiones Individuales — ${presupuesto.numero_presupuesto}</title>
  <style>
    @page { size: letter landscape; margin: 5mm; }
    body { margin: 0; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  ${htmlPaginas}
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

export default function AsignacionesIndividuales({ presupuesto, productos, materiasPrimas, colores, onGuardar, onCancelar }) {
  // Estructura: { [combKey]: corte[] }
  // combKey = `${presupuestoItemId}_${combIndex}`
  const [cortesPorCombinacion, setCortesPorCombinacion] = useState({});
  const [mostrarConfigMateriales, setMostrarConfigMateriales] = useState(false);

  // Inicializar ocultos desde el presupuesto, permitir ajuste local
  const [materialesOcultosLocal, setMaterialesOcultosLocal] = useState(
    () => new Set(presupuesto.materiales_ocultos || [])
  );

  const toggleOcultoLocal = (mpId) => {
    setMaterialesOcultosLocal(prev => {
      const next = new Set(prev);
      if (next.has(mpId)) next.delete(mpId);
      else next.add(mpId);
      return next;
    });
  };

  // Lista de materias primas únicas que usa este presupuesto
  const materiasUsadas = useMemo(() => {
    const ids = new Set();
    (presupuesto.productos || []).forEach(item => {
      const prod = productos.find(p => p.id === item.producto_id);
      (prod?.materiales_requeridos || []).forEach(mat => ids.add(mat.materia_prima_id));
    });
    return materiasPrimas.filter(mp => ids.has(mp.id));
  }, [presupuesto, productos, materiasPrimas]);

  // Expandir todos los productos/combinaciones del presupuesto
  const combinaciones = useMemo(() => {
    const resultado = [];
    (presupuesto.productos || []).forEach(item => {
      const productoInfo = productos.find(p => p.id === item.producto_id);
      (item.combinaciones || []).forEach((comb, combIdx) => {
        const totalUnidades = (comb.tallas_cantidades || []).reduce((s, tc) => s + (tc.cantidad || 0), 0);
        if (totalUnidades === 0) return;
        resultado.push({
          key: `${item.id}_${combIdx}`,
          presupuestoItemId: item.id,
          combIndex: combIdx,
          combinacion: comb,
          productoInfo,
          totalUnidades
        });
      });
    });
    return resultado;
  }, [presupuesto, productos]);

  const actualizarCortes = (key, nuevosCortes) => {
    setCortesPorCombinacion(prev => ({ ...prev, [key]: nuevosCortes }));
  };

  const totalCortes = Object.values(cortesPorCombinacion).reduce((s, arr) => s + arr.length, 0);

  const imprimirRemisiones = () => {
    // Preparar datos de todas las remisiones
    const remisiones = [];

    combinaciones.forEach(({ key, combinacion, productoInfo }) => {
      const cortes = cortesPorCombinacion[key] || [];
      cortes.forEach(corte => {
        const totalUnidades = corte.tallas.reduce((s, t) => s + (t.cantidad || 0), 0);
        if (totalUnidades === 0) return;

        const materialesAgrupados = calcularMaterialesCorte(
          productoInfo, combinacion, corte.tallas, materiasPrimas, colores, materialesOcultosLocal
        );

        remisiones.push({
          productoNombre: productoInfo?.nombre || '?',
          tallas: corte.tallas,
          observacion: corte.observacion,
          materialesAgrupados
        });
      });
    });

    if (remisiones.length === 0) {
      alert('No hay cortes con unidades para imprimir.');
      return;
    }

    const html = generarHTMLRemisiones(remisiones, presupuesto);
    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
  };

  const guardarRemisiones = async () => {
    const remisionesFinales = [];

    combinaciones.forEach(({ key, combinacion, productoInfo, presupuestoItemId }) => {
      const cortes = cortesPorCombinacion[key] || [];
      cortes.forEach((corte, idx) => {
        const tallasConCantidad = corte.tallas.filter(t => t.cantidad > 0);
        if (tallasConCantidad.length === 0) return;

        const materialesAgrupados = calcularMaterialesCorte(
          productoInfo, combinacion, corte.tallas, materiasPrimas, colores, materialesOcultosLocal
        );

        const materialesPlanos = materialesAgrupados.flatMap(g => g.items).map(item => ({
          materia_prima_id: item.materia_prima_id,
          nombre: item.nombre,
          color: item.color,
          cantidad_total: item.cantidad,
          unidad_medida: item.etiqueta
        }));

        remisionesFinales.push({
          numero_remision: `${presupuesto.numero_presupuesto}-AI-${String(remisionesFinales.length + 1).padStart(3, '0')}`,
          presupuesto_id: presupuesto.id,
          tipo_remision: 'Asignacion_Individual',
          estado: 'pendiente',
          productos_asignados: [{
            producto_id: productoInfo?.id,
            producto_nombre: productoInfo?.nombre,
            combinaciones: [{ ...combinacion, tallas_cantidades: tallasConCantidad }],
            total_unidades: tallasConCantidad.reduce((s, t) => s + t.cantidad, 0)
          }],
          materiales_calculados: materialesPlanos,
          observaciones: corte.observacion || ''
        });
      });
    });

    if (remisionesFinales.length === 0) {
      alert('No hay cortes con unidades para guardar.');
      return;
    }

    await onGuardar(remisionesFinales);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Remisiones Individuales</h2>
          <p className="text-sm text-slate-500">
            {presupuesto.numero_presupuesto} — {presupuesto.cliente} · {combinaciones.length} combinaciones · {totalCortes} cortes creados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancelar}>
            <X className="w-4 h-4 mr-2" /> Cancelar
          </Button>
          <Button variant="outline" onClick={() => setMostrarConfigMateriales(!mostrarConfigMateriales)} className="border-slate-200 text-slate-600">
            <Settings2 className="w-4 h-4 mr-2" /> Materiales visibles
          </Button>
          <Button variant="outline" onClick={imprimirRemisiones} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <Printer className="w-4 h-4 mr-2" /> Imprimir ({totalCortes})
          </Button>
          <Button onClick={guardarRemisiones} className="bg-green-600 hover:bg-green-700">
            Guardar Remisiones
          </Button>
        </div>
      </div>

      {/* Panel de configuración de visibilidad de materiales */}
      {mostrarConfigMateriales && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
            <EyeOff className="w-3 h-3" /> Materiales excluidos de las remisiones — Los tachados NO aparecerán en el PDF ni en los cálculos
          </p>
          <div className="flex flex-wrap gap-2">
            {materiasUsadas.map(mp => {
              const oculto = materialesOcultosLocal.has(mp.id);
              return (
                <button
                  key={mp.id}
                  type="button"
                  onClick={() => toggleOcultoLocal(mp.id)}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all ${
                    oculto
                      ? 'bg-red-100 border-red-300 text-red-600 line-through'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {oculto ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {mp.nombre}
                  <span className="text-slate-400 no-underline" style={{ textDecoration: 'none' }}>({mp.tipo_material})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Instrucciones */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
        💡 Cada combinación se divide en <strong>cortes independientes</strong>. Un corte = una hoja de remisión. Agrega los cortes y define cuántas unidades de cada talla van en cada uno. Se imprimirán <strong>3 remisiones por hoja carta</strong>.
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {combinaciones.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p>Este presupuesto no tiene combinaciones con unidades asignadas.</p>
            <p className="text-xs mt-1">Ve al presupuesto y agrega combinaciones con cantidades por talla.</p>
          </div>
        ) : (
          combinaciones.map(({ key, combIndex, combinacion, productoInfo }) => (
            <PanelCombinacion
              key={key}
              combIndex={combIndex}
              presupuestoItem={null}
              combinacion={combinacion}
              productoInfo={productoInfo}
              materiasPrimas={materiasPrimas}
              colores={colores}
              materialesOcultos={materialesOcultosLocal}
              cortes={cortesPorCombinacion[key] || []}
              onActualizarCortes={(cortes) => actualizarCortes(key, cortes)}
            />
          ))
        )}
      </div>
    </div>
  );
}