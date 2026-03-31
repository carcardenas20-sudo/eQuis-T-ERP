import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus } from "lucide-react";

export default function PaymentRequest() {
  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Solicitar Pago</h1>
            <p className="text-slate-600">Solicita pagos por tu trabajo realizado</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Solicitud
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Mis Solicitudes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-500">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No hay solicitudes de pago.</p>
              <p className="text-sm">Crea una solicitud cuando tengas trabajo por cobrar.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}