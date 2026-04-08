import React, { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, MapPin } from "lucide-react";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

// routeRows: modo planilla (datos ya calculados [{id, employeeName, phone, total}])
// employees + dispatches + deliveries: modo portal de ruta (datos crudos)
export default function RouteChecklist({ employees, dispatches, deliveries, routeRows }) {
  const [open, setOpen] = useState(true);
  const today = getColombiaToday();

  // Modo planilla: datos ya calculados
  const routeList = routeRows
    ? routeRows.map(row => ({
        emp: { employee_id: row.id, name: row.employeeName, phone: row.phone },
        pendingUnits: row.total,
        visitedToday: false,
      }))
    : employees.map(emp => {
        const empId = emp.employee_id;

        const dispatched = {};
        dispatches.filter(d => d.employee_id === empId).forEach(d => {
          dispatched[d.product_reference] = (dispatched[d.product_reference] || 0) + (d.quantity || 0);
        });

        const delivered = {};
        deliveries.filter(d => d.employee_id === empId && d.status !== "borrador").forEach(d => {
          if (d.items?.length > 0) {
            d.items.forEach(item => {
              delivered[item.product_reference] = (delivered[item.product_reference] || 0) + (item.quantity || 0);
            });
          } else if (d.product_reference) {
            delivered[d.product_reference] = (delivered[d.product_reference] || 0) + (d.quantity || 0);
          }
        });

        const pendingUnits = Object.entries(dispatched).reduce((sum, [ref, qty]) => {
          return sum + Math.max(0, qty - (delivered[ref] || 0));
        }, 0);

        if (pendingUnits <= 0) return null;

        const visitedToday = deliveries.some(d =>
          d.employee_id === empId &&
          (d.delivery_date || "").slice(0, 10) === today
        ) || dispatches.some(d =>
          d.employee_id === empId &&
          (d.dispatch_date || "").slice(0, 10) === today
        );

        return { emp, pendingUnits, visitedToday };
      }).filter(Boolean);

  const visited = routeList.filter(r => r.visitedToday).length;
  const pending = routeList.filter(r => !r.visitedToday).length;

  if (routeList.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
      <button
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-800 text-white"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <span className="font-semibold text-sm">Lista de Ruta</span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
            {visited}/{routeList.length} visitados
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 opacity-70" /> : <ChevronDown className="w-4 h-4 opacity-70" />}
      </button>

      {open && (
        <div className="px-3 py-2 divide-y divide-slate-100">
          {/* Pendientes primero */}
          {routeList.filter(r => !r.visitedToday).map(({ emp, pendingUnits }) => (
            <div key={emp.employee_id} className="flex items-center gap-3 py-2.5">
              <Circle className="w-5 h-5 text-orange-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
                {emp.phone && <p className="text-xs text-slate-400 truncate">{emp.phone}</p>}
              </div>
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full shrink-0">
                {pendingUnits} uds
              </span>
            </div>
          ))}
          {/* Visitados al final */}
          {routeList.filter(r => r.visitedToday).map(({ emp, pendingUnits }) => (
            <div key={emp.employee_id} className="flex items-center gap-3 py-2.5 opacity-50">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-600 truncate line-through">{emp.name}</p>
              </div>
              <span className="text-xs text-slate-400 shrink-0">✓ atendido</span>
            </div>
          ))}
        </div>
      )}

      {open && pending > 0 && (
        <div className="px-4 py-2 bg-orange-50 border-t border-orange-100">
          <p className="text-xs text-orange-700 font-medium">
            ⚠️ Faltan {pending} operario{pending !== 1 ? "s" : ""} por visitar
          </p>
        </div>
      )}
      {open && pending === 0 && (
        <div className="px-4 py-2 bg-green-50 border-t border-green-100">
          <p className="text-xs text-green-700 font-medium">✅ Ruta completada</p>
        </div>
      )}
    </div>
  );
}