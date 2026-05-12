import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, Package } from 'lucide-react';

export default function AvailableForDispatch({ dispatches = [], products = [] }) {
  // Lotes pendientes: despachos sin operario asignado, creados desde Asignaciones
  const lotesPendientes = useMemo(() => {
    return (dispatches || []).filter(
      d => (d.estado_lote === 'pendiente' || d.lote_remision) && !d.employee_id
    );
  }, [dispatches]);

  const totalUnidades = useMemo(() =>
    lotesPendientes.reduce((s, d) => s + (Number(d.quantity) || 0), 0),
    [lotesPendientes]
  );

  // Agrupar por referencia para el resumen
  const porReferencia = useMemo(() => {
    const map = {};
    lotesPendientes.forEach(d => {
      const ref = d.product_reference || '?';
      const prod = products.find(p => p.reference === ref);
      const nombre = prod?.nombre || prod?.name || ref;
      if (!map[ref]) map[ref] = { nombre, cantidad: 0, lotes: 0 };
      map[ref].cantidad += Number(d.quantity) || 0;
      map[ref].lotes += 1;
    });
    return Object.values(map).sort((a, b) => b.cantidad - a.cantidad);
  }, [lotesPendientes, products]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-amber-600" />
          Lotes Pendientes de Despacho
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold text-amber-700">{totalUnidades.toLocaleString()}</p>
        <p className="text-sm text-slate-500 mb-4">
          {lotesPendientes.length} {lotesPendientes.length === 1 ? 'lote listo' : 'lotes listos'} para asignar operario.
        </p>
        <div className="space-y-2">
          {porReferencia.length > 0 ? (
            porReferencia.slice(0, 6).map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm p-2 bg-amber-50 rounded-md">
                <span className="flex items-center gap-2 truncate">
                  <Package className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="truncate">{item.nombre}</span>
                  <span className="text-xs text-slate-400 shrink-0">({item.lotes} lote{item.lotes > 1 ? 's' : ''})</span>
                </span>
                <span className="font-bold text-amber-800 shrink-0 ml-2">{item.cantidad}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">
              No hay lotes pendientes. Crea asignaciones desde Producción.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
