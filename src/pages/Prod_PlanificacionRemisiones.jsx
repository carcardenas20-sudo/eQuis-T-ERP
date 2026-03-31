
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Presupuesto, Producto, MateriaPrima, Operacion, Remision, Color } from "@/api/entitiesChaquetas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { ArrowLeft, Save, Download, Plus, GripVertical, X, Printer, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { toast } from "sonner"; // Import toast for notifications

// Función para generar IDs únicos sin uuid
const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;


export default function PlanificacionRemisiones() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const presupuestoId = searchParams.get('presupuesto');
  const remisionId = searchParams.get('remision'); // Para modo edición
  
  const [presupuesto, setPresupuesto] = useState(null);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [colores, setColores] = useState([]);
  const [operaciones, setOperaciones] = useState([]);
  const [remisiones, setRemisiones] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [remisionEditando, setRemisionEditando] = useState(null);

  // New state for auto-generation loading indicator
  const [isGenerating, setIsGenerating] = useState(false);

  const loadData = useCallback(async () => {
    if (!presupuestoId && !remisionId) {
      setError('No se especificó un presupuesto ni una remisión');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const [presupuestos, productosData, materiasData, coloresData, operacionesData] = await Promise.all([
        Presupuesto.list(),
        Producto.list(),
        MateriaPrima.list(),
        Color.list(),
        Operacion.list()
      ]);

      setProductos(productosData);
      setMateriasPrimas(materiasData);
      setColores(coloresData);

      let allRemisiones = [];
      if (presupuestoId || remisionId) {
        allRemisiones = await Remision.list(); 
      }

      let currentPresupuesto = null;
      if (remisionId) {
        setModoEdicion(true);
        const currentRemision = allRemisiones.find(r => r.id === remisionId);
        if (!currentRemision) {
          throw new Error('Remisión no encontrada');
        }
        setRemisionEditando(currentRemision);
        currentPresupuesto = presupuestos.find(p => p.id === currentRemision.presupuesto_id);
      } else {
        setModoEdicion(false);
        currentPresupuesto = presupuestos.find(p => p.id === presupuestoId);
      }

      if (!currentPresupuesto) {
        throw new Error('Presupuesto asociado no encontrado');
      }
      setPresupuesto(currentPresupuesto);
      
      const operacionesActivas = operacionesData.filter(op => op.activa);
      setOperaciones(operacionesActivas);
      
      const remisionesIniciales = {};
      operacionesActivas.forEach(op => {
        const tipoKey = op.nombre.replace(/\s/g, '_');
        remisionesIniciales[tipoKey] = {
          id: null,
          tipo: op.nombre,
          items: [],
          operario: '',
          fecha_entrega: '',
          observaciones: '',
          estado: 'pendiente'
        };
      });
      
      const remisionesDelPresupuesto = allRemisiones.filter(r => r.presupuesto_id === currentPresupuesto.id && r.tipo_remision !== 'Asignacion_Individual');

      remisionesDelPresupuesto.forEach(remisionExistente => {
        const tipoKey = remisionExistente.tipo_remision;
        if (remisionesIniciales[tipoKey]) {
          remisionesIniciales[tipoKey] = {
            ...remisionesIniciales[tipoKey],
            id: remisionExistente.id,
            operario: remisionExistente.operario_asignado || '',
            fecha_entrega: remisionExistente.fecha_entrega || '',
            observaciones: remisionExistente.observaciones || '',
            estado: remisionExistente.estado,
            items: [
              ...(remisionExistente.productos_asignados || []).map((prodItem) => {
                const productoInfo = productosData.find(p => p.id === prodItem.producto_id);
                return {
                  id: generateId(),
                  producto_entity_id: prodItem.producto_id,
                  tipo: 'producto',
                  nombre: prodItem.producto_nombre || productoInfo?.nombre || 'Producto Desconocido',
                  combinaciones: prodItem.combinaciones || [],
                  cantidad_total: prodItem.total_unidades || 0,
                  editable: {
                    cantidad: prodItem.total_unidades || 0,
                    observaciones: prodItem.observaciones || []
                  }
                };
              }),
              ...(remisionExistente.detalles_corte || []).map((matItem) => {
                const materiaInfo = materiasData.find(m => m.id === matItem.materia_prima_id);
                return {
                  id: generateId(),
                  materia_prima_id: matItem.materia_prima_id,
                  tipo: 'material',
                  nombre: materiaInfo?.nombre || 'Material Desconocido',
                  color: matItem.color,
                  cantidad_total: matItem.cantidad_total || 0,
                  unidad_medida: matItem.unidad_medida,
                  tipo_material: materiaInfo?.tipo_material || 'otro',
                  editable: {
                    cantidad: matItem.cantidad_total || 0,
                    observaciones: matItem.observaciones || []
                  }
                };
              }),
              ...((remisionExistente.materiales_calculados || []).filter(
                (matCalcItem) => !(remisionExistente.detalles_corte || []).some(
                  (detItem) => detItem.materia_prima_id === matCalcItem.materia_prima_id && detItem.color === matCalcItem.color
                )
              ).map((matItem) => {
                const materiaInfo = materiasData.find(m => m.id === matItem.materia_prima_id);
                return {
                  id: generateId(),
                  materia_prima_id: matItem.materia_prima_id,
                  tipo: 'material',
                  nombre: materiaInfo?.nombre || 'Material Desconocido',
                  color: matItem.color,
                  cantidad_total: parseFloat(matItem.cantidad_total) || 0,
                  unidad_medida: matItem.unidad_medida,
                  tipo_material: materiaInfo?.tipo_material || 'otro',
                  editable: {
                    cantidad: parseFloat(matItem.cantidad_total) || 0,
                    observaciones: matItem.observaciones ? [matItem.observaciones] : []
                  }
                };
              }))
            ]
          };
        }
      });
      
      setRemisiones(remisionesIniciales);
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error al cargar los datos: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [presupuestoId, remisionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    let itemArrastrado = null;
    let newRemisionesState = { ...remisiones };

    if (source.droppableId in newRemisionesState) {
      const sourceRemision = newRemisionesState[source.droppableId];
      itemArrastrado = { ...sourceRemision.items[source.index] };
      const newSourceItems = [...sourceRemision.items];
      newSourceItems.splice(source.index, 1);
      newRemisionesState[source.droppableId] = {
        ...sourceRemision,
        items: newSourceItems,
      };
    }

    if (source.droppableId === 'presupuesto-productos') {
      const producto = presupuesto?.productos?.find(p => p.id === draggableId);
      if (producto) {
        const productoInfo = productos.find(pr => pr.id === producto.producto_id);
        const totalUnidades = producto.combinaciones?.reduce((acc, comb) => 
          acc + (comb.tallas_cantidades?.reduce((sum, tc) => sum + tc.cantidad, 0) || 0), 0
        ) || 0;
        itemArrastrado = {
          id: generateId(),
          producto_entity_id: producto.producto_id,
          tipo: 'producto',
          nombre: productoInfo?.nombre || 'Producto',
          combinaciones: producto.combinaciones || [],
          cantidad_total: totalUnidades,
          editable: {
            cantidad: totalUnidades,
            observaciones: []
          }
        };
      }
    } else if (source.droppableId === 'presupuesto-materiales') {
      const material = presupuesto?.materiales_calculados?.find(m => 
        `${m.materia_prima_id}_${m.color}` === draggableId
      );
      if (material) {
        const materiaInfo = materiasPrimas.find(mp => mp.id === material.materia_prima_id);
        itemArrastrado = {
          id: generateId(),
          materia_prima_id: material.materia_prima_id,
          tipo: 'material',
          nombre: material.nombre,
          color: material.color,
          cantidad_total: material.cantidad_total,
          unidad_medida: material.unidad_medida,
          tipo_material: materiaInfo?.tipo_material || 'otro',
          editable: {
            cantidad: material.cantidad_total,
            observaciones: []
          }
        };
      }
    } 

    if (!itemArrastrado || (source.droppableId.startsWith('presupuesto-') && destination.droppableId.startsWith('presupuesto-'))) {
       setRemisiones(newRemisionesState);
       return; 
    }

    if (destination.droppableId in newRemisionesState) {
      const destRemision = newRemisionesState[destination.droppableId];
      const newDestItems = [...destRemision.items];
      newDestItems.splice(destination.index, 0, itemArrastrado);
       newRemisionesState[destination.droppableId] = {
        ...destRemision,
        items: newDestItems,
      };
    }
    
    setRemisiones(newRemisionesState);
  };

  const actualizarRemision = (tipoRemision, campo, valor) => {
    setRemisiones(prev => ({
      ...prev,
      [tipoRemision]: {
        ...prev[tipoRemision],
        [campo]: valor
      }
    }));
  };

  const actualizarItem = (tipoRemision, itemIndex, campo, valor) => {
    setRemisiones(prev => {
      const updatedItems = prev[tipoRemision].items.map((item, index) => 
        index === itemIndex 
          ? { ...item, editable: { ...item.editable, [campo]: valor } }
          : item
      );
      return {
        ...prev,
        [tipoRemision]: {
          ...prev[tipoRemision],
          items: updatedItems
        }
      };
    });
  };

  const agregarObservacion = (tipoRemision, itemIndex) => {
    setRemisiones(prev => ({
      ...prev,
      [tipoRemision]: {
        ...prev[tipoRemision],
        items: prev[tipoRemision].items.map((item, index) => 
          index === itemIndex 
            ? { 
                ...item, 
                editable: { 
                  ...item.editable, 
                  observaciones: [...(item.editable.observaciones || []), ''] 
                } 
              }
            : item
        )
      }
    }));
  };

  const actualizarObservacion = (tipoRemision, itemIndex, obsIndex, valor) => {
    setRemisiones(prev => ({
      ...prev,
      [tipoRemision]: {
        ...prev[tipoRemision],
        items: prev[tipoRemision].items.map((item, index) => 
          index === itemIndex 
            ? { 
                ...item, 
                editable: { 
                  ...item.editable, 
                  observaciones: item.editable.observaciones.map((obs, oIndex) => 
                    oIndex === obsIndex ? valor : obs
                  )
                } 
              }
            : item
        )
      }
    }));
  };

  const eliminarObservacion = (tipoRemision, itemIndex, obsIndex) => {
    setRemisiones(prev => ({
      ...prev,
      [tipoRemision]: {
        ...prev[tipoRemision],
        items: prev[tipoRemision].items.map((item, index) => 
          index === itemIndex 
            ? { 
                ...item, 
                editable: { 
                  ...item.editable, 
                  observaciones: item.editable.observaciones.filter((_, oIndex) => oIndex !== obsIndex)
                } 
              }
            : item
        )
      }
    }));
  };

  const generarPDFDesdeBorrador = (remisionData, paraImprimir = false) => {
    if (!presupuesto) {
      alert('Error: Presupuesto no cargado.');
      return;
    }
    if (remisionData.items.length === 0) {
      alert('Esta remisión no tiene ítems para generar un borrador.');
      return;
    }

    const ventanaPDF = window.open('', '_blank');
    if (!ventanaPDF) {
      alert('No se pudo abrir la ventana para el PDF. Deshabilita el bloqueador de ventanas emergentes.');
      return;
    }

    let htmlContent = `
    <html>
    <head>
        <title>Borrador de Remisión - ${remisionData.tipo}</title>
        <style>
            @page { size: letter; margin: 0.6in; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #1a202c; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2d3748; padding-bottom: 15px; margin-bottom: 25px; }
            .header h1 { font-size: 28px; color: #1a202c; margin: 0; }
            .header .meta { text-align: right; font-size: 14px; }
            .header .meta p { margin: 3px 0; }
            .header .meta .label { font-weight: bold; }
            .section { margin-bottom: 30px; }
            .section h3 { font-size: 18px; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
            .producto-card { background-color: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
            .producto-nombre { font-size: 16px; font-weight: bold; color: #2b6cb0; margin-bottom: 10px; }
            .combinacion { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
            .combinacion:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
            .colores-info, .tallas-info { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
            .color-badge { background-color: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
            .talla-badge { background-color: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .materiales-section table { width: 100%; border-collapse: collapse; background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; overflow: hidden; }
            .materiales-section th { background-color: #f59e0b; color: white; padding: 12px; font-weight: bold; text-align: left; }
            .materiales-section td { padding: 10px 12px; border-bottom: 1px solid #fde68a; }
            .materiales-section tr:last-child td { border-bottom: none; }
            .material-nombre { font-weight: 600; color: #92400e; }
            .material-cantidad { font-weight: bold; text-align: right; color: #92400e; }
            .observaciones-section { background-color: #fef3c7; border: 2px solid #d97706; border-radius: 8px; padding: 15px; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Borrador de Remisión</h1>
            <div class="meta">
                <p><span class="label">Tipo:</span> ${remisionData.tipo}</p>
                <p><span class="label">Presupuesto:</span> ${presupuesto?.numero_presupuesto || 'N/A'}</p>
                <p><span class="label">Operario:</span> ${remisionData.operario || 'No asignado'}</p>
                <p><span class="label">Fecha Entrega:</span> ${remisionData.fecha_entrega ? format(new Date(remisionData.fecha_entrega), 'dd/MM/yyyy') : 'No asignada'}</p>
            </div>
        </div>`;
    
    const productosEnRemision = remisionData.items.filter(item => item.tipo === 'producto');
    const materialesEnRemision = remisionData.items.filter(item => item.tipo === 'material');

    if (productosEnRemision.length > 0) {
        htmlContent += `<div class="section productos-section"><h3>👕 Productos Asignados</h3>`;
        productosEnRemision.forEach(productoItem => {
            htmlContent += `<div class="producto-card"><div class="producto-nombre">${productoItem.nombre || 'Producto sin nombre'}</div>`;
            (productoItem.combinaciones || []).forEach(comb => {
                htmlContent += `<div class="combinacion">`;
                const coloresNombresMap = {};
                // If colores_nombres is already saved in the combination, use it. Otherwise, look up.
                if (comb.colores_nombres && Object.keys(comb.colores_nombres).length > 0) {
                    Object.assign(coloresNombresMap, comb.colores_nombres);
                } else if (comb.colores) {
                    Object.entries(comb.colores).forEach(([seccion, colorId]) => {
                        const colorObj = colores.find(c => c.id === colorId);
                        coloresNombresMap[seccion] = colorObj ? colorObj.nombre : 'N/A';
                    });
                }
                
                if (Object.keys(coloresNombresMap).length > 0) {
                    htmlContent += `<div class="colores-info">${Object.entries(coloresNombresMap).map(([seccion, color]) => color !== 'N/A' ? `<span class="color-badge">${seccion}: ${color}</span>` : '').join('')}</div>`;
                }
                if (comb.tallas_cantidades && comb.tallas_cantidades.length > 0) {
                    htmlContent += `<div class="tallas-info">${comb.tallas_cantidades.map(tc => `<span class="talla-badge">Talla ${tc.talla || 'N/A'}: ${tc.cantidad || 0}</span>`).join('')}</div>`;
                }
                htmlContent += `</div>`;
            });
            if (productoItem.editable.observaciones && productoItem.editable.observaciones.length > 0) {
                const filteredObs = productoItem.editable.observaciones.filter(obs => obs.trim() !== '');
                if (filteredObs.length > 0) {
                    htmlContent += `<div style="margin-top: 10px; font-style: italic; color: #4a5568;"><strong>Observaciones:</strong> ${filteredObs.join(', ')}</div>`;
                }
            }
            htmlContent += `</div>`;
        });
        htmlContent += `</div>`;
    }
    
    if (materialesEnRemision.length > 0) {
        htmlContent += `<div class="section materiales-section"><h3>🧵 Materiales Requeridos</h3><table><thead><tr><th>Material</th><th>Color</th><th>Cantidad</th><th>Unidad</th><th>Observaciones</th></tr></thead><tbody>`;
        materialesEnRemision.forEach(mat => {
            const filteredObs = (mat.editable.observaciones || []).filter(obs => obs.trim() !== '');
            htmlContent += `<tr><td class="material-nombre">${mat.nombre}</td><td>${mat.color || 'N/A'}</td><td class="material-cantidad">${mat.editable.cantidad || 0}</td><td>${mat.unidad_medida || 'unidad'}</td><td>${filteredObs.join(', ') || 'N/A'}</td></tr>`;
        });
        htmlContent += `</tbody></table></div>`;
    }

    if (remisionData.observaciones) {
        const filteredRemisionObs = remisionData.observaciones.trim();
        if (filteredRemisionObs.length > 0) {
            htmlContent += `<div class="section observaciones-section"><h4>📝 Observaciones Generales</h4><p>${filteredRemisionObs}</p></div>`;
        }
    }

    htmlContent += `<div class="footer"><p><strong>ChaquetasPro</strong> - Documento generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p></div>`;
    htmlContent += `
    </body>
    </html>`;

    ventanaPDF.document.write(htmlContent);
    ventanaPDF.document.close();
    
    if (paraImprimir) {
      setTimeout(() => {
        ventanaPDF.print();
      }, 500);
    }
  };

  const guardarRemisiones = async () => {
    if (!presupuesto) {
      toast.error('Error: Presupuesto no cargado.');
      return;
    }

    setIsGenerating(true); // Show loading spinner immediately

    try {
      const promesas = [];
      const remisionesDataOriginal = await Remision.list();

      for (const [tipoKey, remisionData] of Object.entries(remisiones)) {
        const originalRemision = remisionesDataOriginal.find(r => r.id === remisionData.id);

        if (remisionData.items.length > 0) {
          const datosParaGuardar = {
            presupuesto_id: presupuesto.id,
            tipo_remision: tipoKey,
            operario_asignado: remisionData.operario,
            fecha_entrega: remisionData.fecha_entrega,
            observaciones: remisionData.observaciones,
            estado: originalRemision ? originalRemision.estado : 'pendiente',
            productos_asignados: [],
            materiales_calculados: [],
            detalles_corte: [],
          };
          
          remisionData.items.forEach(item => {
            if (item.tipo === 'producto') {
              const coloresNombresMap = {};
                if (item.combinaciones) {
                    item.combinaciones.forEach(comb => {
                        if (comb.colores) {
                            Object.entries(comb.colores).forEach(([seccion, colorId]) => {
                                const colorObj = colores.find(c => c.id === colorId);
                                if (!coloresNombresMap[comb.id]) coloresNombresMap[comb.id] = {};
                                coloresNombresMap[comb.id][seccion] = colorObj ? colorObj.nombre : 'N/A';
                            });
                        }
                    });
                }

              datosParaGuardar.productos_asignados.push({
                producto_id: item.producto_entity_id,
                producto_nombre: item.nombre,
                combinaciones: item.combinaciones.map(c => ({...c, colores_nombres: coloresNombresMap[c.id] || {}})),
                total_unidades: item.editable.cantidad,
                prioridad: 'media',
                observaciones: (item.editable.observaciones || []).filter(obs => obs.trim() !== '')
              });
            } else if (item.tipo === 'material') {
              const filteredObs = (item.editable.observaciones || []).filter(obs => obs.trim() !== '');

              const materialData = {
                  materia_prima_id: item.materia_prima_id,
                  nombre: item.nombre,
                  color: item.color,
                  cantidad_total: String(item.editable.cantidad),
                  unidad_medida: item.unidad_medida,
                  observaciones: filteredObs.join(', ')
              };
              datosParaGuardar.materiales_calculados.push(materialData);

              if (tipoKey.toLowerCase() === 'corte') { 
                datosParaGuardar.detalles_corte.push({
                  materia_prima_id: item.materia_prima_id,
                  color: item.color,
                  cantidad_total: item.editable.cantidad,
                  unidad_medida: item.unidad_medida,
                  observaciones: filteredObs
                });
              }
            }
          });

          if (remisionData.id) {
            console.log('Actualizando remisión:', remisionData.id, datosParaGuardar);
            promesas.push(Remision.update(remisionData.id, datosParaGuardar));
          } else {
            const timestamp = Date.now();
            const safeTipoKey = tipoKey.replace(/[^a-zA-Z0-9]/g, '').substring(0,4).toUpperCase();
            datosParaGuardar.numero_remision = `REM-${presupuesto.numero_presupuesto.replace('PRE-', '')}-${safeTipoKey}-${timestamp}`;
            console.log('Creando nueva remisión:', datosParaGuardar);
            promesas.push(Remision.create(datosParaGuardar));
          }
        } else if (remisionData.id && originalRemision) {
          console.log('Eliminando remisión vacía:', remisionData.id);
          promesas.push(Remision.delete(remisionData.id));
        }
      }

      if (promesas.length > 0) {
        await Promise.all(promesas);
        toast.success('Remisiones generales guardadas exitosamente.');
      } else {
        toast.info('No había remisiones generales para guardar.');
      }

      // Proceso de generación de asignaciones individuales
      if (window.confirm("¿Deseas generar las asignaciones individuales para operarios ahora? Esto usará la configuración de unidades definida en el presupuesto.")) {
        
        // --- FIX: Remove all calculation logic from this page ---
        // Just navigate to the next page. It will handle the calculation.
        const targetUrl = createPageUrl('AsignacionesIndividualesPage') + `?presupuesto=${presupuestoId}&modo=auto`;
        navigate(targetUrl);
        
      } else {
        setIsGenerating(false);
        loadData();
      }
      
    } catch (error) {
      console.error('Error guardando o generando asignaciones:', error);
      toast.error('Error en el proceso: ' + (error.message || error));
      setIsGenerating(false);
    }
  };
  
  const exportarPDF = async () => {
    try {
      const todasLasRemisiones = await Remision.list();
      const remisionesDelPresupuesto = todasLasRemisiones.filter(r => r.presupuesto_id === presupuesto.id && r.tipo_remision !== 'Asignacion_Individual');
      
      if (remisionesDelPresupuesto.length === 0) {
        alert('No hay remisiones guardadas para este presupuesto. Guarda primero algunas remisiones.');
        return;
      }

      const ventanaPDF = window.open('', '_blank');
      if (!ventanaPDF) {
        alert('No se pudo abrir la ventana para el PDF. Deshabilita el bloqueador de ventanas emergentes.');
        return;
      }

      let htmlMasivo = `
      <html>
      <head>
          <title>Reporte Completo de Remisiones - ${presupuesto.numero_presupuesto}</title>
          <style>
              @page { size: letter; margin: 0.6in; }
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #1a202c; line-height: 1.4; }
              .remision-container { page-break-after: always; }
              .remision-container:last-child { page-break-after: avoid; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2d3748; padding-bottom: 15px; margin-bottom: 25px; }
              .header h1 { font-size: 28px; margin: 0; }
              .header .meta { text-align: right; font-size: 14px; }
              .meta p { margin: 3px 0; }
              .meta .label { font-weight: bold; }
              .section { margin-bottom: 30px; }
              .section h3 { font-size: 18px; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
              .info-item { background-color: #f7fafc; padding: 12px; border-radius: 6px; border-left: 4px solid #4299e1; }
              .info-item .label { font-weight: bold; color: #4a5568; font-size: 12px; text-transform: uppercase; }
              .info-item .value { font-size: 16px; margin-top: 4px; }
              .producto-card { background-color: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
              .producto-nombre { font-size: 16px; font-weight: bold; color: #2b6cb0; margin-bottom: 10px; }
              .combinacion { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
              .combinacion:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
              .colores-info, .tallas-info { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
              .color-badge { background-color: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
              .talla-badge { background-color: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
              .materiales-section table { width: 100%; border-collapse: collapse; background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; overflow: hidden; }
              .materiales-section th { background-color: #f59e0b; color: white; padding: 12px; font-weight: bold; text-align: left; }
              .materiales-section td { padding: 10px 12px; border-bottom: 1px solid #fde68a; }
              .materiales-section tr:last-child td { border-bottom: none; }
              .material-nombre { font-weight: 600; color: #92400e; }
              .material-cantidad { font-weight: bold; text-align: right; color: #92400e; }
              .observaciones-section { background-color: #fef3c7; border: 2px solid #d97706; border-radius: 8px; padding: 15px; }
              .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #e2e8f0; padding-top: 20px; }
              @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
      </head>
      <body>`;

      remisionesDelPresupuesto.forEach((remision, index) => {
        const totalUnidadesRemision = (remision.productos_asignados || []).reduce((sum, p) => sum + (p.total_unidades || 0), 0);

        htmlMasivo += `<div class="remision-container">`;
        htmlMasivo += `
          <div class="header">
              <h1>Remisión de Producción</h1>
              <div class="meta">
                  <p><span class="label">Número:</span> ${remision.numero_remision || 'N/A'}</p>
                  <p><span class="label">Tipo:</span> ${(remision.tipo_remision || '').replace(/_/g, ' ')}</p>
                  <p><span class="label">Estado:</span> ${(remision.estado || '').replace('_', ' ')}</p>
                  <p><span class="label">Fecha:</span> ${format(new Date(), 'dd/MM/yyyy')}</p>
              </div>
          </div>
          <div class="info-grid">
              ${remision.operario_asignado ? `<div class="info-item"><div class="label">Operario Asignado</div><div class="value">${remision.operario_asignado}</div></div>` : ''}
              ${remision.fecha_entrega ? `<div class="info-item"><div class="label">Fecha de Entrega</div><div class="value">${format(new Date(remision.fecha_entrega), 'dd/MM/yyyy')}</div></div>` : ''}
              <div class="info-item"><div class="label">Total de Unidades</div><div class="value">${totalUnidadesRemision}</div></div>
              ${remision.subtipo_corte ? `<div class="info-item"><div class="label">Material de Corte</div><div class="value">${remision.subtipo_corte}</div></div>` : ''}
          </div>
        `;

        if (remision.productos_asignados && remision.productos_asignados.length > 0) {
          htmlMasivo += `<div class="section productos-section"><h3>👕 Productos Asignados</h3>`;
          remision.productos_asignados.forEach(producto => {
              htmlMasivo += `<div class="producto-card"><div class="producto-nombre">${producto.producto_nombre || 'Producto sin nombre'}</div>`;
              (producto.combinaciones || []).forEach(comb => {
                  htmlMasivo += `<div class="combinacion">`;
                  if (comb.colores_nombres && Object.keys(comb.colores_nombres).length > 0) {
                      htmlMasivo += `<div class="colores-info">${Object.entries(comb.colores_nombres).map(([seccion, color]) => color && color !== 'N/A' ? `<span class="color-badge">${seccion}: ${color}</span>` : '').join('')}</div>`;
                  }
                  if (comb.tallas_cantidades && comb.tallas_cantidades.length > 0) {
                      htmlMasivo += `<div class="tallas-info">${comb.tallas_cantidades.map(tc => `<span class="talla-badge">Talla ${tc.talla || 'N/A'}: ${tc.cantidad || 0}</span>`).join('')}</div>`;
                  }
                  htmlMasivo += `</div>`;
              });
              if (producto.observaciones && producto.observaciones.length > 0) {
                  const filteredObs = producto.observaciones.filter(obs => obs.trim() !== '');
                  if (filteredObs.length > 0) {
                    htmlMasivo += `<div style="margin-top: 10px; font-style: italic; color: #4a5568;"><strong>Observaciones:</strong> ${filteredObs.join(', ')}</div>`;
                  }
              }
              htmlMasivo += `</div>`;
          });
          htmlMasivo += `</div>`;
        }
        
        if ((remision.materiales_calculados && remision.materiales_calculados.length > 0) || (remision.detalles_corte && remision.detalles_corte.length > 0)) {
          htmlMasivo += `<div class="section materiales-section"><h3>🧵 Materiales / Detalles de Corte</h3><table><thead><tr><th>Material/Color</th><th>Cantidad</th><th>Unidad</th><th>Observaciones</th></tr></thead><tbody>`;
          
          (remision.materiales_calculados || []).forEach(mat => {
              htmlMasivo += `<tr><td class="material-nombre">${mat.nombre} (${mat.color || 'N/A'})</td><td class="material-cantidad">${mat.cantidad_total || 0}</td><td>${mat.unidad_medida || 'unidad'}</td><td>${mat.observaciones || ''}</td></tr>`;
          });
          
          (remision.detalles_corte || []).forEach(det => {
              htmlMasivo += `<tr><td class="material-nombre">${det.color}</td><td class="material-cantidad">${det.cantidad_total || 0}</td><td>${det.unidad_medida || 'unidad'}</td><td>${(det.observaciones || []).filter(obs => obs.trim() !== '').join(', ')}</td></tr>`;
          });
          htmlMasivo += `</tbody></table></div>`;
        }

        if (remision.observaciones) {
            const filteredRemisionObs = remision.observaciones.trim();
            if (filteredRemisionObs.length > 0) {
                htmlMasivo += `<div class="section observaciones-section"><h4>📝 Observaciones Generales</h4><p>${filteredRemisionObs}</p></div>`;
            }
        }

        htmlMasivo += `<div class="footer"><p><strong>ChaquetasPro</strong> - Documento generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p></div>`;
        htmlMasivo += `</div>`; // Cierre de .remision-container
      });

      htmlMasivo += `
      </body>
      </html>`;

      ventanaPDF.document.write(htmlMasivo);
      ventanaPDF.document.close();
      
      setTimeout(() => {
        ventanaPDF.print();
      }, 500);

    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el PDF: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando planificador de remisiones...</p>
          <p className="text-sm text-slate-500 mt-2">
            {modoEdicion ? `Remisión ID: ${remisionId}` : `Presupuesto ID: ${presupuestoId}`}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6 text-center">
            <h3 className="text-red-800 font-semibold mb-2">Error</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={loadData} variant="outline">
                Reintentar
              </Button>
              <Link to={createPageUrl('Presupuestos')}>
                <Button variant="outline">
                  Volver a Presupuestos
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!presupuesto) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p>Presupuesto no encontrado.</p>
          <Link to={createPageUrl('Presupuestos')}>
            <Button>Volver a Presupuestos</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Presupuestos')}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              Planificador de Producción
            </h1>
            <p className="text-slate-600">
              {`Presupuesto: ${presupuesto?.numero_presupuesto} - ${presupuesto?.cliente}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportarPDF} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button onClick={guardarRemisiones} disabled={isGenerating}>
             {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar y Continuar
          </Button>
        </div>
      </div>

      {isGenerating && (
          <div className="fixed inset-0 bg-white/80 z-50 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
            <p className="mt-4 text-lg font-medium text-slate-700">Generando asignaciones automáticas...</p>
          </div>
        )}

      {/* Main Content */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
          {/* Panel Izquierdo - Información del Presupuesto */}
          <div className="col-span-4 space-y-4 overflow-y-auto">
            {/* Productos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Productos del Presupuesto</CardTitle>
              </CardHeader>
              <CardContent>
                <Droppable droppableId="presupuesto-productos" isDropDisabled={false}>
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 p-2 min-h-[50px] border border-dashed rounded-lg bg-slate-50">
                      {(presupuesto.productos || []).map((producto, index) => {
                        const productoInfo = productos.find(p => p.id === producto.producto_id);
                        const totalUnidades = producto.combinaciones?.reduce((acc, comb) => 
                          acc + (comb.tallas_cantidades?.reduce((sum, tc) => sum + tc.cantidad, 0) || 0), 0
                        ) || 0;

                        return (
                          <Draggable key={producto.id} draggableId={producto.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-grab ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                              >
                                <div className="flex items-center gap-2">
                                  <GripVertical className="w-4 h-4 text-slate-400" />
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{productoInfo?.nombre}</p>
                                    <p className="text-xs text-slate-600">{totalUnidades} unidades</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      {(presupuesto.productos || []).length === 0 && (
                        <p className="text-center text-slate-400 text-sm py-2">
                          No hay productos en el presupuesto.
                        </p>
                      )}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            </Card>

            {/* Materiales */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Materiales del Presupuesto</CardTitle>
              </CardHeader>
              <CardContent>
                <Droppable droppableId="presupuesto-materiales" isDropDisabled={false}>
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 p-2 min-h-[50px] border border-dashed rounded-lg bg-slate-50">
                      {(presupuesto.materiales_calculados || []).map((material, index) => {
                        const draggableId = `${material.materia_prima_id}_${material.color}`;
                        return (
                          <Draggable key={draggableId} draggableId={draggableId} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 bg-green-50 border border-green-200 rounded-lg cursor-grab ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                              >
                                <div className="flex items-center gap-2">
                                  <GripVertical className="w-4 h-4 text-slate-400" />
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{material.nombre}</p>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {material.color}
                                      </Badge>
                                      <span className="text-xs text-slate-600">
                                        {material.cantidad_total} {material.unidad_medida}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      {(presupuesto.materiales_calculados || []).length === 0 && (
                        <p className="text-center text-slate-400 text-sm py-2">
                          No hay materiales en el presupuesto.
                        </p>
                      )}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            </Card>
          </div>

          {/* Panel Derecho - Remisiones */}
          <div className="col-span-8 overflow-x-auto">
            <div className="flex gap-4 h-full" style={{ minWidth: `${operaciones.length * 320}px` }}>
              {operaciones.map((operacion) => {
                const tipoKey = operacion.nombre.replace(/\s/g, '_');
                const remisionData = remisiones[tipoKey] || { id: null, tipo: operacion.nombre, items: [], operario: '', fecha_entrega: '', observaciones: '' };
                
                return (
                  <div key={tipoKey} className="flex-shrink-0 w-80">
                    <Card className="h-full flex flex-col">
                      <CardHeader className="pb-3 bg-slate-100">
                        <div className="flex justify-between items-center mb-2">
                           <CardTitle className="text-lg">{operacion.nombre}</CardTitle>
                           <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => generarPDFDesdeBorrador(remisionData, false)}
                                className="hover:bg-green-50 hover:text-green-600 transition-colors h-8 w-8"
                                title="Descargar PDF borrador"
                                disabled={remisionData.items.length === 0}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => generarPDFDesdeBorrador(remisionData, true)}
                                className="hover:bg-purple-50 hover:text-purple-600 transition-colors h-8 w-8"
                                title="Imprimir borrador"
                                disabled={remisionData.items.length === 0}
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                           </div>
                        </div>
                        <div className="space-y-2">
                          <Input
                            placeholder="Operario asignado"
                            value={remisionData.operario}
                            onChange={(e) => actualizarRemision(tipoKey, 'operario', e.target.value)}
                            className="h-8"
                          />
                          <Input
                            type="date"
                            value={remisionData.fecha_entrega}
                            onChange={(e) => actualizarRemision(tipoKey, 'fecha_entrega', e.target.value)}
                            className="h-8"
                          />
                           <Input
                            placeholder="Observaciones de la remisión"
                            value={remisionData.observaciones}
                            onChange={(e) => actualizarRemision(tipoKey, 'observaciones', e.target.value)}
                            className="h-8"
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 p-3">
                        <Droppable droppableId={tipoKey}>
                          {(provided, snapshot) => (
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className={`h-full min-h-32 p-2 border-2 border-dashed rounded-lg transition-colors ${
                                snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                              }`}
                            >
                              <div className="space-y-2">
                                {remisionData.items.map((item, index) => (
                                  <Draggable key={item.id} draggableId={item.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`p-3 bg-white border rounded-lg shadow-sm cursor-grab ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                      >
                                        <div className="flex items-center gap-2 mb-3">
                                          <GripVertical className="w-4 h-4 text-slate-400" />
                                          <div className="flex-1">
                                            <p className="font-medium text-sm">{item.nombre}</p>
                                            {item.color && (
                                              <Badge variant="outline" className="text-xs mt-1">
                                                {item.color}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* Campo cantidad */}
                                        <div className="mb-3">
                                          <Input
                                            placeholder="Cantidad"
                                            type="number"
                                            value={item.editable.cantidad}
                                            onChange={(e) => actualizarItem(tipoKey, index, 'cantidad', parseFloat(e.target.value) || 0)}
                                            className="h-7 text-xs"
                                          />
                                        </div>

                                        {/* Lista de observaciones */}
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-slate-600">
                                              Observaciones:
                                            </label>
                                            <Button
                                                              type="button"
                                                              variant="ghost"
                                                              size="icon"
                                                              onClick={() => agregarObservacion(tipoKey, index)}
                                                              className="h-6 w-6 text-blue-600 hover:bg-blue-50"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </Button>
                                          </div>
                                          
                                          {(item.editable.observaciones || []).map((obs, obsIndex) => (
                                            <div key={obsIndex} className="flex gap-1">
                                              <Input
                                                placeholder={`Observación ${obsIndex + 1}`}
                                                value={obs}
                                                onChange={(e) => actualizarObservacion(tipoKey, index, obsIndex, e.target.value)}
                                                className="h-6 text-xs flex-1"
                                              />
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => eliminarObservacion(tipoKey, index, obsIndex)}
                                                className="h-6 w-6 text-red-500 hover:bg-red-50"
                                              >
                                                <X className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          ))}
                                          
                                          {(!item.editable.observaciones || item.editable.observaciones.length === 0) && (
                                            <p className="text-xs text-slate-400 text-center py-2">
                                              Sin observaciones
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                                {remisionData.items.length === 0 && (
                                  <p className="text-center text-slate-400 text-sm mt-8">
                                    Arrastra elementos aquí
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </Droppable>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
