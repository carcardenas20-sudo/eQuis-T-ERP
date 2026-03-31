
import React, { useState, useEffect, useCallback } from 'react';
import { InventoryMovement } from "@/entities/InventoryMovement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle,
  History,
  RefreshCw
} from "lucide-react";
import { 
  formatColombiaDate,
  getLastNDaysRangeInColombia
} from "../utils/dateUtils";

const movementTypeColors = {
  entry: "bg-green-100 text-green-800",
  exit: "bg-red-100 text-red-800", 
  adjustment: "bg-blue-100 text-blue-800",
  transfer_out: "bg-orange-100 text-orange-800",
  transfer_in: "bg-purple-100 text-purple-800",
  sale: "bg-gray-100 text-gray-800",
  return: "bg-yellow-100 text-yellow-800"
};

const movementTypeLabels = {
  entry: "Entrada",
  exit: "Salida",
  adjustment: "Ajuste",
  transfer_out: "Traslado Salida",
  transfer_in: "Traslado Entrada", 
  sale: "Venta",
  return: "Devolución"
};

const movementTypeIcons = {
  entry: <TrendingUp className="w-4 h-4" />,
  exit: <TrendingDown className="w-4 h-4" />,
  adjustment: <Package className="w-4 h-4" />,
  transfer_out: <TrendingDown className="w-4 h-4" />,
  transfer_in: <TrendingUp className="w-4 h-4" />,
  sale: <TrendingDown className="w-4 h-4" />,
  return: <TrendingUp className="w-4 h-4" />
};

const LoadingSkeleton = () => (
  Array(8).fill(0).map((_, i) => (
    <TableRow key={i}>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
    </TableRow>
  ))
);

