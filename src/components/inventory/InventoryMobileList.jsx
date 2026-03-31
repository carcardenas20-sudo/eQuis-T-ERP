import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Package, MapPin, TrendingDown, TrendingUp, RefreshCw } from "lucide-react";

export default function InventoryMobileList({ inventory, onStockAdjustment, isLoading, onRefresh }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (window.scrollY === 0 && startY > 0) {
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, Math.min(currentY - startY, 100));
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60 && onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
    setStartY(0);
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4 pb-20">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse dark:bg-slate-800 dark:border-slate-700">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
                <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        No se encontraron productos en inventario
      </div>
    );
  }

  return (
    <div 
      className="space-y-3 p-4 pb-20 relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      {pullDistance > 0 && (
        <div 
          className="flex items-center justify-center py-2 transition-opacity"
          style={{ 
            opacity: pullDistance / 60,
            transform: `translateY(${Math.min(pullDistance - 60, 0)}px)`
          }}
        >
          <RefreshCw 
            className={`w-5 h-5 text-blue-600 dark:text-blue-400 ${
              isRefreshing || pullDistance > 60 ? 'animate-spin' : ''
            }`} 
          />
        </div>
      )}

      {inventory.map((item) => {
        const isLowStock = item.current_stock <= (item.product?.minimum_stock || 5) && item.current_stock > 0;
        const isOutOfStock = item.current_stock === 0;
        
        return (
          <Card key={item.id} className="shadow-md dark:bg-slate-800 dark:border-slate-700">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.product?.name || "Producto Desconocido"}
                    </span>
                  </div>
                  {item.product?.sku && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      SKU: {item.product.sku}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{item.location?.name || "Sin Ubicación"}</span>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStockAdjustment(item)}
                  className="select-none"
                >
                  <Edit className="w-3 h-3 mr-1 select-none" />
                  Ajustar
                </Button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  {isOutOfStock ? (
                    <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                  ) : isLowStock ? (
                    <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  )}
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {item.current_stock || 0}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">unidades</span>
                </div>
                
                <div className="flex gap-2">
                  {isOutOfStock && (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                      Sin Stock
                    </Badge>
                  )}
                  {isLowStock && (
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                      Stock Bajo
                    </Badge>
                  )}
                </div>
              </div>

              {item.product?.base_cost && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Valor: ${(item.current_stock * item.product.base_cost).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}