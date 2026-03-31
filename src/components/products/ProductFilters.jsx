import React from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Building2 } from "lucide-react";

const CATEGORIES = ["all", "chaquetas_hombre", "chaquetas_mujer", "chaquetas_niños", "accesorios", "materia_prima"];

export default function ProductFilters({ filters, onFilterChange, locations = [] }) {
  const handleFilter = (key, value) => {
    onFilterChange(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white rounded-xl shadow-md border p-4 space-y-3">
      {/* Row 1: Search + Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar producto..."
            value={filters.search}
            onChange={e => handleFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filters.location || 'all'} onValueChange={value => handleFilter('location', value)}>
          <SelectTrigger>
            <Building2 className="w-4 h-4 mr-2 text-slate-400 flex-shrink-0" />
            <SelectValue placeholder="Todas las sucursales" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sucursales</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Category + Status + Stock */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select value={filters.category} onValueChange={value => handleFilter('category', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat === 'all' ? 'Todas las Categorías' : cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={value => handleFilter('status', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Estados</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="inactive">Inactivo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.stock} onValueChange={value => handleFilter('stock', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el Stock</SelectItem>
            <SelectItem value="in_stock">En Stock</SelectItem>
            <SelectItem value="out_of_stock">Sin Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
