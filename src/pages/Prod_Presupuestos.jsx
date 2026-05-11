
import React, { useState, useEffect } from "react";
import { Presupuesto, Producto, MateriaPrima, Color, Remision, Operacion } from "@/api/entitiesChaquetas";
import { Inventory, StockMovement } from "@/entities/all";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calculator, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import _ from 'lodash';

import FormularioPresupuesto from "../components/presupuestos/FormularioPresupuesto";
import TarjetaPresupuesto from "../components/presupuestos/TarjetaPresupuesto";
import AsignacionesIndividuales from "../components/remisiones/AsignacionesIndividuales"; // Importar nuevo componente

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
  const [showAsignaciones, setShowAsignaciones] = useState(false);
  const [presupuestoParaAsignar, setPresupuestoParaAsignar] = useState(null);
  const [showSugerencias, setShowSugerencias] = useState(false);

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

      let presupuestoActualizado;
      if (editingPresupuesto?.id) {
        presupuestoActualizado = await Presupuesto.update(editingPresupuesto.id, data);
      } else {
        presupuestoActualizado = await Presupuesto.create(data);
      }

      // Al aprobar: crear stock en inventario de operarios por cada producto
      if (wasApproved || isNewApproved) {
        try {
          const inventoryItems = await Inventory.list();
          const presNum = data.numero_presupuesto || presupuestoActualizado.numero_presupuesto || '';
          const today = new Date().toISOString().split('T')[0];

          for (const productoItem of (data.productos || [])) {
            const producto = productos.find(p => p.id === productoItem.producto_id);
            if (!producto || !producto.reference) continue;

            const totalUnidades = (productoItem.combinaciones || []).reduce((sum, comb) =>
              sum + (comb.tallas_cantidades || []).reduce((s, tc) => s + (tc.cantidad || 0), 0), 0);
            if (totalUnidades <= 0) continue;

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

      setShowForm(false);
      setEditingPresupuesto(null);
      loadData();
    } catch (err) {
      alert('Error al guardar el presupuesto: ' + err.message);
    }
  };

  const handleAsignacionIndividual = (presupuesto) => {
    setPresupuestoParaAsignar(presupuesto);
    setShowAsignaciones(true);
  };

  const handleGuardarAsignaciones = async (remisiones) => {
     try {
      await Promise.all(remisiones.map(remision => Remision.create(remision)));
      alert(`${remisiones.length} asignaciones individuales creadas exitosamente.`);
      setShowAsignaciones(false);
      setPresupuestoParaAsignar(null);
    } catch (error) {
      console.error('Error guardando asignaciones individuales:', error);
      alert('Error al guardar las asignaciones: ' + error.message);
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
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Presupuestos</h1>
            <p className="text-slate-600 text-lg">Crea y gestiona presupuestos detallados de fabricación</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-medium px-6 py-3 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Presupuesto
          </Button>
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

        {/* Form Modal Asignaciones Individuales */}
        {showAsignaciones && presupuestoParaAsignar && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full h-full flex flex-col">
              <AsignacionesIndividuales
                presupuesto={presupuestoParaAsignar}
                productos={productos}
                materiasPrimas={materiasPrimas}
                colores={colores}
                operaciones={operaciones}
                onGuardar={handleGuardarAsignaciones}
                onCancelar={() => {
                  setShowAsignaciones(false);
                  setPresupuestoParaAsignar(null);
                }}
              />
            </div>
          </div>
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
              const fecha = data.ultimaFecha ? new Date(data.ultimaFecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                onAsignacionIndividual={() => handleAsignacionIndividual(presupuesto)} // Pasa la nueva prop
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
