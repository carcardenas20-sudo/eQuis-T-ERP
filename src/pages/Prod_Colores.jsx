
import React, { useState, useEffect } from "react";
import { Color } from "@/entities/Color";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Palette, Edit, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

import FormularioColor from "../components/colores/FormularioColor";

export default function Colores() {
  const [colores, setColores] = useState([]);
  const [filteredColores, setFilteredColores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadColores = async () => {
    setIsLoading(true);
    const data = await Color.list("-created_date");
    setColores(data);
    setIsLoading(false);
  };

  // Removed the old filterColores useCallback

  useEffect(() => {
    loadColores();
  }, []);

  // New useEffect for debounced filtering
  useEffect(() => {
    const handler = setTimeout(() => {
      let filtered = colores;
      if (searchTerm) {
        filtered = filtered.filter(c => 
          c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setFilteredColores(filtered);
    }, 300); // Debounce for 300ms

    return () => {
      clearTimeout(handler); // Clean up the timeout if searchTerm or colores changes before the delay
    };
  }, [searchTerm, colores]); // Dependencies for this useEffect

  const handleSubmit = async (data) => {
    if (editingColor) {
      await Color.update(editingColor.id, data);
    } else {
      await Color.create(data);
    }
    
    setShowForm(false);
    setEditingColor(null);
    loadColores();
  };

  const handleEdit = (color) => {
    setEditingColor(color);
    setShowForm(true);
  };

  const toggleActivo = async (color) => {
    await Color.update(color.id, { ...color, activo: !color.activo });
    loadColores();
  };

  const handleDelete = async (colorId) => {
    try {
      await Color.delete(colorId);
      loadColores();
    } catch (error) {
      alert('Error al eliminar el color');
    }
  };

  const handleDeleteClick = (color) => {
    if (window.confirm(`¿Estás seguro de eliminar el color "${color.nombre}"?`)) {
      handleDelete(color.id);
    }
  };

  return (
    <div className="p-3 sm:p-8 space-y-4 sm:space-y-8 bg-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Gestión de Colores</h1>
            <p className="text-slate-600 text-lg">Administra la paleta de colores disponible para las chaquetas</p>
          </div>
          <Button 
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium px-6 py-3 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Color
          </Button>
        </div>

        {/* Search */}
        <Card className="bg-white border-slate-200 mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar colores por nombre o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-slate-200 focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Modal */}
        {showForm && (
          <FormularioColor
            color={editingColor}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingColor(null);
            }}
          />
        )}

        {/* Colors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading ? (
            Array(8).fill(0).map((_, i) => (
              <Card key={i} className="bg-white animate-pulse">
                <CardHeader>
                  <div className="h-16 bg-slate-200 rounded mb-4"></div>
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-slate-200 rounded"></div>
                </CardContent>
              </Card>
            ))
          ) : filteredColores.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Palette className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No se encontraron colores
              </h3>
              <p className="text-slate-500 mb-6">
                {searchTerm 
                  ? "Intenta ajustar tu búsqueda" 
                  : "Comienza agregando tu primer color"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Primer Color
                </Button>
              )}
            </div>
          ) : (
            filteredColores.map((color) => (
              <Card key={color.id} className="bg-white border-slate-200 hover:border-purple-300 transition-all duration-200 group hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="w-full h-16 rounded-lg border-2 border-white shadow-inner"
                      style={{ backgroundColor: color.codigo_hex }}
                    />
                    <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(color)}
                        className="hover:bg-purple-50 hover:text-purple-600 transition-all h-8 w-8"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(color)}
                        className="hover:bg-red-50 hover:text-red-600 transition-all h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <CardTitle className="text-lg font-bold text-slate-900 mb-2">
                    {color.nombre}
                  </CardTitle>
                  
                  <div className="flex items-center justify-between">
                    <Badge 
                      variant="outline" 
                      className="font-mono text-xs border-slate-300 text-slate-600"
                    >
                      {color.codigo_hex}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={color.activo}
                        onCheckedChange={() => toggleActivo(color)}
                        size="sm"
                      />
                      <span className="text-xs text-slate-500">
                        {color.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                
                {color.descripcion && (
                  <CardContent>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {color.descripcion}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Summary Stats */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-slate-200 mt-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-slate-900">{colores.length}</div>
                <div className="text-sm text-slate-600">Total Colores</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {colores.filter(c => c.activo).length}
                </div>
                <div className="text-sm text-slate-600">Colores Activos</div>
              </div>
              <div className="md:col-span-1 col-span-2">
                <div className="text-2xl font-bold text-slate-900">
                  {colores.filter(c => !c.activo).length}
                </div>
                <div className="text-sm text-slate-600">Colores Inactivos</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
