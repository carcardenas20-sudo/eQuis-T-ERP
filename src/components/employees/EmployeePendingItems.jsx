import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function EmployeePendingItems({ pendingUnits, getProductName }) {
  const pendingProducts = Object.entries(pendingUnits);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-orange-600" />
          Material Pendiente de Entrega
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingProducts.length > 0 ? (
          <div className="space-y-3">
            {pendingProducts.map(([reference, units]) => (
              <div key={reference} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900">{getProductName(reference)}</h4>
                    <p className="text-xs text-slate-600">Ref: {reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-orange-700">{units.pending}</p>
                    <p className="text-xs text-orange-600">unidades pendientes</p>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Asignado:</span>
                    <span>{units.dispatched}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entregado:</span>
                    <span>{units.delivered}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">¡Todo al día!</p>
            <p className="text-sm">No hay material pendiente de entrega.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}