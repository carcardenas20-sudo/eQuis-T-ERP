// Anticipos y préstamos a empleados.
//
// Modelo (todo vive en la entidad Payment, para que el resto del sistema lo entienda):
//  - Anticipo: Payment { payment_type: 'anticipo', amount: X, status: 'registrado' }.
//    Es plata que SÍ sale (aparece en Transferencias bancarias para transferirla) y
//    cuenta como pagada al empleado. No está ligado a entregas.
//  - Descuento (cruce): Payment { payment_type: 'descuento_anticipo', amount: 0,
//    deducted_amount: Y, advance_id, status: 'cruzado', delivery_payments: [...] }.
//    Marca entregas como pagadas SIN mover plata. amount = 0 para que los totales
//    "pagado" no cuenten dos veces lo mismo (el anticipo ya contó esa plata).
//  - Saldo del anticipo = amount − Σ deducted_amount de sus cruces (se calcula, no
//    se guarda: si se borra un cruce, el saldo vuelve solo).

export const ADVANCE_TYPE = "anticipo";
export const DEDUCTION_TYPE = "descuento_anticipo";
export const DEDUCTION_STATUS = "cruzado";

const n = (v) => Number(v) || 0;

export const money = (v) => `$${Math.round(n(v)).toLocaleString("es-CO")}`;

// "2026-09-28" o ISO → "28/09/2026" sin corrimiento de zona horaria.
export function fmtDay(value) {
  if (!value) return "—";
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

// Estado de cada anticipo a partir de todos los pagos (anticipos + cruces).
export function buildAdvances(payments) {
  const list = payments || [];
  const deductionsByAdvance = {};
  list
    .filter((p) => p.payment_type === DEDUCTION_TYPE && p.advance_id)
    .forEach((p) => {
      (deductionsByAdvance[p.advance_id] = deductionsByAdvance[p.advance_id] || []).push(p);
    });

  return list
    .filter((p) => p.payment_type === ADVANCE_TYPE)
    .map((a) => {
      const deductions = (deductionsByAdvance[a.id] || []).sort(
        (x, y) => String(x.payment_date).localeCompare(String(y.payment_date))
      );
      const deducted = deductions.reduce((s, d) => s + n(d.deducted_amount), 0);
      const balance = Math.max(0, n(a.amount) - deducted);
      return {
        advance: a,
        deductions,
        deducted,
        balance,
        settled: balance <= 0.5,
        transferred: a.status === "ejecutado",
      };
    })
    .sort((x, y) => String(y.advance.payment_date).localeCompare(String(x.advance.payment_date)));
}

// Cuánto sugerir descontar de un pago: todo lo que falte (modo único) o la cuota
// (modo cuotas), sin pasarse del saldo ni de lo que se está liquidando.
export function suggestedDeduction(item, available) {
  const a = item.advance;
  const target = a.advance_mode === "cuotas" && n(a.advance_installment) > 0
    ? Math.min(n(a.advance_installment), item.balance)
    : item.balance;
  return Math.max(0, Math.min(target, n(available)));
}

// Reparte las asignaciones a entregas de un pago entre los descuentos de anticipo
// (primero) y la parte que sí se transfiere (lo que sobre).
// allocations: [{ delivery_id, amount }], deductions: [{ advance_id, amount }]
export function splitAllocations(allocations, deductions) {
  const queue = (allocations || []).map((a) => ({ ...a, amount: n(a.amount) })).filter((a) => a.amount > 0);
  const byAdvance = [];
  for (const d of deductions || []) {
    let need = n(d.amount);
    const parts = [];
    while (need > 0.5 && queue.length) {
      const head = queue[0];
      const take = Math.min(head.amount, need);
      parts.push({ delivery_id: head.delivery_id, amount: take });
      head.amount -= take;
      need -= take;
      if (head.amount <= 0.5) queue.shift();
    }
    byAdvance.push({ advance_id: d.advance_id, amount: n(d.amount) - need, delivery_payments: parts });
  }
  return { byAdvance, rest: queue.filter((a) => a.amount > 0.5) };
}

// Etiqueta legible del tipo de pago (historial, línea de tiempo, resúmenes).
export function paymentTypeLabel(p) {
  switch (p?.payment_type) {
    case "pago_completo": return "Pago completo";
    case "solicitud_aprobada": return "Solicitud aprobada";
    case ADVANCE_TYPE: return "Anticipo";
    case DEDUCTION_TYPE: return "Descuento de anticipo";
    default: return "Avance";
  }
}

// Valor a mostrar de un pago: en un cruce, lo descontado (su amount es 0 a propósito).
export function paymentDisplayAmount(p) {
  return p?.payment_type === DEDUCTION_TYPE ? n(p.deducted_amount) : n(p?.amount);
}
