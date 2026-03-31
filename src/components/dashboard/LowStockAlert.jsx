import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LowStockAlert({ products, isLoading }) {
  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Alerta de Stock Bajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Alerta de Stock Bajo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <Alert className="border-green-200 bg-green-50">
            <Package className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              ¡Perfecto! Todos los productos tienen stock suficiente.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {products.map(({ product, inventory }) => (
              <div key={`${product.id}-${inventory.location_id}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{product.name}</p>
                    <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">
                    {inventory.current_stock} uds
                  </Badge>
                  <span className="text-xs text-slate-500">
                    Min: {product.minimum_stock}
                  </span>
                </div>
              </div>
            ))}
            
            {products.length >= 10 && (
              <p className="text-xs text-slate-500 text-center pt-2">
                Mostrando los primeros 10 productos con stock bajo
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}