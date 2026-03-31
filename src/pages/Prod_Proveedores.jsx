
import React, { useState, useEffect } from "react";
import { Proveedor } from "@/entities/Proveedor";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Building } from "lucide-react";

import FormularioProveedor from "../components/proveedores/FormularioProveedor";
import TarjetaProveedor from "../components/proveedores/TarjetaProveedor";

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [filteredProveedores, setFilteredProveedores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadProveedores();
  }, []);
  
  // Debounce search term to optimize filtering
  useEffect(() => {
    const handler = setTimeout(() => {
      let filtered = proveedores;
      if (searchTerm) {
        filtered = filtered.filter(p => 
          p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.ciudad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.contactos?.some(c => 
            c.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        );
      }
      setFilteredProveedores(filtered);
    }, 300); // 300ms debounce delay

    // Cleanup function to clear the timeout if searchTerm or proveedores change
    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, proveedores]); // Re-run effect when searchTerm or proveedores change

  const loadProveedores = async () => {
    setIsLoading(true);
    const data = await Proveedor.list("-created_date");
    setProveedores(data);
    setIsLoading(false);
  };

  const handleSubmit = async (data) => {
    if (editingProveedor) {
      await Proveedor.update(editingProveedor.id, data);
    } else {
      await Proveedor.create(data);
    }
    
    setShowForm(false);
    setEditingProveedor(null);
    loadProveedores();
  };

  const handleEdit = (proveedor) => {
    setEditingProveedor(proveedor);
    setShowForm(true);
  };

  const handleDelete = async (proveedorId) => {
    try {
      await Proveedor.delete(proveedorId);
      loadProveedores();
    } catch (error) {
      alert('Error al eliminar el proveedor');
    }
  };

  return (
    <div className="p-3 sm:p-8 space-y-4 sm:space-y-8 bg-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Gestión de Proveedores</h1>
            <p className="text-slate-600 text-lg">Administra tu base de datos de proveedores</p>
          </div>
          <Button 
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-medium px-6 py-3 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Proveedor
          </Button>
        </div>

        {/* Search */}
        <Card className="bg-white border-slate-200 mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, contacto o ciudad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-slate-200 focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Modal */}
        {showForm && (
          <FormularioProveedor
            proveedor={editingProveedor}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingProveedor(null);
            }}
          />
        )}

        {/* Proveedores Grid */}
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
          ) : filteredProveedores.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Building className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No se encontraron proveedores
              </h3>
              <p className="text-slate-500 mb-6">
                {searchTerm
                  ? "Intenta ajustar tu búsqueda" 
                  : "Comienza agregando tu primer proveedor"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowForm(true)} className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Primer Proveedor
                </Button>
              )}
            </div>
          ) : (
            filteredProveedores.map((proveedor) => (
              <TarjetaProveedor
                key={proveedor.id}
                proveedor={proveedor}
                onEdit={() => handleEdit(proveedor)}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>

        {/* Summary Stats */}
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-slate-200 mt-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-slate-900">{proveedores.length}</div>
                <div className="text-sm text-slate-600">Total Proveedores</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {proveedores.filter(p => p.activo).length}
                </div>
                <div className="text-sm text-slate-600">Proveedores Activos</div>
              </div>
              <div className="md:col-span-1 col-span-2">
                <div className="text-2xl font-bold text-slate-900">
                  {[...new Set(proveedores.map(p => p.ciudad).filter(Boolean))].length}
                </div>
                <div className="text-sm text-slate-600">Ciudades</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
