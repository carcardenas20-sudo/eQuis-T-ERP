// Trazabilidad de producción por hoja de corte (solo lectura, se calcula; no toca los flujos).
//
// Regla: por referencia, lo primero que se cortó es lo primero que se despacha (PEPS/FIFO),
// y por operario, lo primero que se le despachó es lo primero que entrega.
//  - Lo que ya había en producción antes de la primera hoja se trata como "Saldo anterior".
//  - Entregas marcadas como asignadas a mercancía (inventory_assigned) cuentan como "en locales".

const n = (v) => Number(v) || 0;
const day = (d) => String(d || '').slice(0, 10);

// Unidades por referencia de una entrega (formato con items o con referencia directa).
function deliveryLines(d) {
  if (Array.isArray(d.items) && d.items.length) {
    return d.items.map((it) => ({ ref: String(it.product_reference || '').toUpperCase(), qty: n(it.quantity) }));
  }
  return d.product_reference ? [{ ref: String(d.product_reference).toUpperCase(), qty: n(d.quantity) }] : [];
}

export function computeTraceability({ hojas, dispatches, deliveries, stockByRef }) {
  const activas = (hojas || []).filter((h) => h.estado !== 'anulada');
  const result = {}; // hojaId -> { cortado, despachos: {emp: qty}, entregado, enLocales }
  const lotesPorRef = {}; // ref -> [{ key, hojaId, restante, fecha }]

  // Lotes por referencia: saldo anterior + hojas en orden de fecha
  const firstDate = {};
  for (const h of activas) {
    for (const r of h.referencias || []) {
      const ref = String(r.reference || '').toUpperCase();
      const f = day(h.fecha) || day(h.created_date);
      if (!firstDate[ref] || f < firstDate[ref]) firstDate[ref] = f;
    }
  }
  const disp = (dispatches || [])
    .filter((d) => d.employee_id && n(d.quantity) > 0)
    .map((d) => ({ ...d, ref: String(d.product_reference || '').toUpperCase(), f: day(d.dispatch_date) || day(d.created_date) }))
    .sort((a, b) => (a.f + (a.created_date || '')).localeCompare(b.f + (b.created_date || '')));

  for (const ref of Object.keys(firstDate)) {
    const hojasRef = activas
      .map((h) => ({ h, r: (h.referencias || []).find((x) => String(x.reference || '').toUpperCase() === ref) }))
      .filter((x) => x.r)
      .sort((a, b) => ((day(a.h.fecha) + a.h.created_date) || '').localeCompare((day(b.h.fecha) + b.h.created_date) || ''));
    const totalHojas = hojasRef.reduce((s, x) => s + n(x.r.total), 0);
    const despDesde = disp.filter((d) => d.ref === ref && d.f >= firstDate[ref]).reduce((s, d) => s + n(d.quantity), 0);
    // Stock actual = saldo anterior + hojas − despachos desde la primera hoja  ⇒  saldo anterior
    const saldoAnterior = Math.max(0, n(stockByRef?.[ref]) + despDesde - totalHojas);
    lotesPorRef[ref] = [
      ...(saldoAnterior > 0 ? [{ key: `prev_${ref}`, hojaId: null, restante: saldoAnterior }] : []),
      ...hojasRef.map((x) => ({ key: x.h.id, hojaId: x.h.id, restante: n(x.r.total) })),
    ];
    for (const x of hojasRef) {
      if (!result[x.h.id]) result[x.h.id] = { cortado: 0, despachos: {}, entregado: 0, enLocales: 0, porRef: {} };
      result[x.h.id].cortado += n(x.r.total);
      result[x.h.id].porRef[ref] = { cortado: n(x.r.total), despachado: 0 };
    }
  }

  // Despachos → lotes (PEPS). Cada despacho queda repartido en lotes.
  const asignDespachos = {}; // `${emp}|${ref}` -> [{ hojaId, restante }] (para entregas)
  for (const d of disp) {
    const lotes = lotesPorRef[d.ref];
    if (!lotes || d.f < (firstDate[d.ref] || '9999')) continue;
    let q = n(d.quantity);
    for (const lote of lotes) {
      if (q <= 0) break;
      const t = Math.min(q, lote.restante);
      if (t <= 0) continue;
      lote.restante -= t;
      q -= t;
      const k = `${d.employee_id}|${d.ref}`;
      (asignDespachos[k] = asignDespachos[k] || []).push({ hojaId: lote.hojaId, restante: t });
      if (lote.hojaId) {
        const r = result[lote.hojaId];
        r.despachos[d.employee_id] = (r.despachos[d.employee_id] || 0) + t;
        r.porRef[d.ref].despachado += t;
      }
    }
  }

  // Entregas del operario → lo que se le despachó (PEPS)
  const dels = (deliveries || [])
    .filter((d) => d.employee_id && d.status !== 'baja')
    .sort((a, b) => (day(a.delivery_date) + (a.created_date || '')).localeCompare(day(b.delivery_date) + (b.created_date || '')));
  for (const d of dels) {
    for (const line of deliveryLines(d)) {
      const cola = asignDespachos[`${d.employee_id}|${line.ref}`];
      if (!cola) continue;
      let q = line.qty;
      for (const a of cola) {
        if (q <= 0) break;
        const t = Math.min(q, a.restante);
        if (t <= 0) continue;
        a.restante -= t;
        q -= t;
        if (a.hojaId) {
          result[a.hojaId].entregado += t;
          if (d.inventory_assigned) result[a.hojaId].enLocales += t;
        }
      }
    }
  }
  return result;
}