export default function InventoryMovements({ products, locations, onRefresh }) {
  const [movements, setMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    movement_type: "all",
    location: "all",
    dateRange: "week"
  });

  const loadMovements = useCallback(async () => {
    setIsLoading(true);
    try {
      let movementFilter = {};
      
      // Aplicar filtro de fecha usando zona horaria de Colombia
      let dateFilter = {};
      
      switch (filters.dateRange) {
        case 'today':
          const todayRange = getLastNDaysRangeInColombia(1);
          dateFilter = { created_date: { $gte: todayRange.start, $lte: todayRange.end } };
          break;
        case 'week':
          const weekRange = getLastNDaysRangeInColombia(7);
          dateFilter = { created_date: { $gte: weekRange.start, $lte: weekRange.end } };
          break;
        case 'month':
          const monthRange = getLastNDaysRangeInColombia(30);
          dateFilter = { created_date: { $gte: monthRange.start, $lte: monthRange.end } };
          break;
        default:
          // No date filter for 'all'
          break;
      }
      
      movementFilter = { ...movementFilter, ...dateFilter };
      
      // Apply other filters
      if (filters.movement_type !== "all") {
        movementFilter.movement_type = filters.movement_type;
      }
      
      if (filters.location !== "all") {
        movementFilter.location_id = filters.location;
      }
      
      const movementsData = await InventoryMovement.filter(movementFilter, "-created_date");
      
      // Apply search filter (client-side)
      let filteredMovements = movementsData;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredMovements = movementsData.filter(movement => 
          movement.product_id?.toLowerCase().includes(searchLower) ||
          movement.reason?.toLowerCase().includes(searchLower) ||
          movement.reference_id?.toLowerCase().includes(searchLower)
        );
      }
      
      setMovements(filteredMovements);
    } catch (error) {
      console.error("Error loading inventory movements:", error);
    }
    setIsLoading(false);
  }, [filters]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const handleDeleteMovement = async (movement) => {
    const movementType = movementTypeLabels[movement.movement_type] || movement.movement_type;
    
    // Customize confirmation message for 'sale' movements to explicitly mention invoice annulment
    const confirmationMessage = movement.movement_type === 'sale'
      ? `¿Estás seguro de que quieres anular esta venta (movimiento de salida de inventario)?\n\n` +
        `Producto: ${movement.product_id}\n` +
        `Cantidad: ${movement.quantity}\n` +
        `Fecha: ${formatColombiaDate(movement.created_date, 'dd/MM/yyyy HH:mm')}\n\n` +
        `ADVERTENCIA: Esto revertirá el impacto en el stock del producto y podría considerarse la anulación de una factura o venta asociada.`
      : `¿Estás seguro de que quieres eliminar este movimiento de ${movementType}?\n\n` +
        `Producto: ${movement.product_id}\n` +
        `Cantidad: ${movement.quantity}\n` +
        `Fecha: ${formatColombiaDate(movement.created_date, 'dd/MM/yyyy HH:mm')}\n\n` +
        `ADVERTENCIA: Esto puede afectar el stock actual del producto.`;

    if (window.confirm(confirmationMessage)) {
      try {
        await InventoryMovement.delete(movement.id);
        loadMovements(); // Reload movements
        onRefresh(); // Refresh parent data (inventory)
        
        // Show success message
        alert("Movimiento eliminado exitosamente. El stock del producto se ha recalculado automáticamente.");
      } catch (error) {
        console.error("Error deleting movement:", error);
        alert("Error al eliminar el movimiento. Inténtalo de nuevo.");
      }
    }
  };

  // Enrich movements with product and location data
  const enrichedMovements = movements.map(movement => {
    const product = products.find(p => p.sku === movement.product_id);
    const location = locations.find(l => l.id === movement.location_id);
    return { ...movement, product, location };
  });

  const totalMovements = enrichedMovements.length;
  const entriesCount = enrichedMovements.filter(m => ['entry', 'transfer_in', 'return'].includes(m.movement_type)).length;
  const exitsCount = enrichedMovements.filter(m => ['exit', 'transfer_out', 'sale'].includes(m.movement_type)).length;
  const adjustmentsCount = enrichedMovements.filter(m => m.movement_type === 'adjustment').length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">Total Movimientos</CardTitle>
              <History className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalMovements}</div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">Entradas</CardTitle>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{entriesCount}</div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">Salidas</CardTitle>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{exitsCount}</div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">Ajustes</CardTitle>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{adjustmentsCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Buscar por producto o motivo..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full"
            />
            
            <Select value={filters.movement_type} onValueChange={(value) => setFilters(prev => ({ ...prev, movement_type: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de movimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Tipos</SelectItem>
                <SelectItem value="entry">Entrada</SelectItem>
                <SelectItem value="exit">Salida</SelectItem>
                <SelectItem value="adjustment">Ajuste</SelectItem>
                <SelectItem value="transfer_out">Traslado Salida</SelectItem>
                <SelectItem value="transfer_in">Traslado Entrada</SelectItem>
                <SelectItem value="sale">Venta</SelectItem>
                <SelectItem value="return">Devolución</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.location} onValueChange={(value) => setFilters(prev => ({ ...prev, location: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Ubicación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Ubicaciones</SelectItem>
                {locations.map(location => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy (Colombia)</SelectItem>
                <SelectItem value="week">Última Semana</SelectItem>
                <SelectItem value="month">Último Mes</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Warning Alert */}
      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-700">
          <strong>Advertencia:</strong> Eliminar movimientos de inventario puede afectar el stock actual de los productos. 
          En el caso de ventas, la eliminación equivale a una anulación, restaurando el inventario. Esta acción es irreversible y debe realizarse con precaución.
        </AlertDescription>
      </Alert>

      {/* Movements Table */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Movimientos de Inventario (Hora Colombia)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadMovements}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refrescar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Producto</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Fecha (Colombia)</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <LoadingSkeleton />
                ) : enrichedMovements.length > 0 ? (
                  enrichedMovements.map(movement => (
                    <TableRow key={movement.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                            {movement.product?.image_url ? (
                              <img src={movement.product.image_url} alt={movement.product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {movement.product?.name || 'Producto desconocido'}
                            </p>
                            <p className="text-xs text-slate-500">SKU: {movement.product_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{movement.location?.name || 'Sin ubicación'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`gap-1 ${movementTypeColors[movement.movement_type] || 'bg-gray-100 text-gray-800'}`}>
                          {movementTypeIcons[movement.movement_type]}
                          {movementTypeLabels[movement.movement_type] || movement.movement_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-semibold ${
                          movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {movement.reason || 'Sin motivo especificado'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-500">
                          {formatColombiaDate(movement.created_date, 'dd/MM/yy HH:mm')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMovement(movement)}
                          className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      No hay movimientos de inventario que coincidan con los filtros aplicados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
