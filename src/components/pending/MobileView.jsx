import React from "react";
import { Clock, ChevronRight } from "lucide-react";

export default function PendingMobileView({ visibleRows, products, activeFriday }) {
  const getPctColor = (pct) => {
    if (pct === null) return { text: 'text-slate-400', bg: 'bg-slate-100' };
    if (pct >= 85) return { text: 'text-green-700', bg: 'bg-green-100' };
    if (pct >= 65) return { text: 'text-amber-700', bg: 'bg-amber-100' };
    return { text: 'text-red-700', bg: 'bg-red-100' };
  };
  const today = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (visibleRows.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
        <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p className="text-lg font-medium">¡Todo al día!</p>
        <p className="text-sm">No hay material pendiente de entrega.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="px-4 py-3 bg-white border-b border-slate-200">
        <h2 className="font-bold text-slate-900 text-sm">Pendientes — {today}</h2>
        <p className="text-xs text-slate-500 mt-1">Viernes activo: {activeFriday ? new Date(activeFriday).toLocaleDateString("es-CO") : "—"}</p>
      </div>

      {visibleRows.map((row) => {
        const pendingItems = products.filter(p => (row[p.reference] || 0) > 0);
        
        return (
          <div key={row.id} className="bg-white border border-slate-200 rounded-lg p-4 mx-3 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">{row.employeeName}</h3>
                <p className="text-xs text-slate-500">{row.phone || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                {(() => { const c = getPctColor(row.performancePct); return (
                  <div className={`${c.bg} ${c.text} rounded-lg px-2 py-1 text-xs font-bold`}>
                    {row.performancePct !== null ? `${row.performancePct}%` : '—'}
                  </div>
                ); })()}
                <div className="bg-blue-100 text-blue-700 rounded-lg px-3 py-1 text-sm font-bold">
                  {row.total}
                </div>
              </div>
            </div>

            {pendingItems.length > 0 ? (
              <div className="space-y-2">
                {pendingItems.map(product => (
                  <div key={product.reference} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded">
                    <span className="text-slate-700">{product.name}</span>
                    <span className="font-bold text-orange-700">{row[product.reference]} unidades</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Sin pendientes</p>
            )}
          </div>
        );
      })}
    </div>
  );
}