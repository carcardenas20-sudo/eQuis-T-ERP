import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Calendar, User, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function PaymentsHistory({ payments, employees, onDelete }) {
  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.employee_id === employeeId);
    return employee ? employee.name : employeeId;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Historial de Pagos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length > 0 ? (
          <div className="space-y-4">
            {payments.map(payment => (
              <div key={payment.id} className="p-4 border rounded-lg hover:bg-white transition-colors">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                  <div className="mb-2 sm:mb-0">
                    <p className="font-bold text-lg text-green-700">${payment.amount.toLocaleString()}</p>
                    <p className="text-sm text-slate-600 font-medium flex items-center gap-1">
                      <User className="w-3 h-3"/>{getEmployeeName(payment.employee_id)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                    <div className="text-sm text-slate-500 flex flex-col sm:items-end gap-1">
                       <p className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{format(new Date(payment.payment_date), 'dd/MM/yyyy')}</p>
                       <Badge variant={payment.payment_type === 'pago_completo' ? 'default' : 'secondary'}>
                          {payment.payment_type === 'pago_completo' ? 'Pago Completo' : 'Avance'}
                       </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(payment)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {payment.description && (
                   <p className="text-xs text-slate-500 mt-2 pt-2 border-t">{payment.description}</p>
                )}
                {payment.delivery_payments && payment.delivery_payments.length > 0 && (
                   <div className="mt-2 pt-2 border-t">
                     <p className="text-xs font-medium text-slate-700 mb-1">Distribución del pago:</p>
                     <div className="space-y-1">
                       {payment.delivery_payments.map((dp, idx) => (
                         <p key={idx} className="text-xs text-slate-600">• ${dp.amount.toLocaleString()} aplicados a entrega</p>
                       ))}
                     </div>
                   </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p>No hay pagos registrados.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}