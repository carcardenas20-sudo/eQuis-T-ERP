import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, Trash2, Calculator, Copy, Package, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import _ from 'lodash';
import SelectorCombinaciones from './SelectorCombinaciones';

export default function FormularioPresupuesto({ presupuesto, productos, materiasPrimas, colores, onSubmit, onCancel }) {
  const [activeTab, setActiveTab] = useState("info");

  const [formData, setFormData] = useState(() => {
    if (presupuesto) {
      const initialData = JSON.parse(JSON.stringify(presupuesto));
      if (!initialData.id) {
        delete initialData.id;
        initialData.estado = "borrador";
      }
      if (initialData.materiales_calculados) {
        initialData.materiales_calculados = initialData.materiales_calculados.map(mat => {
          const materiaPrima = materiasPrimas.find(mp => mp.id === mat.materia_prima_id);
          // Migrar: si comprado=true y no hay cantidad_comprada, usar cantidad_total
          const cantComprada = mat.cantidad_comprada !== undefined
            ? mat.cantidad_comprada
            : (mat.comprado ? (mat.cantidad_total || 0) : 0);
          return {
            ...mat,
            color_fijo: materiaPrima ? materiaPrima.color_fijo : false,
            cantidad_comprada: cantComprada,
            compras_historico: mat.compras_historico || [],
            comprado: cantComprada > 0 && cantComprada >= (mat.cantidad_total || 0)
          };
        });
      }
      initialData.materiales_ocultos = initialData.materiales_ocultos || [];
      if (initialData.productos) {
        initialData.productos = initialData.productos.map(prod => {
          const producto = productos.find(p => p.id === prod.producto_id);
          const tallas = producto?.tallas || [];
          
          // Si no existe objetivo_por_talla, calcularlo desde las combinaciones actuales
          if (!prod.objetivo_por_talla) {
            const unidadesPorTalla = {};
            (prod.combinaciones || []).forEach(comb => {
              (comb.tallas_cantidades || []).forEach(tc => {
                unidadesPorTalla[tc.talla] = (unidadesPorTalla[tc.talla] || 0) + (tc.cantidad || 0);
              });
            });
            prod.objetivo_por_talla = tallas.reduce((acc, t) => ({
              ...acc,
              [t]: unidadesPorTalla[t] || 0
            }), {});
          }
          
          return {
            ...prod,
            unidades_por_asignacion: prod.unidades_por_asignacion === undefined ? 20 : prod.unidades_por_asignacion
          };
        });
      }
      return initialData;
    } else {
      return {
        numero_presupuesto: `PRES-${Date.now()}`,
        cliente: "",
        fecha_entrega: "",
        productos: [],
        materiales_calculados: [],
        materiales_ocultos: [],
        margen_ganancia: 30,
        estado: "borrador",
        observaciones: "",
        total_materiales: 0,
        total_mano_obra: 0,
        total_general: 0
      };
    }
  });

  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [filtroMaterial, setFiltroMaterial] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [registrandoCompra, setRegistrandoCompra] = useState(null);
  const [inventario, setInventario] = useState([]);

  useEffect(() => {
    base44.entities.Inventario.list('-updated_date', 300).then(setInventario).catch(() => {});
  }, []);

  // Buscar stock disponible para un material+color en el inventario
  const getStockDisponible = (nombre, color) => {
    const q = nombre?.toLowerCase() || '';
    const c = color?.toLowerCase() || '';
    const match = inventario.find(i =>
      (i.materia_prima_nombre || '').toLowerCase().includes(q) &&
      (!c || c === 'sin definir' || (i.color || '').toLowerCase() === c || (i.color || '') === '')
    );
    return match ? { cantidad: match.cantidad_disponible || 0, unidad: match.unidad_medida } : null;
  }; // { index, cantidad, nota }

  const calcularTodo = useCallback(() => {
    setFormData(prev => {
      const oldStatus = new Map((prev.materiales_calculados || []).map(m => [
        `${m.materia_prima_id}_${m.color}`,
        { comprado: m.comprado, cantidad_comprada: m.cantidad_comprada || 0, compras_historico: m.compras_historico || [] }
      ]));
      let materialesMap = {};

      prev.productos.forEach(item => {
        const producto = productos.find(p => p.id === item.producto_id);
        if (!producto) return;
        const unidadesPorAsignacion = item.unidades_por_asignacion || 20;

        (item.combinaciones || []).forEach(combinacion => {
          const totalUnidades = (combinacion.tallas_cantidades || []).reduce((sum, tc) => sum + (tc.cantidad || 0), 0);
          if (totalUnidades === 0) return;

          (producto.materiales_requeridos || []).forEach(mat => {
            const materia = materiasPrimas.find(mp => mp.id === mat.materia_prima_id);
            if (!materia) return;

            let colorFinal = 'Sin definir';
            if (materia.color_fijo) {
              colorFinal = materia.color_por_defecto || 'Color Fijo';
            } else {
              const colorEntry = (combinacion.colores_por_material || []).find(cm => cm.row_id === mat.row_id);
              if (colorEntry?.color_nombre) {
                colorFinal = colorEntry.color_nombre;
              } else if (colorEntry?.color_id) {
                const colorObj = colores.find(c => c.id === colorEntry.color_id);
                colorFinal = colorObj?.nombre || 'Color no encontrado';
              } else {
                const seccionAnclaje = mat.seccion || 'superior';
                if (seccionAnclaje === 'color_propio') {
                  colorFinal = 'Color Propio';
                } else {
                  const colorId = combinacion.colores?.[seccionAnclaje];
                  if (colorId) {
                    const colorObj = colores.find(c => c.id === colorId);
                    colorFinal = colorObj?.nombre || 'Color no encontrado';
                  }
                }
              }
            }

            const key = `${materia.id}_${colorFinal}`;
            const prevData = oldStatus.get(key) || { comprado: false, cantidad_comprada: 0, compras_historico: [] };
            if (!materialesMap[key]) {
              materialesMap[key] = {
                materia_prima_id: materia.id,
                nombre: materia.nombre,
                color: colorFinal,
                precio_unitario: materia.precio_por_unidad || 0,
                unidad_medida: materia.unidad_medida || 'unidad',
                cantidad_total: 0,
                costo_total: 0,
                tipo_material: materia.tipo_material,
                color_fijo: materia.color_fijo,
                comprado: prevData.comprado,
                cantidad_comprada: prevData.cantidad_comprada,
                compras_historico: prevData.compras_historico,
              };
            }

            let cantidadRequerida = (mat.cantidad_por_unidad || 0) * totalUnidades;
            if (mat.asignacion_automatica && unidadesPorAsignacion > 0) {
              cantidadRequerida = Math.ceil(cantidadRequerida / unidadesPorAsignacion) * unidadesPorAsignacion;
            }
            materialesMap[key].cantidad_total += cantidadRequerida;
            materialesMap[key].costo_total = materialesMap[key].cantidad_total * materialesMap[key].precio_unitario;
          });
        });
      });

      const materialesActualizados = Object.values(materialesMap).map(nuevoMat => {
        nuevoMat.comprado = (nuevoMat.cantidad_comprada || 0) >= nuevoMat.cantidad_total && nuevoMat.cantidad_total > 0;
        return nuevoMat;
      });

      const totalMateriales = materialesActualizados.reduce((sum, m) => sum + m.costo_total, 0);

      return {
        ...prev,
        materiales_calculados: materialesActualizados,
        total_materiales: totalMateriales,
        total_mano_obra: 0,
        total_general: totalMateriales
      };
    });
    setActiveTab("materiales");
  }, [productos, materiasPrimas, colores]);

  const faltaPorPagar = useMemo(() => {
    return (formData.materiales_calculados || []).reduce((total, material) => {
      // Respetar flag comprado (presupuestos viejos sin cantidad_comprada)
      if (material.comprado) return total;
      const comprada = material.cantidad_comprada || 0;
      const totalCant = material.cantidad_total || 0;
      if (comprada >= totalCant && totalCant > 0) return total;
      const fraccion = totalCant > 0 ? Math.max(0, (totalCant - comprada) / totalCant) : 1;
      return total + (material.costo_total || 0) * fraccion;
    }, 0);
  }, [formData.materiales_calculados]);

  const handleRegistrarCompra = (index, cantidad, nota) => {
    setFormData(prev => {
      const mat = prev.materiales_calculados[index];
      const cantidadNueva = (mat.cantidad_comprada || 0) + (parseFloat(cantidad) || 0);
      const entrada = { fecha: new Date().toISOString().split('T')[0], cantidad: parseFloat(cantidad) || 0, nota: nota || '' };
      const nuevosMateriales = prev.materiales_calculados.map((m, i) => i !== index ? m : {
        ...m,
        cantidad_comprada: cantidadNueva,
        compras_historico: [...(m.compras_historico || []), entrada],
        comprado: cantidadNueva >= (m.cantidad_total || 0)
      });
      return { ...prev, materiales_calculados: nuevosMateriales };
    });
    setRegistrandoCompra(null);
  };

  const handleToggleComprado = (index) => {
    setFormData(prev => {
      const nuevosMateriales = [...prev.materiales_calculados];
      nuevosMateriales[index] = { ...nuevosMateriales[index], comprado: !nuevosMateriales[index].comprado };
      return { ...prev, materiales_calculados: nuevosMateriales };
    });
  };

  const toggleOcultarMaterial = (materiaId) => {
    setFormData(prev => {
      const ocultos = prev.materiales_ocultos || [];
      const newOcultos = ocultos.includes(materiaId) ? ocultos.filter(id => id !== materiaId) : [...ocultos, materiaId];
      return { ...prev, materiales_ocultos: newOcultos };
    });
  };

  const actualizarMaterialCalculado = (index, campo, valor) => {
    setFormData(prev => {
      const nuevosMateriales = prev.materiales_calculados.map((material, i) => {
        if (i !== index) return material;
        if (campo === 'cantidad_total') {
          const nuevaCantidad = parseFloat(valor) || 0;
          return { ...material, cantidad_total: nuevaCantidad, costo_total: nuevaCantidad * material.precio_unitario };
        }
        return { ...material, [campo]: valor };
      });
      const nuevoTotalMateriales = nuevosMateriales.reduce((sum, m) => sum + m.costo_total, 0);
      return { ...prev, materiales_calculados: nuevosMateriales, total_materiales: nuevoTotalMateriales, total_general: nuevoTotalMateriales };
    });
  };

  const removerMaterialCalculado = (indexToRemove) => {
    if (!window.confirm("¿Estás seguro de eliminar este material del presupuesto?")) return;
    setFormData(prev => {
      const nuevosMateriales = prev.materiales_calculados.filter((_, index) => index !== indexToRemove);
      const nuevoTotalMateriales = nuevosMateriales.reduce((sum, m) => sum + m.costo_total, 0);
      return { ...prev, materiales_calculados: nuevosMateriales, total_materiales: nuevoTotalMateriales, total_general: nuevoTotalMateriales };
    });
  };

  const groupedMaterials = useMemo(() => {
    let materialesFiltrados = formData.materiales_calculados || [];
    if (filtroMaterial) {
      materialesFiltrados = materialesFiltrados.filter(mat =>
        mat.nombre.toLowerCase().includes(filtroMaterial.toLowerCase()) ||
        mat.color.toLowerCase().includes(filtroMaterial.toLowerCase())
      );
    }
    if (filtroTipo !== "todos") {
      materialesFiltrados = materialesFiltrados.filter(mat => mat.tipo_material === filtroTipo);
    }
    const groups = _.groupBy(materialesFiltrados, 'tipo_material');
    for (const tipo in groups) {
      groups[tipo] = _.orderBy(groups[tipo], ['comprado'], ['asc']);
    }
    const groupOrder = ['tela', 'forro', 'cremallera', 'boton', 'hilo', 'accesorio', 'otro'];
    const sortedGroups = {};
    groupOrder.forEach(key => { if (groups[key]) sortedGroups[key] = groups[key]; });
    Object.keys(groups).forEach(key => { if (!sortedGroups[key]) sortedGroups[key] = groups[key]; });
    return sortedGroups;
  }, [formData.materiales_calculados, filtroMaterial, filtroTipo]);

  const tiposDisponibles = useMemo(() => {
    return [...new Set((formData.materiales_calculados || []).map(m => m.tipo_material))].sort();
  }, [formData.materiales_calculados]);

  const agregarProducto = () => {
    if (!productoSeleccionado) return;
    const producto = productos.find(p => p.id === productoSeleccionado);
    if (!producto) return;
    setFormData(prev => ({
      ...prev,
      productos: [...prev.productos, {
        id: Date.now().toString(),
        producto_id: productoSeleccionado,
        unidades_por_asignacion: 20,
        combinaciones: [],
        objetivo_por_talla: (producto.tallas || []).reduce((acc, t) => ({ ...acc, [t]: 0 }), {})
      }]
    }));
    setProductoSeleccionado("");
  };

  const eliminarProducto = (index) => {
    setFormData(prev => ({ ...prev, productos: prev.productos.filter((_, i) => i !== index) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.numero_presupuesto) {
      alert("Complete los campos obligatorios");
      return;
    }
    const dataToSend = {
      ...formData,
      fecha_entrega: formData.fecha_entrega || null,
    };
    onSubmit(dataToSend);
  };

  const esCopia = presupuesto && !presupuesto.id && presupuesto.numero_presupuesto?.includes(' - Copia');

  const totalUnidadesProductos = formData.productos.reduce((sum, item) => {
    return sum + (item.combinaciones || []).reduce((s, comb) => {
      return s + (comb.tallas_cantidades || []).reduce((ss, tc) => ss + (tc.cantidad || 0), 0);
    }, 0);
  }, 0);

  const tabs = [
    { key: 'info', label: '📋 Info' },
    { key: 'productos', label: '👕 Productos' },
    { key: 'materiales', label: '📦 Materiales' },
    { key: 'resumen', label: '💰 Resumen' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <Card className="bg-white rounded-lg sm:rounded-xl">
          <CardHeader className="border-b p-3 sm:p-5 sticky top-0 bg-white z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <CardTitle className="text-lg sm:text-2xl">
                  {presupuesto?.id ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
                </CardTitle>
                {esCopia && (
                  <p className="text-xs text-yellow-600 mt-0.5 flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Estás editando una copia. Cambia el número y guarda.
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onCancel} className="shrink-0">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-3 sm:p-5">
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Tabs manuales */}
                <div className="grid grid-cols-4 w-full bg-slate-100 rounded-lg p-1 gap-1">
                  {tabs.map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`text-xs sm:text-sm py-2 px-1 rounded-md font-medium transition-all ${activeTab === tab.key ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB 1: INFO */}
                {activeTab === 'info' && (
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Número de Presupuesto *</Label>
                        <Input value={formData.numero_presupuesto} onChange={(e) => setFormData({ ...formData, numero_presupuesto: e.target.value })} required />
                      </div>
                      <div>
                        <Label>Fecha de Entrega</Label>
                        <Input type="date" value={formData.fecha_entrega} onChange={(e) => setFormData({ ...formData, fecha_entrega: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Estado</Label>
                        <select value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })} className="w-full h-9 px-3 border border-slate-200 rounded text-sm">
                          <option value="borrador">Borrador</option>
                          <option value="enviado">Enviado</option>
                          <option value="aprobado">Aprobado</option>
                          <option value="rechazado">Rechazado</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Observaciones</Label>
                      <Textarea value={formData.observaciones} onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} rows={3} />
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" onClick={() => setActiveTab("productos")} className="bg-blue-600 hover:bg-blue-700">
                        Siguiente: Productos →
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 2: PRODUCTOS */}
                {activeTab === 'productos' && (
                  <div className="space-y-4 mt-4">
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                      <div className="flex-1">
                        <Label className="text-sm">Agregar Producto</Label>
                        <select value={productoSeleccionado} onChange={(e) => setProductoSeleccionado(e.target.value)} className="w-full h-9 px-3 border border-slate-200 rounded text-sm">
                          <option value="">Selecciona un producto</option>
                          {productos.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <Button type="button" onClick={agregarProducto} className="w-full sm:w-auto">
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {formData.productos.length === 0 && (
                        <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-xl">
                          <p className="text-sm">Aún no hay productos. Selecciona uno arriba para comenzar.</p>
                        </div>
                      )}
                      {formData.productos.map((item, prodIndex) => {
                       const producto = productos.find(p => p.id === item.producto_id);
                       const combinacionesActivas = (item.combinaciones || []).filter(c => c.predefinida_id);
                       const combinacionesSeleccionadas = combinacionesActivas.length;
                       const tallas = producto?.tallas || [];
                       const objetivoPorTalla = item.objetivo_por_talla || {};

                       // Acumular unidades asignadas por talla a través de todas las combinaciones
                       const asignadoPorTalla = {};
                       combinacionesActivas.forEach(comb => {
                         (comb.tallas_cantidades || []).forEach(tc => {
                           asignadoPorTalla[tc.talla] = (asignadoPorTalla[tc.talla] || 0) + (tc.cantidad || 0);
                         });
                       });

                       const totalAsignado = Object.values(asignadoPorTalla).reduce((s, v) => s + v, 0);
                       const totalObjetivo = Object.values(objetivoPorTalla).reduce((s, v) => s + (v || 0), 0);
                       const hayObjetivo = totalObjetivo > 0;
                       const diferencia = totalAsignado - totalObjetivo;

                       return (
                         <Card key={item.id} className="border border-slate-200">
                           <CardContent className="p-3 sm:p-4">
                             <div className="flex justify-between items-start gap-2 mb-3">
                               <div className="flex-1">
                                 <div className="flex items-center gap-2 flex-wrap">
                                   <h4 className="font-semibold text-base">{producto?.nombre}</h4>
                                   <Badge className={`text-xs ${totalAsignado > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                     {combinacionesSeleccionadas} comb. · {totalAsignado}{hayObjetivo ? `/${totalObjetivo}` : ''} uds
                                   </Badge>
                                   {hayObjetivo && diferencia !== 0 && (
                                     <Badge className={`text-xs ${diferencia > 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                       {diferencia > 0 ? `+${diferencia} excedido` : `${Math.abs(diferencia)} faltan`}
                                     </Badge>
                                   )}
                                   {hayObjetivo && diferencia === 0 && totalAsignado > 0 && (
                                     <Badge className="text-xs bg-green-100 text-green-700">✓ Completo</Badge>
                                   )}
                                 </div>

                                </div>
                                <Button variant="ghost" size="sm" onClick={() => eliminarProducto(prodIndex)}
                                  className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>

                              <SelectorCombinaciones
                                item={item}
                                producto={producto}
                                materiasPrimas={materiasPrimas}
                                colores={colores}
                                onChange={(nuevasCombinaciones) => {
                                  setFormData(prev => {
                                    const newProductos = [...prev.productos];
                                    newProductos[prodIndex] = { ...newProductos[prodIndex], combinaciones: nuevasCombinaciones };
                                    return { ...prev, productos: newProductos };
                                  });
                                }}
                              />
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {formData.productos.length > 0 && (
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-sm text-slate-500">{totalUnidadesProductos} unidades totales</span>
                        <Button type="button" onClick={calcularTodo} className="bg-blue-600 hover:bg-blue-700">
                          <Calculator className="w-4 h-4 mr-2" />
                          Calcular materiales →
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: MATERIALES */}
                {activeTab === 'materiales' && (
                  <div className="space-y-4 mt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <h4 className="font-semibold text-slate-800">Lista de Materiales y Compras</h4>
                      <Button type="button" onClick={calcularTodo} className="bg-blue-600 hover:bg-blue-700 text-sm w-full sm:w-auto">
                        <Calculator className="w-4 h-4 mr-2" />
                        Recalcular
                      </Button>
                    </div>

                    {(formData.materiales_calculados?.length || 0) === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed rounded-xl text-slate-400">
                        <Calculator className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Aún no hay materiales calculados.</p>
                        <p className="text-xs">Ve a Productos y presiona "Calcular materiales".</p>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-slate-50 rounded-lg border grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-slate-600 mb-1 block">Buscar material</Label>
                            <Input placeholder="Nombre o color..." value={filtroMaterial} onChange={(e) => setFiltroMaterial(e.target.value)} className="h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-600 mb-1 block">Filtrar por tipo</Label>
                            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="h-8 text-xs px-2 border border-slate-200 rounded w-full">
                              <option value="todos">Todos</option>
                              {tiposDisponibles.map(tipo => (
                                <option key={tipo} value={tipo}>{tipo || 'Sin tipo'}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {Object.entries(groupedMaterials).map(([tipo, materialesDelGrupo]) => {
                            const totalGrupo = materialesDelGrupo.reduce((sum, item) => sum + item.costo_total, 0);
                            return (
                              <div key={tipo} className="p-3 bg-slate-100 rounded-lg">
                                <div className="flex justify-between items-center mb-2 px-1">
                                  <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-slate-500" />
                                    <h5 className="font-bold text-slate-700 uppercase tracking-wide text-xs">{tipo || 'Otros'} ({materialesDelGrupo.length})</h5>
                                  </div>
                                  <span className="font-semibold text-slate-600 text-xs">${totalGrupo.toFixed(2)}</span>
                                </div>
                                <div className="space-y-1.5">
                                  {materialesDelGrupo.map((mat) => {
                                    const globalIndex = formData.materiales_calculados.findIndex(m => m.materia_prima_id === mat.materia_prima_id && m.color === mat.color);
                                    const isOculto = (formData.materiales_ocultos || []).includes(mat.materia_prima_id);
                                    return (
                                      <div key={`${mat.materia_prima_id}_${mat.color}`}
                                        className={`text-xs p-2 bg-white rounded-lg border space-y-1.5 ${mat.comprado ? 'border-green-200 bg-green-50/30' : ''} ${isOculto ? 'opacity-60' : ''}`}>
                                        {/* Fila principal: nombre + controles */}
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                          <div className="flex items-start flex-1 gap-2 min-w-0">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                {mat.comprado && <span className="text-green-500 font-bold">✓</span>}
                                                <span className={`font-medium ${mat.comprado ? 'text-green-700' : ''}`}>{mat.nombre}</span>
                                              </div>
                                              {mat.color_fijo ? (
                                                <span className="text-gray-400">• {mat.color}</span>
                                              ) : (
                                                <select value={mat.color} onChange={(e) => actualizarMaterialCalculado(globalIndex, 'color', e.target.value)} className="h-6 text-xs px-1 border border-slate-200 rounded mt-0.5">
                                                  <option value="" disabled>Seleccionar color</option>
                                                  {colores.filter(c => c.activo).map(c => (
                                                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                                  ))}
                                                </select>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <div className="flex items-center gap-1">
                                              <Input
                                                type="number" step="any"
                                                value={mat.cantidad_total}
                                                onChange={(e) => actualizarMaterialCalculado(globalIndex, 'cantidad_total', e.target.value)}
                                                className="w-16 h-6 text-right text-xs"
                                                min="0"
                                              />
                                              <span className="text-xs whitespace-nowrap text-slate-500">{mat.unidad_medida}</span>
                                            </div>
                                            <span className="font-semibold text-right text-xs w-16">${mat.costo_total.toFixed(2)}</span>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleOcultarMaterial(mat.materia_prima_id)}
                                              className="text-slate-400 hover:bg-slate-100 h-6 w-6" title={isOculto ? "Mostrar en remisiones" : "Ocultar en remisiones"}>
                                              {isOculto ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removerMaterialCalculado(globalIndex)}
                                              className="text-red-400 hover:bg-red-50 h-6 w-6">
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        </div>
                                        {/* Stock en inventario */}
                                        {(() => {
                                          const stock = getStockDisponible(mat.nombre, mat.color);
                                          if (!stock) return null;
                                          const falta = Math.max(0, (mat.cantidad_total || 0) - (mat.cantidad_comprada || 0));
                                          const cubre = stock.cantidad >= falta;
                                          return (
                                            <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border ${cubre ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                                              <span className="font-medium">📦 En inventario: {stock.cantidad} {stock.unidad}</span>
                                              {falta > 0 && !cubre && <span className="text-yellow-600">— faltan {(falta - stock.cantidad).toFixed(0)} por comprar</span>}
                                              {cubre && falta > 0 && <span className="text-green-600">— cubre lo necesario</span>}
                                            </div>
                                          );
                                        })()}
                                        {/* Barra de progreso de compras */}
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${mat.comprado ? 'bg-green-500' : 'bg-blue-400'}`}
                                              style={{ width: `${Math.min(100, ((mat.cantidad_comprada || 0) / Math.max(mat.cantidad_total || 1, 1)) * 100)}%` }} />
                                          </div>
                                          <span className={`text-xs font-medium whitespace-nowrap ${mat.comprado ? 'text-green-600' : 'text-slate-500'}`}>
                                            {mat.cantidad_comprada || 0}/{mat.cantidad_total} {mat.unidad_medida}
                                          </span>
                                          <button type="button"
                                            onClick={() => setRegistrandoCompra(registrandoCompra?.index === globalIndex ? null : { index: globalIndex, cantidad: '', nota: '' })}
                                            className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded whitespace-nowrap">
                                            + Compra
                                          </button>
                                        </div>
                                        {/* Historial de compras */}
                                        {(mat.compras_historico || []).length > 0 && (
                                          <div className="text-xs text-slate-400 space-y-0.5 pl-2 border-l-2 border-slate-200">
                                            {mat.compras_historico.map((h, hi) => (
                                              <div key={hi}>{h.fecha}: <span className="font-medium text-slate-600">{h.cantidad} {mat.unidad_medida}</span>{h.nota ? ` — ${h.nota}` : ''}</div>
                                            ))}
                                          </div>
                                        )}
                                        {/* Formulario inline nueva compra */}
                                        {registrandoCompra?.index === globalIndex && (
                                          <div className="flex gap-1.5 items-center bg-blue-50 rounded p-1.5 border border-blue-200">
                                            <Input type="number" min="0" step="any"
                                              placeholder={`Cant. (faltan ${Math.max(0, (mat.cantidad_total || 0) - (mat.cantidad_comprada || 0)).toFixed(0)})`}
                                              value={registrandoCompra.cantidad}
                                              onChange={e => setRegistrandoCompra(prev => ({ ...prev, cantidad: e.target.value }))}
                                              className="h-6 text-xs w-28 flex-1" />
                                            <Input placeholder="Nota (opcional)"
                                              value={registrandoCompra.nota}
                                              onChange={e => setRegistrandoCompra(prev => ({ ...prev, nota: e.target.value }))}
                                              className="h-6 text-xs flex-1" />
                                            <button type="button" onClick={() => handleRegistrarCompra(globalIndex, registrandoCompra.cantidad, registrandoCompra.nota)}
                                              className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
                                              ✓
                                            </button>
                                            <button type="button" onClick={() => setRegistrandoCompra(null)} className="h-6 text-xs px-1 text-slate-400 hover:text-slate-600 rounded">
                                              ✕
                                            </button>
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
                      </>
                    )}
                  </div>
                )}

                {/* TAB 4: RESUMEN */}
                {activeTab === 'resumen' && (
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card className="border-slate-200">
                        <CardContent className="p-4 space-y-3">
                          <h4 className="font-semibold text-slate-800 text-sm">Resumen del Presupuesto</h4>
                          <div className="space-y-2 text-sm">

                            <div className="flex justify-between"><span className="text-slate-500">Productos:</span><span className="font-medium">{formData.productos.length}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Combinaciones:</span>
                              <span className="font-medium">{formData.productos.reduce((s, p) => s + (p.combinaciones || []).length, 0)}</span>
                            </div>
                            <div className="flex justify-between"><span className="text-slate-500">Unidades totales:</span><span className="font-medium">{totalUnidadesProductos}</span></div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-200">
                        <CardContent className="p-4 space-y-3">
                          <h4 className="font-semibold text-slate-800 text-sm">Costos</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Total Materiales:</span><span className="font-semibold">${(formData.total_materiales || 0).toFixed(2)}</span></div>
                            <div className="flex justify-between text-orange-600"><span>Falta por comprar:</span><span className="font-semibold">${faltaPorPagar.toFixed(2)}</span></div>
                            <div className="flex justify-between text-lg text-green-700 border-t pt-2 mt-2 font-bold">
                              <span>TOTAL FINAL:</span>
                              <span>${(formData.total_general || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {(formData.materiales_calculados?.length || 0) === 0 && (
                      <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                        ⚠️ Aún no calculaste los materiales. Ve a la pestaña Productos y presiona "Calcular materiales".
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botones fijos abajo */}
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={onCancel} className="text-sm">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-sm">
                  {presupuesto?.id ? 'Actualizar' : 'Crear'} Presupuesto
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}