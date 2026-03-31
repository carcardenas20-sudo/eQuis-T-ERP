import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, User } from 'lucide-react';

export default function PendingPayments({ employees, deliveries, payments, purchases = [] }) {
  const getDeliveryAmount = (d) => {
    if (d.total_amount) return d.total_amount;
    if (d.items && d.items.length > 0) return d.items.reduce((s, item) => s + (item.total_amount || (item.quantity * item.unit_price) || 0), 0);
    if (d.quantity && d.unit_price) return d.quantity * d.unit_price;
    return 0;
  };

  const calcEmployeePending = (employeeId) => {
    const empDeliveries = deliveries.filter(d => d.employee_id === employeeId);
    const empPayments = payments.filter(p => p.employee_id === employeeId);

    const deliveryPaidAmounts = {};
    empPayments.forEach(p => {
      if (p.delivery_payments && p.delivery_payments.length > 0) {
        p.delivery_payments.forEach(dp => {
          deliveryPaidAmounts[dp.delivery_id] = (deliveryPaidAmounts[dp.delivery_id] || 0) + dp.amount;
        });
      }
    });

    const paidDeliveryIds = new Set();
    empPayments.forEach(p => {
      if (p.payment_type === 'pago_completo' && p.delivery_ids) {
        p.delivery_ids.forEach(id => paidDeliveryIds.add(id));
      }
    });

    const pendingDeliveries = [];
    empDeliveries.forEach(delivery => {
      if (delivery.status === 'pagado' || paidDeliveryIds.has(delivery.id)) return;
      const earned = getDeliveryAmount(delivery);
      const paid = deliveryPaidAmounts[delivery.id] || 0;
      const pending = earned - paid;
      if (pending > 0) pendingDeliveries.push({ ...delivery, pending_amount: pending });
    });

    // Avances con delivery_ids (datos históricos): aplicar monto a esas entregas específicas
    const linkedAvances = empPayments
      .filter(p => p.payment_type !== 'pago_completo' && (!p.delivery_payments || p.delivery_payments.length === 0) && p.delivery_ids && p.delivery_ids.length > 0)
      .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    linkedAvances.forEach(payment => {
      let remaining = payment.amount;
      const linkedDeliveries = pendingDeliveries.filter(d => payment.delivery_ids.includes(d.id));
      linkedDeliveries.forEach(d => {
        if (remaining <= 0) return;
        const apply = Math.min(remaining, d.pending_amount);
        d.pending_amount -= apply;
        remaining -= apply;
      });
    });

    const genericPayments = empPayments
      .filter(p => (!p.delivery_payments || p.delivery_payments.length === 0) && (!p.delivery_ids || p.delivery_ids.length === 0))
      .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    pendingDeliveries.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
    genericPayments.forEach(payment => {
      let remaining = payment.amount;
      pendingDeliveries.forEach(d => {
        if (remaining <= 0) return;
        const apply = Math.min(remaining, d.pending_amount);
        d.pending_amount -= apply;
        remaining -= apply;
      });
    });

    const rawPending = pendingDeliveries.reduce((sum, d) => sum + Math.max(0, d.pending_amount), 0);

    // Descontar compras por descuento_saldo
    const purchaseDiscounts = purchases
      .filter(p => p.employee_id === employeeId && p.payment_method === 'descuento_saldo')
      .reduce((sum, p) => sum + p.total_amount, 0);

    return Math.max(0, rawPending - purchaseDiscounts);
  };

  const { totalPendingAmount, pendingPayments } = useMemo(() => {
    if (!employees || !deliveries || !payments) {
      return { totalPendingAmount: 0, pendingPayments: [] };
    }

    // Deduplicar por employee_id para evitar dobles si hay registros duplicados en BD
    const uniqueEmployees = Object.values(
      employees.reduce((acc, emp) => {
        if (!acc[emp.employee_id]) acc[emp.employee_id] = emp;
        return acc;
      }, {})
    );

    const pendingList = uniqueEmployees
      .map(emp => ({ employeeName: emp.name, amount: calcEmployeePending(emp.employee_id) }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const totalAmount = pendingList.reduce((sum, item) => sum + item.amount, 0);
    return { totalPendingAmount: totalAmount, pendingPayments: pendingList };
  }, [employees, deliveries, payments]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-orange-600" />
          Saldo Pendiente por Pagar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold text-orange-700">${totalPendingAmount.toLocaleString()}</p>
        <p className="text-sm text-slate-500 mb-4">
          Total pendiente después de descontar avances realizados.
        </p>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Todos los Empleados con Saldo ({pendingPayments.length}):</h4>
          {pendingPayments.length > 0 ? (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {pendingPayments.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-md">
                  <span className="flex items-center gap-2"><User className="w-4 h-4 text-slate-500"/>{item.employeeName}</span>
                  <span className="font-bold text-orange-800">${item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No hay pagos pendientes.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}