import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Factory, CalendarClock, Package } from 'lucide-react';

export default function ProximosIngresos({ presupuestos = [], productos = [], dispatches = [], deliveries = [] }) {

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

  // ── Presupuestos aprobados ────────────────────────────────────────────
  const presupuestosAprobados = useMemo(() =>
    (presupuestos || [])
      .filter(p => p.estado === 'aprobado')
      .sort((a, b) => {
        if (!a.fecha_entrega && !b.fecha_entrega) return 0;
        if (!a.fecha_entrega) return 1;
        if (!b.fecha_entrega) return -1;
        return new Date(a.fecha_entrega) - new Date(b.fecha_entrega);
      }),
    [presupuestos]
  );

  const formatFecha = (f) => {
    if (!f) return 'Sin fecha';
    try { return format(new Date(f), "d 'de' MMMM", { locale: es }); }
    catch { return f; }
  };

  const getDiasRestantes = (f) => {
    if (!f) return null;
    const diff = Math.ceil((new Date(f) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const colorBadgeDias = (dias) => {
    if (dias === null) return 'bg-slate-100 text-slate-500';
    if (dias < 0) return 'bg-red-100 text-red-700';
    if (dias <= 7) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const labelDias = (dias) => {
    if (dias === null) return 'Sin fecha';
    if (dias < 0) return `Vencido hace ${Math.abs(dias)}d`;
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    return `En ${dias} días`;
  };

  return (
    <div className="space-y-6">

      {/* ── En producción (operarios) ── */}
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

      {/* ── Presupuestos aprobados ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Presupuestos aprobados</h3>
        </div>
        {presupuestosAprobados.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-2">No hay presupuestos aprobados pendientes.</p>
        ) : (
          <div className="space-y-4">
            {presupuestosAprobados.map(pres => {
              const dias = getDiasRestantes(pres.fecha_entrega);
              return (
                <div key={pres.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* Cabecera presupuesto */}
                  <div className="flex items-center justify-between bg-indigo-50 px-4 py-2.5 border-b border-indigo-100">
                    <span className="text-sm font-semibold text-indigo-900">#{pres.numero_presupuesto}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-indigo-600">{formatFecha(pres.fecha_entrega)}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorBadgeDias(dias)}`}>
                        {labelDias(dias)}
                      </span>
                    </div>
                  </div>

                  {/* Productos del presupuesto */}
                  <div className="divide-y divide-slate-100">
                    {(pres.productos || []).map((item, pi) => {
                      const prod = productos.find(p => p.id === item.producto_id);
                      const combsConUnidades = (item.combinaciones || []).filter(c =>
                        (c.tallas_cantidades || []).some(tc => tc.cantidad > 0)
                      );
                      if (combsConUnidades.length === 0) return null;

                      return (
                        <div key={pi} className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-800 mb-2">
                            {prod?.nombre || item.producto_id}
                          </p>
                          <div className="space-y-2">
                            {combsConUnidades.map((comb, ci) => {
                              const colores = [...new Set(
                                (comb.colores_por_material || [])
                                  .filter(cm => cm.color_nombre)
                                  .map(cm => cm.color_nombre)
                              )];
                              const tallasActivas = (comb.tallas_cantidades || []).filter(tc => tc.cantidad > 0);
                              const totalComb = tallasActivas.reduce((s, tc) => s + tc.cantidad, 0);

                              return (
                                <div key={ci} className="bg-slate-50 rounded-lg px-3 py-2">
                                  {/* Colores */}
                                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                    {colores.length > 0
                                      ? colores.map((col, i) => (
                                          <span key={i} className="text-xs bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600 font-medium">
                                            {col}
                                          </span>
                                        ))
                                      : <span className="text-xs text-slate-400 italic">Sin colores definidos</span>
                                    }
                                    <span className="ml-auto text-xs font-bold text-slate-500">{totalComb} uds</span>
                                  </div>
                                  {/* Tallas */}
                                  <div className="flex flex-wrap gap-1">
                                    {tallasActivas.map(tc => (
                                      <div key={tc.talla} className="flex items-center gap-0.5 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                                        <span className="text-xs font-semibold text-slate-500">{tc.talla}</span>
                                        <span className="text-xs text-slate-400">:</span>
                                        <span className="text-xs font-bold text-slate-700">{tc.cantidad}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
