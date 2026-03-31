
import React, { useState, useEffect } from "react";
import { MateriaPrima } from "@/entities/MateriaPrima";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Package } from "lucide-react";

import FormularioMateriaPrima from "../components/materias-primas/FormularioMateriaPrima";
import TarjetaMateriaPrima from "../components/materias-primas/TarjetaMateriaPrima";

export default function MateriasPrimas() {
  const [materias, setMaterias] = useState([]);
  const [filteredMaterias, setFilteredMaterias] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMateria, setEditingMateria] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadMaterias();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      let filtered = materias;
      if (searchTerm) {
        filtered = filtered.filter(m => 
          m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (m.proveedor && m.proveedor.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }
      setFilteredMaterias(filtered);
    }, 300); // Debounce delay

    return () => {
      clearTimeout(handler); // Clear timeout if searchTerm or materias change before 300ms
    };
  }, [searchTerm, materias]); // Re-run effect when searchTerm or materias change

  const loadMaterias = async () => {
    setIsLoading(true);
    const data = await MateriaPrima.list("-created_date");
    setMaterias(data);
    setIsLoading(false);
  };

  const handleSubmit = async (data) => {
    if (editingMateria) {
      await MateriaPrima.update(editingMateria.id, data);
    } else {
      await MateriaPrima.create(data);
    }
    
    setShowForm(false);
    setEditingMateria(null);
    loadMaterias();
  };

  const handleEdit = (materia) => {
    setEditingMateria(materia);
    setShowForm(true);
  };

  const handleDelete = async (materiaId) => {
    try {
      await MateriaPrima.delete(materiaId);
      loadMaterias();
    } catch (error) {
      alert('Error al eliminar la materia prima');
    }
  };

  return (
    <div className="p-3 sm:p-8 space-y-4 sm:space-y-8 bg-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Materias Primas</h1>
            <p className="text-slate-600 text-lg">Gestiona el inventario de materiales para tus chaquetas</p>
          </div>
          <Button 
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium px-6 py-3 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Materia Prima
          </Button>
        </div>

        {/* Search */}
        <Card className="bg-white border-slate-200 mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por nombre o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Modal */}
        {showForm && (
          <FormularioMateriaPrima
            materia={editingMateria}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingMateria(null);
            }}
          />
        )}

        {/* Materials Grid */}
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
          ) : filteredMaterias.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No se encontraron materias primas
              </h3>
              <p className="text-slate-500 mb-6">
                {searchTerm
                  ? "Intenta ajustar tu búsqueda" 
                  : "Comienza agregando tu primera materia prima"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Primera Materia Prima
                </Button>
              )}
            </div>
          ) : (
            filteredMaterias.map((materia) => (
              <TarjetaMateriaPrima
                key={materia.id}
                materia={materia}
                onEdit={() => handleEdit(materia)}
                onDelete={() => handleDelete(materia.id)}
              />
            ))
          )}
        </div>

        {/* Summary Stats */}
        <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border-slate-200 mt-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-slate-900">{materias.length}</div>
                <div className="text-sm text-slate-600">Total Materias</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {[...new Set(materias.map(m => m.proveedor).filter(Boolean))].length}
                </div>
                <div className="text-sm text-slate-600">Proveedores</div>
              </div>
              <div className="md:col-span-1 col-span-2">
                <div className="text-2xl font-bold text-slate-900">
                  ${materias.reduce((sum, m) => sum + (m.precio_por_unidad || 0), 0).toFixed(2)}
                </div>
                <div className="text-sm text-slate-600">Valor Inventario</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
