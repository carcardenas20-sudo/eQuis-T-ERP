import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, User } from 'lucide-react';

export default function PendingDeliveriesByEmployee({ employees, products, deliveries, dispatches }) {
  const { totalPendingUnits, allPendingItems } = useMemo(() => {
    const pendingByEmployee = {};

    // 1. Calcular lo despachado por empleado (sumar todos los productos)
    dispatches.forEach(dispatch => {
      if (!pendingByEmployee[dispatch.employee_id]) {
        pendingByEmployee[dispatch.employee_id] = { dispatched: 0, delivered: 0 };
      }
      pendingByEmployee[dispatch.employee_id].dispatched += dispatch.quantity;
    });

    // 2. Calcular lo entregado por empleado (sumar todos los productos)
    deliveries.forEach(delivery => {
      if (pendingByEmployee[delivery.employee_id]) {
        if (delivery.items && delivery.items.length > 0) {
          delivery.items.forEach(item => {
            pendingByEmployee[delivery.employee_id].delivered += item.quantity;
          });
        } else {
          pendingByEmployee[delivery.employee_id].delivered += (delivery.quantity || 0);
        }
      }
    });

    // 3. Calcular pendientes por empleado y enriquecer con nombres
    const allPendingItems = Object.entries(pendingByEmployee)
      .map(([employeeId, data]) => {
        const pending = data.dispatched - data.delivered;
        if (pending <= 0) return null;

        const employee = employees.find(e => e.employee_id === employeeId);
        return {
          employeeName: employee ? employee.name : employeeId,
          employeeId: employeeId,
          quantity: pending
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.quantity - a.quantity); // Ordenar de mayor a menor

    const total = allPendingItems.reduce((sum, item) => sum + item.quantity, 0);

    return { totalPendingUnits: total, allPendingItems: allPendingItems };
  }, [employees, deliveries, dispatches]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          Unidades Pendientes por Entregar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold text-purple-700">{totalPendingUnits.toLocaleString()}</p>
        <p className="text-sm text-slate-500 mb-4">
          Total de material que los empleados han recibido pero aún no han entregado como producto terminado.
        </p>
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Empleados con Material Pendiente ({allPendingItems.length}):</h4>
          {allPendingItems.length > 0 ? (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {allPendingItems.map((item, index) => (
                <div key={index} className="p-3 bg-slate-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <User className="w-4 h-4 text-slate-500"/>
                      {item.employeeName}
                    </span>
                    <span className="text-lg font-bold text-purple-800">
                      {item.quantity.toLocaleString()} unidades
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    ID: {item.employeeId}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No hay unidades pendientes de entrega.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}