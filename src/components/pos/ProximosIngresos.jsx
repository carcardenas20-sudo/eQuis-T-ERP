import React, { useMemo } from 'react';
import { Factory, Package } from 'lucide-react';

export default function ProximosIngresos({ productos = [], dispatches = [], deliveries = [] }) {

  // ── Operarios: pendiente por referencia ──────────────────────────────
  const pendientesPorRef = useMemo(() => {
    const mapa = {};
    dispatches.forEach(d => {
      if (!d.product_reference) return;
      mapa[d.product_reference] = (mapa[d.product_reference] || 0) + (d.quantity || 0);
    });
    deliveries
      .filter(d => d.status !== 'borrador')
      .forEach(d => {
        if (d.items?.length > 0) {
          d.items.forEach(i => {
            mapa[i.product_reference] = (mapa[i.product_reference] || 0) - (i.quantity || 0);
          });
        } else if (d.product_reference) {
          mapa[d.product_reference] = (mapa[d.product_reference] || 0) - (d.quantity || 0);
        }
      });
    return Object.entries(mapa)
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [dispatches, deliveries]);

  const getNombreProducto = (ref) => {
    const p = productos.find(p => p.reference === ref);
    return p?.nombre || ref;
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Factory className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">En producción con operarios</h3>
      </div>
      {pendientesPorRef.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-2">Sin prendas en producción actualmente.</p>
      ) : (
        <div className="space-y-2">
          {pendientesPorRef.map(([ref, qty]) => (
            <div key={ref} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-sm font-medium text-slate-800">{getNombreProducto(ref)}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-lg font-bold text-blue-700">{qty}</span>
                <span className="text-xs text-blue-400 ml-1">uds</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
