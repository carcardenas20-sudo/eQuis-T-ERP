
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Presupuesto, Producto, MateriaPrima, Color, Remision } from "@/api/entitiesChaquetas";
import AsignacionesIndividuales from "@/components/remisiones/AsignacionesIndividuales";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

// Función para generar IDs únicos sin uuid
const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export default function AsignacionesIndividualesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const presupuestoId = searchParams.get('presupuesto');
  const modo = searchParams.get('modo'); // 'manual' o 'auto'

  const [presupuesto, setPresupuesto] = useState(null);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [colores, setColores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [operariosPrecargados, setOperariosPrecargados] = useState(null);

  useEffect(() => {
    const loadAndProcess = async () => {
      if (!presupuestoId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [presupuestosData, productosData, materiasPrimasData, coloresData] = await Promise.all([
          Presupuesto.list(),
          Producto.list(),
          MateriaPrima.list(),
          Color.list()
        ]);

        const presuActual = presupuestosData.find(p => p.id === presupuestoId);
        setPresupuesto(presuActual);
        setProductos(productosData);
        setMateriasPrimas(materiasPrimasData);
        setColores(coloresData);

        if (modo === 'auto' && presuActual) {
          setIsCalculating(true);
          // Run calculation asynchronously to avoid blocking UI
          setTimeout(() => runAutoCalculation(presuActual, productosData), 0);
        } else {
          // modo manual o sin presupuesto, inicializar con un operario vacío para empezar
          setOperariosPrecargados({ 'operario_1': { nombre: '', items: [] } });
        }

      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Error al cargar los datos para las asignaciones.");
      } finally {
        setIsLoading(false);
      }
    };

    loadAndProcess();
  }, [presupuestoId, modo]);

  const runAutoCalculation = (presupuestoData, productosData) => {
    const opPrecargados = {};
    let operarioCount = 1;

    (presupuestoData?.productos || []).forEach(productoItem => {
      const unidadesPorOperario = productoItem.unidades_por_asignacion;
      const productoInfo = productosData.find(p => p.id === productoItem.producto_id);
      
      (productoItem.combinaciones || []).forEach((combinacion) => { 
        (combinacion.tallas_cantidades || []).forEach(talla => {
          if (talla.cantidad > 0 && typeof unidadesPorOperario === 'number' && unidadesPorOperario > 0) {
            const numOperarios = Math.ceil(talla.cantidad / unidadesPorOperario);
            const unidadesPorOpNormal = Math.floor(talla.cantidad / numOperarios);
            let udsExtra = talla.cantidad % numOperarios;

            for (let i = 0; i < numOperarios; i++) {
              const unidadesAsignadas = unidadesPorOpNormal + (udsExtra > 0 ? 1 : 0);
              udsExtra--;

              const opId = `operario_${operarioCount}`;
              const item = {
                id: generateId(),
                producto_original_id: `${productoItem.id}_${combinacion.id}`, // Identificador único para el item de presupuesto/combinación
                producto_entity_id: productoItem.producto_id,
                nombre: productoInfo?.nombre || 'Producto',
                combinacion: combinacion,
                colores_combinacion: Object.entries(combinacion.colores || {}),
                editable: {
                  tallas: [{ talla: talla.talla, cantidad: unidadesAsignadas }],
                  observaciones: []
                },
                materiales_calculados: []
              };

              if (!opPrecargados[opId]) {
                opPrecargados[opId] = { nombre: `Operario ${operarioCount}`, items: [] };
              }
              opPrecargados[opId].items.push(item);
              operarioCount++;
            }
          }
        });
      });
    });

    setOperariosPrecargados(opPrecargados);
    setIsCalculating(false);
    if (Object.keys(opPrecargados).length > 0) {
      toast.success("Asignaciones automáticas generadas con éxito.");
    } else {
      toast.info("No se pudieron generar asignaciones automáticas con los datos proporcionados.");
    }
  }

  const handleGuardar = async (remisionesFinales) => {
    if (!presupuesto) {
        toast.error("No se puede guardar, falta información del presupuesto.");
        return;
    }
    try {
      const promesas = [];

      for (const remisionData of remisionesFinales) {
        const timestamp = Date.now();
        // Asegurar que operario_asignado no sea null o undefined antes de usarlo
        const operarioSafe = (remisionData.operario_asignado || 'OP').replace(/\s/g, '').substring(0, 5).toUpperCase();
        remisionData.numero_remision = `REM-${presupuesto.numero_presupuesto.replace('PRE-', '')}-I-${operarioSafe}-${timestamp}`;
        remisionData.presupuesto_id = presupuesto.id; // Asegurar que el ID del presupuesto está
        promesas.push(Remision.create(remisionData));
      }

      await Promise.all(promesas);
      toast.success(`${remisionesFinales.length} remisiones individuales guardadas con éxito.`);
      navigate(createPageUrl('Remisiones'));
      
    } catch (error) {
      console.error('Error al guardar las remisiones individuales:', error);
      toast.error('Hubo un error al guardar: ' + error.message);
      // It's generally good practice to re-throw if you want upstream error handling,
      // but in a UI context, just displaying a toast is often sufficient.
      // If this error should propagate to a parent error boundary, then re-throw.
      // throw error; 
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
        <p className="text-lg font-medium text-slate-700">Cargando datos del presupuesto...</p>
      </div>
    );
  }
  
  if (isCalculating) {
     return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-screen">
        <Sparkles className="w-12 h-12 animate-pulse text-purple-600 mb-4" />
        <p className="text-lg font-medium text-slate-700">Generando asignaciones automáticas...</p>
        <p className="text-sm text-slate-500">Esto puede tardar unos segundos.</p>
      </div>
    );
  }

  if (!presupuesto) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4">No se encontró el presupuesto especificado.</p>
        <Link to={createPageUrl('Presupuestos')}>
          <Button variant="outline">Volver a Presupuestos</Button>
        </Link>
      </div>
    );
  }

  return (
    <AsignacionesIndividuales
      presupuesto={presupuesto}
      productos={productos}
      materiasPrimas={materiasPrimas}
      colores={colores}
      operariosPrecargados={operariosPrecargados}
      onGuardar={handleGuardar}
      onCancelar={() => navigate(createPageUrl('PlanificacionRemisiones') + `?presupuesto=${presupuestoId}`)}
    />
  );
}
