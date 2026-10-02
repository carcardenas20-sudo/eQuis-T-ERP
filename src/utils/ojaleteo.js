// Ojaleteado EXTERNO (Claudia): se paga POR PRESUPUESTO.
// Al aprobar un presupuesto con ojaleteado externo, se crea automáticamente un pago
// (Payment payment_type 'ojaleteado', status 'registrado') que aparece en Transferencias
// bancarias con fecha límite = fecha del presupuesto + 10 días. Claudia no tiene que cobrar.
import { base44 } from "@/api/base44Client";

const n = (v) => Number(v) || 0;

export const OJALETEO_PAYMENT_TYPE = "ojaleteado";
export const OJALETEADORA_ID = "ojaleteadora-externa";
export const OJALETEADORA_NOMBRE = "Claudia Montoya";
export const DIAS_PARA_PAGO = 10;

// (Compatibilidad: entregas de ojaleteado registradas con el esquema anterior)
export const isOjaleteo = (d) => d?.tipo_entrega === "ojaletear";

// Unidades y valor del ojaleteado externo de un presupuesto (precio por producto).
export function ojaleteoDePresupuesto(presupuesto) {
  let uds = 0, total = 0, precio = 0;
  for (const p of presupuesto?.productos || []) {
    const oj = p.ojaletear;
    if (!oj || oj.tipo !== "externo") continue;
    const pu = n(oj.precio_unit) || 80;
    const u = (p.combinaciones || []).reduce((s, c) => s + (c.tallas_cantidades || []).reduce((ss, tc) => ss + n(tc.cantidad), 0), 0);
    uds += u; total += u * pu; precio = pu;
  }
  return uds > 0 ? { uds, total: Math.round(total), precio } : null;
}

const bogotaDay = (iso) => new Date(iso || Date.now()).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const addDays = (day, d) => {
  const x = new Date(`${day}T12:00:00`);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

// Crea / actualiza / quita el pago automático del ojaleteado de un presupuesto.
// Devuelve { estado, aviso } para informar al usuario si algo no se pudo ajustar.
export async function syncPagoOjaleteo(presupuesto) {
  const oj = ojaleteoDePresupuesto(presupuesto);
  const existentes = (await base44.entities.Payment.filter({ payment_type: OJALETEO_PAYMENT_TYPE, presupuesto_id: presupuesto.id })) || [];
  const pago = existentes[0];
  const debePagarse = presupuesto.estado === "aprobado" && oj && !presupuesto.ojaletear_pagado;

  if (!debePagarse) {
    // Ya no aplica (no aprobado, sin ojaleteado externo o pagado a mano): quitar si aún no se transfirió
    if (pago && pago.status !== "ejecutado" && !(pago.transfer_payments || []).length) {
      await base44.entities.Payment.delete(pago.id);
      return { estado: "eliminado" };
    }
    return pago && pago.status === "ejecutado" && !oj ? { estado: "ejecutado", aviso: "El ojaleteado ya se había transferido." } : { estado: "sin_pago" };
  }

  const fechaPres = bogotaDay(presupuesto.created_date);
  const datos = {
    employee_id: OJALETEADORA_ID,
    employee_name: OJALETEADORA_NOMBRE,
    amount: oj.total,
    payment_date: fechaPres,
    fecha_limite: addDays(fechaPres, DIAS_PARA_PAGO),
    payment_type: OJALETEO_PAYMENT_TYPE,
    presupuesto_id: presupuesto.id,
    presupuesto_numero: presupuesto.numero_presupuesto || "",
    unidades: oj.uds,
    precio_unit: oj.precio,
    description: `Ojaleteado externo · ${presupuesto.numero_presupuesto || ""} · ${oj.uds} uds × $${oj.precio}`,
  };

  if (!pago) {
    await base44.entities.Payment.create({ ...datos, status: "registrado" });
    return { estado: "creado" };
  }
  if (pago.status === "ejecutado") {
    return Math.round(n(pago.amount)) === oj.total
      ? { estado: "ejecutado" }
      : { estado: "ejecutado", aviso: `El ojaleteado ya se transfirió por $${Math.round(n(pago.amount)).toLocaleString("es-CO")} y ahora vale $${oj.total.toLocaleString("es-CO")}. Ajusta la diferencia a mano.` };
  }
  if (Math.round(n(pago.amount)) !== oj.total || pago.fecha_limite !== datos.fecha_limite) {
    await base44.entities.Payment.update(pago.id, datos);
    return { estado: "actualizado" };
  }
  return { estado: "igual" };
}
