import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function ProductionStats({ employees, deliveries, dispatches }) {
  const stats = useMemo(() => {
    const seen = new Set();
    const uniqueEmployees = employees
      .filter(e => e.is_active && e.employee_id)
      .filter(e => {
        if (seen.has(e.employee_id)) return false;
        seen.add(e.employee_id);
        return true;
      });

    return uniqueEmployees
      .map(emp => {
        const empDispatches = dispatches
          .filter(d => d.employee_id === emp.employee_id)
          .map(d => ({ ...d, dispatch_date: (d.dispatch_date || '').slice(0, 10) }))
          .sort((a, b) => b.dispatch_date.localeCompare(a.dispatch_date));

        const empDeliveries = deliveries
          .filter(d => d.employee_id === emp.employee_id)
          .map(d => ({ ...d, delivery_date: (d.delivery_date || '').slice(0, 10) }))
          .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date));

        const getUnits = (d) => {
          if (d.items?.length > 0) return d.items.reduce((s, i) => s + (i.quantity || 0), 0);
          return d.quantity || 0;
        };

        // Promedio últimos 28 días ÷ 4 (cero también cuenta si no entregó)
        const today = new Date();
        const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
        const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];
        const last28Units = empDeliveries
          .filter(d => d.delivery_date >= fourWeeksAgoStr)
          .reduce((s, d) => s + getUnits(d), 0);
        const weeklyAvg = Math.round((last28Units / 4) * 10) / 10;

        // Fechas de despacho ordenadas desc
        const dispatchDates = [...new Set(empDispatches.map(d => d.dispatch_date))].sort((a, b) => b.localeCompare(a));
        const lastDispatchDate = dispatchDates[0] || null;
        const penultimateDate = dispatchDates[1] || null;

        // Última entrega (fecha más reciente de entrega)
        const lastDeliveryDateRaw = empDeliveries.length > 0 ? empDeliveries[0].delivery_date : null;

        // Si el último despacho es más reciente que la última entrega → no entregó ese ciclo
        const noEntrego = lastDispatchDate && (!lastDeliveryDateRaw || lastDispatchDate > lastDeliveryDateRaw);

        // Unidades de la última entrega
        const lastDeliveryUnits = noEntrego
          ? 0
          : (lastDeliveryDateRaw
              ? empDeliveries.filter(d => d.delivery_date === lastDeliveryDateRaw).reduce((s, d) => s + getUnits(d), 0)
              : null);
        const lastDeliveryDate = lastDeliveryDateRaw || lastDispatchDate;

        // Referencia de despacho para el %:
        // - Si no entregó: comparar 0 vs el último despacho
        // - Si sí entregó: comparar última entrega vs penúltimo despacho
        const refDispatchDate = noEntrego ? lastDispatchDate : penultimateDate;
        const penultimateDispatchUnits = refDispatchDate
          ? empDispatches.filter(d => d.dispatch_date === refDispatchDate).reduce((s, d) => s + (d.quantity || 0), 0)
          : null;
        const penultimateDispatchDate = refDispatchDate;

        return { id: emp.employee_id, name: emp.name, weeklyAvg, lastDeliveryUnits, lastDeliveryDate, penultimateDispatchUnits, penultimateDispatchDate };
      })
      .sort((a, b) => {
        const pctA = (a.lastDeliveryUnits !== null && a.penultimateDispatchUnits > 0) ? (a.lastDeliveryUnits / a.penultimateDispatchUnits) : null;
        const pctB = (b.lastDeliveryUnits !== null && b.penultimateDispatchUnits > 0) ? (b.lastDeliveryUnits / b.penultimateDispatchUnits) : null;
        if (pctA === null && pctB === null) return a.name.localeCompare(b.name, 'es');
        if (pctA === null) return 1;
        if (pctB === null) return -1;
        return pctA - pctB;
      });
  }, [employees, deliveries, dispatches]);

  const totalWeeklyAvg = stats.reduce((s, e) => s + (e.weeklyAvg || 0), 0);

  const getRateColor = (rate) => {
    if (rate === null) return { bar: "bg-slate-300", text: "text-slate-400" };
    if (rate >= 85) return { bar: "bg-emerald-500", text: "text-emerald-700" };
    if (rate >= 65) return { bar: "bg-amber-400", text: "text-amber-700" };
    return { bar: "bg-red-400", text: "text-red-700" };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Producción por Operario
        </CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">
          Promedio semanal (últimas 4 sem.) · Tasa de producción = entregado ÷ despachado
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {stats.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Sin datos suficientes.</div>
        ) : (
          <>
            {/* Vista móvil: tarjetas */}
            <div className="sm:hidden divide-y divide-slate-100">
              {stats.map(emp => {
                const pct = (emp.lastDeliveryUnits !== null && emp.penultimateDispatchUnits > 0)
                  ? Math.round((emp.lastDeliveryUnits / emp.penultimateDispatchUnits) * 100)
                  : null;
                const color = pct === null ? 'text-slate-400' : pct >= 85 ? 'text-emerald-700' : pct >= 65 ? 'text-amber-600' : 'text-red-600';
                return (
                  <div key={emp.id} className="px-4 py-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{emp.name}</p>
                        <p className="text-xs text-slate-400">{emp.id}</p>
                      </div>
                      <span className={`font-bold text-xl ${color}`}>
                        {pct !== null ? `${pct}%` : '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-slate-400">Prom./sem.</p>
                        <p className="font-bold text-blue-700">{emp.weeklyAvg || '—'}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-slate-400">Últ. Entrega</p>
                        <p className="font-bold text-green-700">{emp.lastDeliveryUnits !== null ? emp.lastDeliveryUnits : '—'}</p>
                        {emp.lastDeliveryDate && <p className="text-slate-400" style={{fontSize:'10px'}}>{emp.lastDeliveryDate}</p>}
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-slate-400">Penúlt. Desp.</p>
                        <p className="font-bold text-blue-700">{emp.penultimateDispatchUnits !== null ? emp.penultimateDispatchUnits : '—'}</p>
                        {emp.penultimateDispatchDate && <p className="text-slate-400" style={{fontSize:'10px'}}>{emp.penultimateDispatchDate}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="px-4 py-3 bg-slate-50 flex justify-between items-center">
                <span className="font-semibold text-slate-700 text-sm">Total</span>
                <span className="font-bold text-blue-700">{Math.round(totalWeeklyAvg * 10) / 10} <span className="text-xs font-normal text-slate-400">unid/sem</span></span>
              </div>
            </div>

            {/* Vista desktop: tabla */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-2">Operario</th>
                    <th className="text-center px-4 py-2">Prom./sem.</th>
                    <th className="text-center px-4 py-2">Últ. Entrega</th>
                    <th className="text-center px-4 py-2">% Rend.</th>
                    <th className="text-center px-4 py-2">Penúlt. Despacho</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(emp => (
                    <tr key={emp.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{emp.name}</p>
                        <p className="text-xs text-slate-400">{emp.id}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-blue-700">{emp.weeklyAvg || '—'}</span>
                        <span className="text-xs text-slate-400 block">unid/sem</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {emp.lastDeliveryUnits !== null ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-green-700">{emp.lastDeliveryUnits}</span>
                            <span className="text-xs text-slate-400">{emp.lastDeliveryDate}</span>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {emp.lastDeliveryUnits !== null && emp.penultimateDispatchUnits > 0 ? (() => {
                          const pct = Math.round((emp.lastDeliveryUnits / emp.penultimateDispatchUnits) * 100);
                          const color = pct >= 85 ? 'text-emerald-700' : pct >= 65 ? 'text-amber-600' : 'text-red-600';
                          return <span className={`font-bold text-lg ${color}`}>{pct}%</span>;
                        })() : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {emp.penultimateDispatchUnits !== null ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-blue-700">{emp.penultimateDispatchUnits}</span>
                            <span className="text-xs text-slate-400">{emp.penultimateDispatchDate}</span>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold">
                    <td className="px-4 py-3 text-slate-700">Total</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-blue-700">{Math.round(totalWeeklyAvg * 10) / 10}</span>
                      <span className="text-xs text-slate-400 block">unid/sem</span>
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}