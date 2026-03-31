import React, { useState, useEffect } from "react";
import { Operacion, MateriaPrima } from "@/api/entitiesChaquetas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Settings, Edit, Trash2, Play } from "lucide-react";
import { Switch } from "@/components/ui/switch";

import FormularioOperacion from "../components/operaciones/FormularioOperacion";

export default function Operaciones() {
  const [operaciones, setOperaciones] = useState([]);
  const [filteredOperaciones, setFilteredOperaciones] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOperacion, setEditingOperacion] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      let filtered = operaciones;
      if (searchTerm) {
        filtered = filtered.filter(op =>
          op.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          op.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setFilteredOperaciones(filtered);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, operaciones]);

  const loadData = async () => {
    setIsLoading(true);
    const [operacionesData, materiasData] = await Promise.all([
      Operacion.list("-orden_procesamiento"),
      MateriaPrima.list()
    ]);
    setOperaciones(operacionesData);
    setMateriasPrimas(materiasData);
    setIsLoading(false);
  };

  const handleSubmit = async (data) => {
    if (editingOperacion) {
      await Operacion.update(editingOperacion.id, data);
    } else {
      await Operacion.create(data);
    }
    
    setShowForm(false);
    setEditingOperacion(null);
    loadData();
  };

  const handleEdit = (operacion) => {
    setEditingOperacion(operacion);
    setShowForm(true);
  };

  const toggleActivo = async (operacion) => {
    await Operacion.update(operacion.id, { ...operacion, activa: !operacion.activa });
    loadData();
  };

  const handleDelete = async (operacionId) => {
    try {
      await Operacion.delete(operacionId);
      loadData();
    } catch (error) {
      alert('Error al eliminar la operación');
    }
  };

  const getTipoMaterialColor = (tipo) => {
    const colors = {
      tela: 'bg-blue-100 text-blue-800',
      forro: 'bg-purple-100 text-purple-800',
      cremallera: 'bg-green-100 text-green-800',
      boton: 'bg-orange-100 text-orange-800',
      hilo: 'bg-pink-100 text-pink-800',
      accesorio: 'bg-indigo-100 text-indigo-800',
      otro: 'bg-gray-100 text-gray-800'
    };
    return colors[tipo] || colors.otro;
  };

  const inicializarOperacionesPorDefecto = async () => {
    const operacionesDefecto = [
      {
        nombre: "Termofijado",
        descripcion: "Proceso de termofijado para cremalleras y accesorios",
        tipos_materiales_requeridos: ["cremallera", "accesorio"],
        condicion_logica: "cualquiera",
        orden_procesamiento: 1
      },
      {
        nombre: "Impresión DTF",
        descripcion: "Impresión digital textil",
        tipos_materiales_requeridos: ["accesorio"],
        condicion_logica: "cualquiera",
        orden_procesamiento: 2
      },
      {
        nombre: "Sesgado",
        descripcion: "Proceso de sesgado de telas",
        tipos_materiales_requeridos: ["tela", "hilo"],
        condicion_logica: "todos",
        orden_procesamiento: 3
      },
      {
        nombre: "Tejido",
        descripcion: "Procesos de tejido y confección",
        tipos_materiales_requeridos: ["tela", "hilo"],
        condicion_logica: "todos",
        orden_procesamiento: 4
      },
      {
        nombre: "Asignación Individual",
        descripcion: "Asignación de trabajo individual",
        tipos_materiales_requeridos: ["tela"],
        condicion_logica: "cualquiera",
        orden_procesamiento: 5
      },
      {
        nombre: "Corte",
        descripcion: "Corte de materiales textiles",
        tipos_materiales_requeridos: ["tela", "forro"],
        condicion_logica: "cualquiera",
        orden_procesamiento: 0
      }
    ];

    try {
      await Operacion.bulkCreate(operacionesDefecto);
      alert("Operaciones por defecto creadas exitosamente");
      loadData();
    } catch (error) {
      console.error("Error creando operaciones por defecto:", error);
      alert("Error al crear operaciones por defecto");
    }
  };

  return (
    <div className="p-3 sm:p-8 space-y-4 sm:space-y-8 bg-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Operaciones de Producción</h1>
            <p className="text-slate-600 text-lg">Configura qué materiales activan cada tipo de remisión</p>
          </div>
          <div className="flex gap-3">
            {operaciones.length === 0 && (
              <Button 
                onClick={inicializarOperacionesPorDefecto}
                className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
              >
                <Play className="w-5 h-5 mr-2" />
                Crear Operaciones por Defecto
              </Button>
            )}
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-medium px-6 py-3 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nueva Operación
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card className="bg-white border-slate-200 mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar operaciones por nombre o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-slate-200 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Modal */}
        {showForm && (
          <FormularioOperacion
            operacion={editingOperacion}
            materiasPrimas={materiasPrimas}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingOperacion(null);
            }}
          />
        )}

        {/* Operaciones Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          ) : filteredOperaciones.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Settings className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No se encontraron operaciones
              </h3>
              <p className="text-slate-500 mb-6">
                {searchTerm
                  ? "Intenta ajustar tu búsqueda"
                  : "Comienza creando las operaciones por defecto o agrega tu primera operación"}
              </p>
              {!searchTerm && (
                <div className="flex justify-center gap-4">
                  <Button onClick={inicializarOperacionesPorDefecto} className="bg-green-600 hover:bg-green-700">
                    <Play className="w-4 h-4 mr-2" />
                    Crear Operaciones por Defecto
                  </Button>
                  <Button onClick={() => setShowForm(true)} className="bg-amber-600 hover:bg-amber-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Operación
                  </Button>
                </div>
              )}
            </div>
          ) : (
            filteredOperaciones.map((operacion) => (
              <Card key={operacion.id} className="bg-white border-slate-200 hover:border-amber-300 transition-all duration-200 group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                        {operacion.nombre}
                        {!operacion.activa && (
                          <Badge variant="outline" className="text-red-600 border-red-200">
                            Inactiva
                          </Badge>
                        )}
                      </CardTitle>
                      {operacion.descripcion && (
                        <p className="text-sm text-slate-600 mb-3">
                          {operacion.descripcion}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(operacion.tipos_materiales_requeridos || []).map((tipo) => (
                          <Badge key={tipo} className={`${getTipoMaterialColor(tipo)} border-0 text-xs`}>
                            {tipo}
                          </Badge>
                        ))}
                      </div>
                      {operacion.condicion_logica && (
                        <div className="text-xs text-slate-500">
                          Condición: <span className="font-medium">
                            {operacion.condicion_logica === 'cualquiera' ? 'Cualquier material' : 'Todos los materiales'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Switch
                        checked={operacion.activa}
                        onCheckedChange={() => toggleActivo(operacion)}
                        size="sm"
                      />
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(operacion)}
                          className="hover:bg-amber-50 hover:text-amber-600 transition-colors h-8 w-8"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (window.confirm(`¿Estás seguro de eliminar "${operacion.nombre}"?`)) {
                              handleDelete(operacion.id);
                            }
                          }}
                          className="hover:bg-red-50 hover:text-red-600 transition-colors h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="text-sm text-slate-600 flex justify-between items-center">
                    <span>Orden: #{operacion.orden_procesamiento || 0}</span>
                    <span className={operacion.activa ? 'text-green-600' : 'text-red-600'}>
                      {operacion.activa ? '● Activa' : '○ Inactiva'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}