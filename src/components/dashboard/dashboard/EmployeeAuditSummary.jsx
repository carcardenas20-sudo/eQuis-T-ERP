import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, TruckIcon, Package, DollarSign } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export default function EmployeeAuditSummary({ employees, deliveries, dispatches, payments, products, purchases = [] }) {
  const getDeliveryAmount = (d) => {
    if (d.total_amount) return d.total_amount;
    if (d.items && d.items.length > 0) return d.items.reduce((s, item) => s + (item.total_amount || (item.quantity * item.unit_price) || 0), 0);
    if (d.quantity && d.unit_price) return d.quantity * d.unit_price;
    return 0;
  };

  const calculateEmployeeBalance = (employeeId) => {
    const empDeliveries = deliveries.filter(d => d.employee_id === employeeId);
    const empDispatches = dispatches.filter(d => d.employee_id === employeeId);
    const empPayments = payments.filter(p => p.employee_id === employeeId);

    // Pagos vinculados a entregas específicas (sistema nuevo)
    const deliveryPaidAmounts = {};
    empPayments.forEach(p => {
      if (p.delivery_payments && p.delivery_payments.length > 0) {
        p.delivery_payments.forEach(dp => {
          deliveryPaidAmounts[dp.delivery_id] = (deliveryPaidAmounts[dp.delivery_id] || 0) + dp.amount;
        });
      }
    });

    // Entregas pagadas completamente (sistema antiguo)
    const paidDeliveryIds = new Set();
    empPayments.forEach(p => {
      if (p.payment_type === 'pago_completo' && p.delivery_ids) {
        p.delivery_ids.forEach(id => paidDeliveryIds.add(id));
      }
    });

    // Calcular pendiente por entrega
    const pendingDeliveries = [];
    empDeliveries.forEach(delivery => {
      if (delivery.status === 'pagado' || paidDeliveryIds.has(delivery.id)) return;
      // Excluir entregas generadas por compra interna
      if (delivery.notes && delivery.notes.includes('Compra empleado')) return;
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

    // Aplicar pagos sin entrega vinculada (avances genéricos) cronológicamente
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

    const rawPendingBalance = pendingDeliveries.reduce((sum, d) => sum + Math.max(0, d.pending_amount), 0);
    const totalEarned = empDeliveries.reduce((sum, d) => sum + getDeliveryAmount(d), 0);
    const totalPaid = empPayments.reduce((sum, p) => sum + p.amount, 0);

    // Descontar compras con descuento_saldo
    const purchaseDiscounts = purchases
      .filter(p => p.employee_id === employeeId && p.payment_method === 'descuento_saldo')
      .reduce((sum, p) => sum + p.total_amount, 0);

    const pendingBalance = rawPendingBalance - purchaseDiscounts;

    const pendingByProduct = {};
    empDispatches.forEach(dispatch => {
      if (!pendingByProduct[dispatch.product_reference]) {
        pendingByProduct[dispatch.product_reference] = { dispatched: 0, delivered: 0 };
      }
      pendingByProduct[dispatch.product_reference].dispatched += dispatch.quantity;
    });

    empDeliveries.forEach(delivery => {
      if (delivery.items && delivery.items.length > 0) {
        delivery.items.forEach(item => {
          if (pendingByProduct[item.product_reference]) {
            pendingByProduct[item.product_reference].delivered += item.quantity;
          }
        });
      } else if (delivery.product_reference) {
        if (pendingByProduct[delivery.product_reference]) {
          pendingByProduct[delivery.product_reference].delivered += delivery.quantity;
        }
      }
    });

    const pendingUnits = Object.keys(pendingByProduct)
      .filter(ref => pendingByProduct[ref].dispatched > pendingByProduct[ref].delivered)
      .reduce((total, ref) => total + (pendingByProduct[ref].dispatched - pendingByProduct[ref].delivered), 0);

    return {
      totalEarned,
      totalPaid,
      pendingBalance,
      pendingUnits,
      totalDispatches: empDispatches.length,
      totalDeliveries: empDeliveries.length,
      totalPayments: empPayments.length
    };
  };

  // Deduplicar por employee_id para evitar dobles si hay registros duplicados en BD
  const uniqueEmployees = Object.values(
    employees
      .filter(emp => emp.is_active)
      .reduce((acc, emp) => {
        if (!acc[emp.employee_id]) acc[emp.employee_id] = emp;
        return acc;
      }, {})
  );

  const employeesWithBalance = uniqueEmployees
    .map(emp => ({
      ...emp,
      balance: calculateEmployeeBalance(emp.employee_id)
    }))
    .sort((a, b) => b.balance.pendingBalance - a.balance.pendingBalance);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          Resumen de Auditoría por Empleado
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[600px] overflow-y-auto">
        {employeesWithBalance.length > 0 ? (
          <div className="space-y-4">
            {employeesWithBalance.map(emp => (
              <Link 
                key={emp.id} 
                to={createPageUrl('EmployeeProfile') + `?id=${emp.employee_id}`}
                className="block"
              >
                <div className="p-4 bg-slate-50 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{emp.name}</h3>
                      <p className="text-xs text-slate-500">ID: {emp.employee_id}</p>
                    </div>
                    {emp.balance.pendingBalance > 0 && (
                      <Badge className="bg-orange-100 text-orange-800">
                        ${emp.balance.pendingBalance.toLocaleString()} pendiente
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-blue-700">
                      <TruckIcon className="w-4 h-4" />
                      <span>{emp.balance.totalDispatches} despachos</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
                      <Package className="w-4 h-4" />
                      <span>{emp.balance.totalDeliveries} entregas</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-700">
                      <DollarSign className="w-4 h-4" />
                      <span>{emp.balance.totalPayments} pagos</span>
                    </div>
                  </div>

                  {emp.balance.pendingUnits > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-600">
                        📦 {emp.balance.pendingUnits} unidades pendientes por entregar
                      </p>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">
            ✓ Todos los empleados al día
          </p>
        )}
      </CardContent>
    </Card>
  );
}