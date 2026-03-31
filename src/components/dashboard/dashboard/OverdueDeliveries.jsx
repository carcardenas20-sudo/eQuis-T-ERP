import React from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OverdueDeliveries({ employees, dispatches, deliveries }) {
  const today = new Date();

  // Para cada empleado activo, calcular unidades pendientes y fecha del último despacho sin retorno
  const alerts = employees
    .filter(e => e.is_active !== false)
    .map(emp => {
      const empId = emp.employee_id;

      // Total despachado por referencia
      const dispatched = {};
      dispatches
        .filter(d => d.employee_id === empId)
        .forEach(d => {
          dispatched[d.product_reference] = (dispatched[d.product_reference] || 0) + (d.quantity || 0);
        });

      // Total entregado (solo entregas no-borrador)
      const delivered = {};
      deliveries
        .filter(d => d.employee_id === empId && d.status !== "borrador")
        .forEach(d => {
          if (d.items && d.items.length > 0) {
            d.items.forEach(item => {
              delivered[item.product_reference] = (delivered[item.product_reference] || 0) + (item.quantity || 0);
            });
          } else if (d.product_reference) {
            delivered[d.product_reference] = (delivered[d.product_reference] || 0) + (d.quantity || 0);
          }
        });

      // Pendiente total
      const pendingUnits = Object.entries(dispatched).reduce((sum, [ref, qty]) => {
        return sum + Math.max(0, qty - (delivered[ref] || 0));
      }, 0);

      if (pendingUnits <= 0) return null;

      // Fecha del último despacho sin entregar (la más reciente)
      const lastDispatch = dispatches
        .filter(d => d.employee_id === empId)
        .map(d => d.dispatch_date)
        .sort()
        .reverse()[0];

      const diasPendiente = lastDispatch
        ? Math.floor((today - new Date(lastDispatch + "T00:00:00")) / (1000 * 60 * 60 * 24))
        : null;

      return { emp, pendingUnits, diasPendiente };
    })
    .filter(Boolean)
    .sort((a, b) => (b.diasPendiente || 0) - (a.diasPendiente || 0));

  if (alerts.length === 0) return null;

  const getColor = (dias) => {
    if (dias === null) return { bg: "bg-slate-50", text: "text-slate-500", badge: "bg-slate-100 text-slate-600" };
    if (dias >= 14) return { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100 text-red-700" };
    if (dias >= 7) return { bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-100 text-amber-700" };
    return { bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" };
  };

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-700">
          <AlertTriangle className="w-5 h-5" />
          Operarios con material sin retornar
          <span className="ml-auto text-sm font-normal bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map(({ emp, pendingUnits, diasPendiente }) => {
          const c = getColor(diasPendiente);
          return (
            <div key={emp.id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${c.bg}`}>
              <div>
                <p className={`text-sm font-semibold ${c.text}`}>{emp.name}</p>
                {emp.phone && <p className="text-xs text-slate-400">{emp.phone}</p>}
              </div>
              <div className="flex items-center gap-2 text-right">
                <div>
                  <p className={`text-sm font-bold ${c.text}`}>{pendingUnits} uds</p>
                  {diasPendiente !== null && (
                    <p className="text-xs text-slate-400 flex items-center gap-0.5 justify-end">
                      <Clock className="w-3 h-3" />
                      {diasPendiente === 0 ? "hoy" : `${diasPendiente}d`}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
                  {diasPendiente === null ? "—" : diasPendiente >= 14 ? "urgente" : diasPendiente >= 7 ? "atrasado" : "reciente"}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}