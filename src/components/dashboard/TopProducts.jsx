import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export default function TopProducts({ products, isLoading }) {
  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Productos Top
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxQuantity = Math.max(...products.map(p => p.quantity), 1);

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <Package className="w-5 h-5 text-purple-600" />
          Productos Más Vendidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No hay datos de ventas aún</p>
          ) : (
            products.map((item, index) => (
              <div key={item.product_id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                  index === 0 ? 'bg-yellow-500' :
                  index === 1 ? 'bg-gray-400' :
                  index === 2 ? 'bg-orange-600' : 'bg-slate-400'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {item.product?.name || 'Producto'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress 
                      value={(item.quantity / maxQuantity) * 100} 
                      className="flex-1 h-2"
                    />
                    <span className="text-xs text-slate-500 min-w-fit">
                      {item.quantity} uds
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">
                    ${(item.revenue || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}