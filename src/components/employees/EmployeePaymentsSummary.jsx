import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function EmployeePaymentsSummary({ payments }) {
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const recentPayments = payments.slice(0, 5); // Últimos 5 pagos

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Resumen de Pagos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-green-50 rounded-lg text-center">
          <p className="text-sm text-green-700">Total Recibido</p>
          <p className="text-2xl font-bold text-green-800">${totalPayments.toLocaleString()}</p>
        </div>

        {recentPayments.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-medium text-slate-900 text-sm">Últimos Pagos</h4>
            {recentPayments.map((payment, index) => (
              <div key={payment.id || index} className="p-2 bg-slate-50 rounded border">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-slate-900">${payment.amount.toLocaleString()}</p>
                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(payment.payment_date), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <Badge variant={payment.payment_type === 'pago_completo' ? 'default' : 'secondary'} className="text-xs">
                    {payment.payment_type === 'pago_completo' ? 'Completo' : 'Avance'}
                  </Badge>
                </div>
                {payment.description && (
                  <p className="text-xs text-slate-500 mt-1">{payment.description}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No hay pagos registrados.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}