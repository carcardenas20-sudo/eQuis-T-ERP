// Ojaleteado EXTERNO (Claudia): cada recepción parcial se registra como una "entrega" de la
// ojaleteadora (tipo_entrega 'ojaletear', ligada al presupuesto). Así se paga con el mismo
// flujo de operarios (saldo, solicitud de pago desde su portal, transferencias).
// OJO: estas entregas NO son prendas terminadas → se excluyen de inventario/asignación/pendientes.

const n = (v) => Number(v) || 0;

export const isOjaleteo = (d) => d?.tipo_entrega === "ojaletear";
export const OJALETEADOR_CONFIG_KEY = "ojaleteador_employee_id";

// Lo que se espera ojaletear en un presupuesto: por referencia y talla (solo productos con externo).
export function esperadoOjaleteo(presupuesto, productos) {
  const map = {};
  for (const p of presupuesto?.productos || []) {
    const oj = p.ojaletear;
    if (!oj || oj.tipo !== "externo") continue;
    const prod = (productos || []).find((x) => x.id === p.producto_id);
    const reference = String(prod?.reference || p.producto_id || "").toUpperCase();
    for (const comb of p.combinaciones || []) {
      for (const tc of comb.tallas_cantidades || []) {
        const talla = String(tc.talla || "").toUpperCase();
        const k = `${reference}|${talla}`;
        if (!map[k]) map[k] = { key: k, reference, nombre: prod?.nombre || "", talla, esperado: 0, precio: n(oj.precio_unit) || 80 };
        map[k].esperado += n(tc.cantidad);
      }
    }
  }
  return Object.values(map).filter((x) => x.esperado > 0);
}

// Recibido por referencia|talla en las entregas de ojaleteado de un presupuesto.
export function recibidoOjaleteo(entregas) {
  const map = {};
  for (const d of entregas || []) {
    if (!isOjaleteo(d)) continue;
    for (const it of d.items || []) {
      const k = `${String(it.product_reference || "").toUpperCase()}|${String(it.talla || "").toUpperCase()}`;
      map[k] = (map[k] || 0) + n(it.quantity);
    }
  }
  return map;
}

// Pagado por entrega (pagos con delivery_payments o pago_completo con delivery_ids).
export function pagadoPorEntrega(payments) {
  const map = {};
  for (const p of payments || []) {
    for (const dp of p.delivery_payments || []) map[dp.delivery_id] = (map[dp.delivery_id] || 0) + n(dp.amount);
  }
  return map;
}

// Resumen por presupuesto: unidades y valor recibidos, y cuánto de eso ya se pagó.
export function resumenOjaleteoPorPresupuesto(entregas, payments) {
  const pag = pagadoPorEntrega(payments);
  const completos = new Set((payments || []).filter((p) => p.payment_type === "pago_completo").flatMap((p) => p.delivery_ids || []));
  const res = {};
  for (const d of entregas || []) {
    if (!isOjaleteo(d) || !d.presupuesto_id) continue;
    const r = (res[d.presupuesto_id] = res[d.presupuesto_id] || { uds: 0, valor: 0, pagado: 0, entregas: 0 });
    r.entregas += 1;
    r.uds += (d.items || []).reduce((s, i) => s + n(i.quantity), 0);
    r.valor += n(d.total_amount);
    r.pagado += completos.has(d.id) || d.status === "pagado" ? n(d.total_amount) : Math.min(n(d.total_amount), pag[d.id] || 0);
  }
  return res;
}
