
import React, { useState, useEffect } from "react";
import { Presupuesto, Producto, MateriaPrima, Color, Remision, Operacion } from "@/api/entitiesChaquetas";
import { Inventory, StockMovement, AccountPayable } from "@/entities/all";
import { base44 } from "@/api/base44Combined";
const TareaPlanta = base44.entities.TareaPlanta;
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calculator, Lightbulb, ChevronDown, ChevronUp, Layers } from "lucide-react";
import _ from 'lodash';

import FormularioPresupuesto from "../components/presupuestos/FormularioPresupuesto";
import TarjetaPresupuesto from "../components/presupuestos/TarjetaPresupuesto";
import ModalTendido from "../components/presupuestos/ModalTendido";

export default function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [filteredPresupuestos, setFilteredPresupuestos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [colores, setColores] = useState([]);
  const [operaciones, setOperaciones] = useState([]); // Estado para operaciones
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPresupuesto, setEditingPresupuesto] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
const [showSugerencias, setShowSugerencias] = useState(false);
  const [showTendido, setShowTendido] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Debounce search term to improve performance
    const handler = setTimeout(() => {
      let filtered = presupuestos;

      if (searchTerm) {
        filtered = filtered.filter(p =>
          p.numero_presupuesto.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setFilteredPresupuestos(filtered);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, presupuestos]);

  const loadData = async () => {
    setIsLoading(true);
    const [presupuestosData, productosData, materiasData, coloresData, operacionesData] = await Promise.all([
      Presupuesto.list("-created_date"),
      Producto.list(),
      MateriaPrima.list(),
      Color.list(),
      Operacion.list() // Cargar operaciones
    ]);
    setPresupuestos(presupuestosData);
    setProductos(productosData);
    setMateriasPrimas(materiasData);
    setColores(coloresData);
    setOperaciones(operacionesData); // Guardar operaciones
    setIsLoading(false);
  };

  const handleSubmit = async (data) => {
    try {
      const wasApproved = editingPresupuesto?.id && editingPresupuesto.estado !== 'aprobado' && data.estado === 'aprobado';
      const isNewApproved = !editingPresupuesto?.id && data.estado === 'aprobado';
      const isEditingApproved = editingPresupuesto?.id && editingPresupuesto.estado === 'aprobado' && data.estado === 'aprobado';

      let presupuestoActualizado;
      if (editingPresupuesto?.id) {
        presupuestoActualizado = await Presupuesto.update(editingPresupuesto.id, data);
      } else {
        presupuestoActualizado = await Presupuesto.create(data);
      }

      // Al aprobar: crear stock en inventario de operarios por cada producto
      if (wasApproved || isNewApproved) {
        try {
          const [inventoryItems, allSM] = await Promise.all([Inventory.list(), StockMovement.list()]);
          const presNum = data.numero_presupuesto || presupuestoActualizado.numero_presupuesto || '';
          const today = new Date().toISOString().split('T')[0];

          for (const productoItem of (data.productos || [])) {
            const producto = productos.find(p => p.id === productoItem.producto_id);
            if (!producto || !producto.reference) continue;

            const totalUnidades = (productoItem.combinaciones || []).reduce((sum, comb) =>
              sum + (comb.tallas_cantidades || []).reduce((s, tc) => s + (tc.cantidad || 0), 0), 0);
            if (totalUnidades <= 0) continue;

            // Idempotencia: no duplicar si ya existe SM para este presupuesto + referencia
            const yaExiste = (allSM || []).some(sm =>
              sm.product_reference === producto.reference &&
              sm.reason === `Presupuesto aprobado ${presNum}`
            );
            if (yaExiste) continue;

            const existing = (inventoryItems || []).find(inv => inv.product_reference === producto.reference);
            const prevStock = existing ? (Number(existing.current_stock) || 0) : 0;
            const newStock = prevStock + totalUnidades;

            await StockMovement.create({
              product_reference: producto.reference,
              movement_type: "entrada",
              quantity: totalUnidades,
              movement_date: today,
              reason: `Presupuesto aprobado ${presNum}`,
              previous_stock: prevStock,
              new_stock: newStock,
            });

            if (existing) {
              await Inventory.update(existing.id, { current_stock: newStock });
            } else {
              await Inventory.create({
                product_reference: producto.reference,
                current_stock: newStock,
                min_stock: 0,
              });
            }
          }
        } catch (err) {
          console.error("Error creando stock al aprobar presupuesto:", err);
        }
      }

      // Edición de presupuesto ya aprobado: registrar delta si cambiaron cantidades
      if (isEditingApproved) {
        try {
          const [inventoryItems, allSM] = await Promise.all([Inventory.list(), StockMovement.list()]);
          const presNum = data.numero_presupuesto || presupuestoActualizado.numero_presupuesto || '';
          const today = new Date().toISOString().split('T')[0];

          for (const productoItem of (data.productos || [])) {
            const producto = productos.find(p => p.id === productoItem.producto_id);
            if (!producto || !producto.reference) continue;

            const totalNuevo = (productoItem.combinaciones || []).reduce((sum, comb) =>
              sum + (comb.tallas_cantidades || []).reduce((s, tc) => s + (tc.cantidad || 0), 0), 0);

            // Cuánto se registró en SM para este presupuesto + referencia
            const smExistente = (allSM || [])
              .filter(sm => sm.product_reference === producto.reference && sm.reason === `Presupuesto aprobado ${presNum}`)
              .reduce((s, sm) => s + (Number(sm.quantity) || 0), 0);

            const delta = totalNuevo - smExistente;
            if (delta === 0) continue;

            const existing = (inventoryItems || []).find(inv => inv.product_reference === producto.reference);
            const prevStock = existing ? (Number(existing.current_stock) || 0) : 0;
            const newStock = Math.max(0, prevStock + delta);

            await StockMovement.create({
              product_reference: producto.reference,
              movement_type: delta > 0 ? "entrada" : "salida",
              quantity: Math.abs(delta),
              movement_date: today,
              reason: `Ajuste presupuesto ${presNum} (edición: ${smExistente} → ${totalNuevo})`,
              previous_stock: prevStock,
              new_stock: newStock,
            });

            if (existing) {
              await Inventory.update(existing.id, { current_stock: newStock });
            }
          }
        } catch (err) {
          console.error("Error registrando delta de edición de presupuesto:", err);
        }
      }

      // Al aprobar: crear remisión de tendido para el portal de planta
      if (wasApproved || isNewApproved) {
        try {
          const tendidoData = {
            tipo_remision: 'tendido',
            presupuesto_id: presupuestoActualizado.id,
            presupuesto_numero: data.numero_presupuesto || presupuestoActualizado.numero_presupuesto || '',
            estado: 'pendiente',
          };
          if (data.tendido_config) {
            tendidoData.filas = data.tendido_config.filas;
            tendidoData.colores_tendido = data.tendido_config.colores;
          }
          await Remision.create(tendidoData);
        } catch (err) {
          console.error("Error creando remisión de tendido:", err);
        }
      }

      // Al aprobar: crear tareas de planta por combinación × operación requerida
      if (wasApproved || isNewApproved) {
        try {
          const presNumero = data.numero_presupuesto || presupuestoActualizado.numero_presupuesto;
          // Evitar duplicados si ya existen tareas para este presupuesto
          const existentes = await TareaPlanta.filter({ presupuesto_id: presupuestoActualizado.id });
          if (!existentes || existentes.length === 0) {
            for (const productoItem of (data.productos || [])) {
              const producto = productos.find(p => p.id === productoItem.producto_id);
              if (!producto) continue;
              const ops = producto.operaciones_requeridas || [];
              if (ops.length === 0) continue;
              const combinaciones = productoItem.combinaciones || [];
              for (const comb of combinaciones) {
                const totalUds = (comb.tallas_cantidades || []).reduce((s, tc) => s + (Number(tc.cantidad) || 0), 0);
                if (totalUds <= 0) continue;
                for (const opId of ops) {
                  await TareaPlanta.create({
                    presupuesto_id: presupuestoActualizado.id,
                    presupuesto_numero: presNumero,
                    operacion_id: opId,
                    producto_nombre: producto.nombre,
                    combinacion_nombre: comb.nombre || comb.combinacion_nombre || "",
                    tallas_cantidades: comb.tallas_cantidades || [],
                    total_unidades: totalUds,
                    materiales: (data.materiales_calculados || []),
                    estado: "pendiente",
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error("Error creando tareas de planta:", err);
        }
      }

      // Al aprobar: crear cuenta por pagar para ojaletear externo (idempotente)
      if (wasApproved || isNewApproved) {
        try {
          const presNum = data.numero_presupuesto || presupuestoActualizado.numero_presupuesto || '';
          const PROVEEDOR_OJALETEAR = '0c2eaa41-083c-4156-8ec2-73a2f01954f4'; // Claudia Montoya

          for (const productoItem of (data.productos || [])) {
            const oj = productoItem.ojaletear;
            if (!oj || oj.tipo !== 'externo') continue;

            const totalUds = (productoItem.combinaciones || []).reduce((s, c) =>
              s + (c.tallas_cantidades || []).reduce((ss, tc) => ss + (Number(tc.cantidad) || 0), 0), 0);
            if (totalUds <= 0) continue;

            const precioUnit = Number(oj.precio_unit) || 80;
            const total = totalUds * precioUnit;

            // Idempotencia: no duplicar si ya existe para este presupuesto
            const existentes = await AccountPayable.filter({ supplier_id: PROVEEDOR_OJALETEAR });
            const yaExiste = (existentes || []).some(ap => ap.data?.presupuesto_id === presupuestoActualizado.id);
            if (yaExiste) continue;

            await AccountPayable.create({
              supplier_id: PROVEEDOR_OJALETEAR,
              supplier_name: 'Claudia Montoya',
              description: `Ojaletear ${totalUds} uds — ${presNum}`,
              type: 'servicio_ojaletear',
              category: 'otros',
              status: 'pending',
              total_amount: total,
              pending_amount: total,
              paid_amount: 0,
              data: {
                presupuesto_id: presupuestoActualizado.id,
                presupuesto_numero: presNum,
                cantidad: totalUds,
                precio_unit: precioUnit,
              },
            });
          }
        } catch (err) {
          console.error("Error creando cuenta por pagar ojaletear:", err);
        }
      }

      setShowForm(false);
      setEditingPresupuesto(null);
      loadData();
    } catch (err) {
      alert('Error al guardar el presupuesto: ' + err.message);
    }
  };

  const handleEdit = (presupuesto) => {
    setEditingPresupuesto(presupuesto);
    setShowForm(true);
  };

  const handleCopy = (presupuestoOriginal) => {
    const presupuestoCopia = {
      ..._.cloneDeep(presupuestoOriginal), // Deep clone to avoid modifying original nested objects
      id: undefined, // Remove ID so it's treated as a new record
      numero_presupuesto: `${presupuestoOriginal.numero_presupuesto.split(' - Copia')[0]} - Copia`, // Append ' - Copia'
      estado: 'borrador', // Reset status to draft
      cliente: "", // Clear client to avoid confusion
      created_date: undefined, // Clear dates to reflect new creation
      updated_date: undefined,
    };

    setEditingPresupuesto(presupuestoCopia);
    setShowForm(true);
  };

  const handleGenerarDesdeTendido = (productosGenerados, tendidoConfig) => {
    const numero = `PRES-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
    setEditingPresupuesto({
      numero_presupuesto: numero,
      cliente: '',
      fecha_entrega: '',
      estado: 'borrador',
      observaciones: '',
      productos: productosGenerados,
      materiales_calculados: [],
      materiales_ocultos: [],
      margen_ganancia: 30,
      total_materiales: 0,
      total_mano_obra: 0,
      total_general: 0,
      tendido_config: tendidoConfig || null,
    });
    setShowTendido(false);
    setShowForm(true);
  };

  const handleDelete = async (presupuestoId) => {
    try {
      await Presupuesto.delete(presupuestoId);
      loadData();
    } catch (error) {
      alert('Error al eliminar el presupuesto');
    }
  };

  const getStatusColor = (estado) => {
    const colors = {
      borrador: 'bg-slate-100 text-slate-700',
      enviado: 'bg-blue-100 text-blue-700',
      aprobado: 'bg-green-100 text-green-700',
      rechazado: 'bg-red-100 text-red-700'
    };
    return colors[estado] || colors.borrador;
  };

  return (
    <div className="p-3 sm:p-8 space-y-4 sm:space-y-8 bg-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-2">Presupuestos</h1>
            <p className="text-slate-600 text-sm sm:text-lg">Crea y gestiona presupuestos detallados de fabricación</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowTendido(true)}
              className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              <Layers className="w-4 h-4" />
              Desde Tendido
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-medium px-6 py-3 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Presupuesto
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card className="bg-white border-slate-200 mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por número de presupuesto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-slate-200 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Modal asistente de tendido */}
        {showTendido && (
          <ModalTendido
            productos={productos}
            colores={colores}
            materiasPrimas={materiasPrimas}
            onGenerate={handleGenerarDesdeTendido}
            onCancel={() => setShowTendido(false)}
          />
        )}

        {/* Form Modal Presupuesto */}
        {showForm && (
          <FormularioPresupuesto
            presupuesto={editingPresupuesto}
            productos={productos}
            materiasPrimas={materiasPrimas}
            colores={colores}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingPresupuesto(null);
            }}
          />
        )}

        {/* Historial de referencias y tallas */}
        {(() => {
          // producto_id → { tallas: Set, ultimoPresupuesto: string }
          const historial = {};
          presupuestos.forEach(p => {
            (p.productos || []).forEach(item => {
              if (!item.producto_id) return;
              if (!historial[item.producto_id]) {
                historial[item.producto_id] = { tallas: new Set(), ultimoPresupuesto: p.numero_presupuesto, ultimaFecha: p.created_date };
              }
              (item.combinaciones || []).forEach(combo => {
                (combo.tallas_cantidades || []).filter(tc => Number(tc.cantidad) > 0).forEach(tc => {
                  historial[item.producto_id].tallas.add(tc.talla);
                });
              });
            });
          });

          // Ordenar según aparición en presupuestos (ya vienen por -created_date)
          const orden = [];
          const visto = new Set();
          presupuestos.forEach(p => {
            (p.productos || []).forEach(item => {
              if (item.producto_id && !visto.has(item.producto_id)) {
                visto.add(item.producto_id);
                orden.push(item.producto_id);
              }
            });
          });

          const lista = orden
            .map(prodId => {
              const prod = productos.find(pr => pr.id === prodId);
              const data = historial[prodId];
              if (!prod || !data) return null;
              const fecha = data.ultimaFecha ? new Date(data.ultimaFecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
              return { prod, tallas: [...data.tallas].sort(), ultimoPresupuesto: data.ultimoPresupuesto, fecha };
            })
            .filter(Boolean);

          if (lista.length === 0) return null;

          return (
            <Card className="bg-white border-amber-200 mb-6">
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
                onClick={() => setShowSugerencias(v => !v)}
              >
                <div className="flex items-center gap-2 text-amber-700 font-semibold">
                  <Lightbulb className="w-4 h-4" />
                  Referencias y tallas recientes
                  <span className="text-xs font-normal text-amber-500">{lista.length} productos</span>
                </div>
                {showSugerencias ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronDown className="w-4 h-4 text-amber-500" />}
              </div>
              {showSugerencias && (
                <CardContent className="pt-0 pb-3">
                  <div className="divide-y divide-slate-100">
                    {lista.map(({ prod, tallas, ultimoPresupuesto, fecha }) => (
                      <div key={prod.id} className="py-2.5 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold text-slate-800">{prod.nombre}</span>
                          {prod.reference && <span className="ml-2 text-xs font-mono text-slate-400">Ref. {prod.reference}</span>}
                          <span className="ml-2 text-xs text-slate-400">· {ultimoPresupuesto}</span>
                          {fecha && <span className="ml-1 text-xs text-slate-400">({fecha})</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {tallas.map(t => (
                            <span key={t} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{t}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })()}

        {/* Presupuestos Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="bg-white animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredPresupuestos.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calculator className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No se encontraron presupuestos
              </h3>
              <p className="text-slate-500 mb-6">
                {searchTerm
                  ? "Intenta ajustar tu búsqueda"
                  : "Comienza creando tu primer presupuesto"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primer Presupuesto
                </Button>
              )}
            </div>
          ) : (
            filteredPresupuestos.map((presupuesto) => (
              <TarjetaPresupuesto
                key={presupuesto.id}
                presupuesto={presupuesto}
                productos={productos}
                onEdit={() => handleEdit(presupuesto)}
                onCopy={() => handleCopy(presupuesto)}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
