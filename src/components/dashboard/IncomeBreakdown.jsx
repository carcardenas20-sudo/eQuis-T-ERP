import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, CreditCard, Smartphone, QrCode, Landmark, Gift, BarChart2 } from "lucide-react";

const paymentMethodDetails = {
  cash: { icon: DollarSign, label: 'Efectivo', color: 'text-green-600' },
  card: { icon: CreditCard, label: 'Tarjeta', color: 'text-blue-600' },
  transfer: { icon: Smartphone, label: 'Transferencia', color: 'text-purple-600' },
  qr: { icon: QrCode, label: 'QR', color: 'text-orange-600' },
  credit: { icon: Landmark, label: 'Crédito', color: 'text-sky-600' },
  courtesy: { icon: Gift, label: 'Cortesía', color: 'text-pink-600' }
};

export default function IncomeBreakdown({ incomeByMethod, isLoading }) {
  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            Ingresos por Método
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-6 w-24 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedMethods = Object.entries(incomeByMethod).sort(([, a], [, b]) => b - a);

  return (
    <Card className="shadow-lg border-0 h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          Ingresos por Método de Pago
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedMethods.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No hay ingresos registrados hoy.</p>
        ) : (
          <div className="space-y-4">
            {sortedMethods.map(([method, amount]) => {
              const details = paymentMethodDetails[method] || { 
                icon: DollarSign, 
                label: method, 
                color: 'text-gray-600'
              };
              const Icon = details.icon;

              return (
                <div key={method} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${details.color.replace('text-', 'bg-').replace('-600', '-100')}`}>
                      <Icon className={`w-5 h-5 ${details.color}`} />
                    </div>
                    <span className="font-medium text-slate-800">{details.label}</span>
                  </div>
                  <span className="font-semibold text-slate-900 text-lg">
                    ${(amount || 0).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}