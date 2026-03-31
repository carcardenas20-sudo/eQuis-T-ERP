import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function BestSellingProducts({ products, isLoading, period }) {
  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle>Productos Más Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxRevenue = Math.max(...products.map(p => p.revenue), 1);

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-600" />
          Productos Más Vendidos - Últimos {period} días
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No hay datos de productos en el período seleccionado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((item, index) => (
              <div 
                key={item.product_id} 
                className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                  index === 0 ? 'bg-yellow-500' :
                  index === 1 ? 'bg-gray-400' :
                  index === 2 ? 'bg-orange-600' : 'bg-slate-400'
                }`}>
                  {index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-slate-900 truncate">
                        {item.product?.name || 'Producto'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        SKU: {item.product?.sku || item.product_id}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-bold text-green-600">
                        ${item.revenue.toLocaleString()}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {item.quantity} vendidos
                      </Badge>
                    </div>
                  </div>
                  
                  <Progress 
                    value={(item.revenue / maxRevenue) * 100} 
                    className="h-2"
                  />
                  
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex gap-2">
                      {item.product?.variant_attributes?.color && (
                        <Badge variant="outline" className="text-xs">
                          {item.product.variant_attributes.color}
                        </Badge>
                      )}
                      {item.product?.variant_attributes?.size && (
                        <Badge variant="outline" className="text-xs">
                          {item.product.variant_attributes.size}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {((item.revenue / maxRevenue) * 100).toFixed(1)}% del top
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}