import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageCheck } from "lucide-react";

export default function MyDeliveries() {
  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Mis Entregas</h1>
          <p className="text-slate-600">Historial de productos que he entregado</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5" />
              Entregas Realizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-500">
              <PackageCheck className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No has realizado entregas aún.</p>
              <p className="text-sm">Tus entregas aparecerán aquí una vez que las registres.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}