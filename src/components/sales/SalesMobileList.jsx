import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, Calendar, DollarSign, User, RefreshCw } from "lucide-react";

const statusConfig = {
  completed: { label: "Completada", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
  returned: { label: "Devuelta", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
  credit: { label: "Crédito", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" }
};

export default function SalesMobileList({ sales, onViewDetail, onEditSale, onDeleteSale, isLoading, onRefresh }) {
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
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                <div className="flex gap-1">
                  <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        No se encontraron ventas
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

      {sales.map((sale) => {
        const status = statusConfig[sale.status] || statusConfig.completed;
        const saleDate = new Date(sale.sale_date || sale.created_date);
        
        return (
          <Card key={sale.id} className="shadow-md dark:bg-slate-800 dark:border-slate-700">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {sale.customer_name || "Cliente General"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Calendar className="w-3 h-3" />
                    <span>{saleDate.toLocaleDateString()}</span>
                  </div>
                </div>
                <Badge className={status.color}>
                  {status.label}
                </Badge>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    ${sale.total_amount?.toLocaleString() || "0"}
                  </span>
                </div>
                
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewDetail(sale)}
                    className="h-8 w-8 select-none"
                  >
                    <Eye className="w-4 h-4 select-none" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEditSale(sale)}
                    className="h-8 w-8 select-none"
                  >
                    <Edit className="w-4 h-4 select-none" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteSale(sale)}
                    className="h-8 w-8 text-red-600 dark:text-red-400 select-none"
                  >
                    <Trash2 className="w-4 h-4 select-none" />
                  </Button>
                </div>
              </div>

              {sale.invoice_number && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Factura: #{sale.invoice_number}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}