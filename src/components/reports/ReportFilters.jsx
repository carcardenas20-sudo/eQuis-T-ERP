import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export default function ReportFilters({ filters, onFilterChange, locations, employees, currentUser, userLocation }) {
  const handleFilterChange = (key, value) => {
    onFilterChange(prev => ({ ...prev, [key]: value }));
  };

  const handleDateRangeChange = (value) => {
    let startDate = '';
    let endDate = '';
    const today = new Date();

    if (value === 'last7') {
      startDate = format(subDays(today, 6), 'yyyy-MM-dd');
      endDate = format(today, 'yyyy-MM-dd');
    } else if (value === 'last30') {
      startDate = format(subDays(today, 29), 'yyyy-MM-dd');
      endDate = format(today, 'yyyy-MM-dd');
    } else if (value === 'thisMonth') {
      startDate = format(startOfMonth(today), 'yyyy-MM-dd');
      endDate = format(endOfMonth(today), 'yyyy-MM-dd');
    } else if (value === 'lastMonth') {
      const lastMonth = subMonths(today, 1);
      startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
    }

    onFilterChange(prev => ({
      ...prev,
      dateRange: value,
      startDate: value === 'custom' ? prev.startDate : startDate,
      endDate: value === 'custom' ? prev.endDate : endDate
    }));
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <Card className="shadow-lg border-0">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Primera fila: Rango de fechas */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Rango de Fechas</label>
              <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last7">Últimos 7 días</SelectItem>
                  <SelectItem value="last30">Últimos 30 días</SelectItem>
                  <SelectItem value="thisMonth">Este mes</SelectItem>
                  <SelectItem value="lastMonth">Mes anterior</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Segunda fila: Fechas personalizadas (solo si es custom) */}
          {filters.dateRange === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Fecha Inicio</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Fecha Fin</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Tercera fila: Sucursal y Vendedor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Sucursal</label>
              {isAdmin ? (
                <Select value={filters.location} onValueChange={(value) => handleFilterChange('location', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Sucursales</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={userLocation?.name || "Cargando..."}
                  disabled
                  className="bg-gray-100 text-gray-700 w-full"
                  title="Solo puedes ver reportes de tu sucursal asignada"
                />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Vendedor</label>
              <Select value={filters.employee} onValueChange={value => handleFilterChange('employee', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos los Vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Vendedores</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.email}>{emp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}