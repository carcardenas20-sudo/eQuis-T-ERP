import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const getStockBadgeColor = (currentStock, minimumStock = 5) => {
  if (currentStock === 0) return "bg-red-100 text-red-800";
  if (currentStock <= minimumStock) return "bg-orange-100 text-orange-800";
  return "bg-green-100 text-green-800";
};

export default function InventoryTable({ inventory, onStockAdjustment, isLoading }) {
  if (isLoading) {
    return (
      <div className="space-y-3 md:hidden">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 animate-pulse">
            <div className="flex gap-3">
              <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
              <div className="flex-1"><Skeleton className="h-4 w-36 mb-2" /><Skeleton className="h-3 w-20" /></div>
            </div>
          </div>
        ))}
        <div className="hidden md:block overflow-x-auto rounded-lg border">
          <Table><TableBody>
            {Array(6).fill(0).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-12 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-8 w-20 ml-auto rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        </div>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 border rounded-xl bg-white">
        <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>No hay registros de inventario disponibles</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {inventory.map(item => (
          <div key={`${item.product_id}-${item.location_id}`} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {item.product?.image_url ? (
                  <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{item.product?.name || 'Producto desconocido'}</p>
                <p className="text-xs text-slate-500">SKU: {item.product_id}</p>
                <p className="text-xs text-slate-500">{item.location?.name || 'Sin ubicación'}</p>
              </div>
              <Badge className={`flex-shrink-0 ${getStockBadgeColor(item.current_stock, item.product?.minimum_stock)}`}>
                {item.current_stock} uds
              </Badge>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Mín: {item.product?.minimum_stock || 5} uds
                {item.last_movement_date && <> · {new Date(item.last_movement_date).toLocaleDateString()}</>}
              </span>
              <Button variant="outline" size="sm" onClick={() => onStockAdjustment(item)} className="gap-1 h-8 text-xs">
                <Edit className="w-3 h-3" /> Ajustar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Producto</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead className="text-center">Stock Actual</TableHead>
              <TableHead className="text-center">Stock Mínimo</TableHead>
              <TableHead className="text-right">Último Movimiento</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map(item => (
              <TableRow key={`${item.product_id}-${item.location_id}`} className="hover:bg-slate-50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                      {item.product?.image_url ? (
                        <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{item.product?.name || 'Producto desconocido'}</p>
                      <p className="text-xs text-slate-500">SKU: {item.product_id}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-medium">{item.location?.name || 'Sin ubicación'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={getStockBadgeColor(item.current_stock, item.product?.minimum_stock)}>
                    {item.current_stock} uds
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-slate-600">{item.product?.minimum_stock || 5} uds</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm text-slate-500">
                    {item.last_movement_date ?
                      new Date(item.last_movement_date).toLocaleDateString() :
                      'Sin movimientos'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => onStockAdjustment(item)} className="gap-2">
                    <Edit className="w-4 h-4" /> Ajustar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
