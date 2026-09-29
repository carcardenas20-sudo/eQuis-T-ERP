import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, query } from '../db.js';
import { ENTITY_SCHEMAS, splitRecord } from '../entitySchemas.js';

// Devoluciones de facturas.
//  - El cliente devuelve productos de una venta (no más de lo vendido, sumando devoluciones previas).
//  - Valor por unidad = lo que realmente pagó (line_total/cantidad, prorrateando el descuento global).
//  - Los productos vuelven al inventario de la sucursal de la venta.
//  - El valor se aplica: 1) al crédito abierto de esa factura; 2) lo que sobre, a saldo a favor
//    del cliente o devolución en efectivo (gasto en efectivo de la sucursal).
//  - Todo en una transacción.
const router = express.Router();

const RETURN_PERMS = ['sales_returns', 'sales_cancel', 'pos_delete_sales'];
const num = (v) => Number(v) || 0;
const r0 = (v) => Math.round(v);
const todayBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

async function loadContext(req) {
  const { rows } = await query('SELECT id, full_name, email, role, role_id, company_id FROM app_users WHERE id = $1', [req.userId]);
  const u = rows[0];
  if (!u) return null;
  const isAdmin = u.role === 'admin' || req.userRole === 'admin';
  let permissions = [];
  if (!isAdmin && u.role_id) {
    const r = await query('SELECT data FROM entity_role WHERE id = $1', [u.role_id]);
    permissions = Array.isArray(r.rows[0]?.data?.permissions) ? r.rows[0].data.permissions : [];
  }
  const requested = req.headers['x-company-id'];
  return {
    user: u,
    allowed: isAdmin || RETURN_PERMS.some((p) => permissions.includes(p)),
    companyId: (isAdmin && requested) ? String(requested) : (u.company_id || 'equist'),
  };
}

async function insertEntity(client, type, record, companyId, userId, id = uuidv4()) {
  const schema = ENTITY_SCHEMAS[type];
  const now = new Date().toISOString();
  const { typedValues, dataRest } = splitRecord(schema, record);
  const typedCols = Object.keys(schema.typed);
  const cols = ['id', ...typedCols, 'data', 'created_date', 'updated_date', 'created_by_id', 'company_id'];
  const vals = [id, ...typedCols.map((c) => (typedValues[c] !== undefined ? typedValues[c] : null)),
    JSON.stringify(dataRest), now, now, userId, companyId];
  await client.query(
    `INSERT INTO ${schema.table} (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')})`,
    vals
  );
  return id;
}

// Saldo a favor de un cliente (suma de movimientos).
router.get('/saldo/:customerId', async (req, res) => {
  const ctx = await loadContext(req).catch(() => null);
  if (!ctx) return res.status(401).json({ error: 'No autenticado' });
  try {
    const { rows } = await query(
      'SELECT COALESCE(SUM(amount), 0) AS saldo FROM entity_customer_balance WHERE customer_id = $1 AND company_id = $2',
      [req.params.customerId, ctx.companyId]
    );
    res.json({ saldo: num(rows[0]?.saldo) });
  } catch (e) {
    res.json({ saldo: 0 });
  }
});

router.post('/', async (req, res) => {
  const ctx = await loadContext(req).catch(() => null);
  if (!ctx?.allowed) return res.status(403).json({ error: 'No tienes permiso para registrar devoluciones' });

  const saleId = String(req.body?.sale_id || '');
  const itemsIn = (Array.isArray(req.body?.items) ? req.body.items : [])
    .map((i) => ({ sale_item_id: String(i.sale_item_id || ''), quantity: num(i.quantity) }))
    .filter((i) => i.sale_item_id && i.quantity > 0);
  const destinoSobrante = req.body?.destino_sobrante === 'efectivo' ? 'efectivo' : 'saldo';
  const notas = String(req.body?.notas || '').slice(0, 300);
  if (!saleId || !itemsIn.length) return res.status(400).json({ error: 'Elige los productos y cantidades a devolver.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: srows } = await client.query(
      'SELECT id, location_id, customer_id, status, total_amount, invoice_number, data FROM entity_sale WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [saleId, ctx.companyId]
    );
    const sale = srows[0];
    if (!sale) throw Object.assign(new Error('Venta no encontrada'), { status: 404 });
    if (sale.status === 'cancelled' || sale.status === 'anulada') throw Object.assign(new Error('La venta está anulada.'), { status: 400 });

    const { rows: items } = await client.query(
      'SELECT id, product_id, quantity, unit_price, line_total, data FROM entity_sale_item WHERE sale_id = $1',
      [saleId]
    );
    const sumLines = items.reduce((s, i) => s + num(i.line_total), 0);
    const factor = sumLines > 0 ? num(sale.total_amount) / sumLines : 1; // prorratea el descuento global
    const previas = Array.isArray(sale.data?.devoluciones) ? sale.data.devoluciones : [];
    const yaDevuelto = {};
    for (const d of previas) for (const it of d.items || []) yaDevuelto[it.sale_item_id] = (yaDevuelto[it.sale_item_id] || 0) + num(it.quantity);

    const lineas = [];
    for (const it of itemsIn) {
      const si = items.find((x) => x.id === it.sale_item_id);
      if (!si) throw Object.assign(new Error('Un producto no pertenece a esta venta.'), { status: 400 });
      const disponible = num(si.quantity) - (yaDevuelto[si.id] || 0);
      if (it.quantity > disponible + 1e-9) {
        throw Object.assign(new Error(`De ${si.product_id} solo se pueden devolver ${disponible} (vendidas ${num(si.quantity)}).`), { status: 400 });
      }
      const unit = num(si.quantity) > 0 ? (num(si.line_total) / num(si.quantity)) * factor : 0;
      lineas.push({ sale_item_id: si.id, product_id: si.product_id, quantity: it.quantity, valor: r0(unit * it.quantity),
        product_name: si.data?.product_name || '' });
    }
    const total = lineas.reduce((s, l) => s + l.valor, 0);
    const devId = uuidv4();
    const fecha = todayBogota();
    const nowIso = new Date().toISOString();
    const factura = sale.invoice_number || String(sale.id).slice(-8);
    const who = ctx.user.full_name || ctx.user.email;

    // 1) Inventario: los productos vuelven a la sucursal de la venta
    for (const l of lineas) {
      const { rows: inv } = await client.query(
        `SELECT id, current_stock, available_stock FROM entity_inventory
         WHERE company_id = $1 AND product_id = $2 AND location_id = $3
         ORDER BY current_stock DESC LIMIT 1 FOR UPDATE`,
        [ctx.companyId, l.product_id, sale.location_id]
      );
      if (inv[0]) {
        await client.query(
          'UPDATE entity_inventory SET current_stock = current_stock + $1, available_stock = COALESCE(available_stock, 0) + $1, updated_date = NOW() WHERE id = $2',
          [l.quantity, inv[0].id]
        );
      } else {
        await insertEntity(client, 'Inventory', { product_id: l.product_id, location_id: sale.location_id,
          current_stock: l.quantity, available_stock: l.quantity }, ctx.companyId, ctx.user.id);
      }
      await insertEntity(client, 'InventoryMovement', {
        movement_type: 'return', product_id: l.product_id, location_id: sale.location_id, quantity: l.quantity,
        movement_date: nowIso, reference_id: sale.id, reason: `Devolución factura #${factura}`,
      }, ctx.companyId, ctx.user.id);
    }

    // 2) Crédito abierto de esta factura
    let aplicadoCredito = 0;
    const { rows: creds } = await client.query(
      `SELECT id, pending_amount, paid_amount, status FROM entity_credit
       WHERE sale_id = $1 AND company_id = $2 AND COALESCE(pending_amount, 0) > 0 FOR UPDATE`,
      [saleId, ctx.companyId]
    );
    const cred = creds[0];
    if (cred && total > 0) {
      aplicadoCredito = Math.min(total, num(cred.pending_amount));
      const nuevoPend = Math.max(0, num(cred.pending_amount) - aplicadoCredito);
      await client.query(
        `UPDATE entity_credit SET pending_amount = $1, status = $2, updated_date = NOW(),
           data = data || jsonb_build_object('devuelto', COALESCE((data->>'devuelto')::numeric, 0) + $3::numeric)
         WHERE id = $4`,
        [nuevoPend, nuevoPend <= 0.5 ? 'paid' : (num(cred.paid_amount) > 0 ? 'partial' : cred.status), aplicadoCredito, cred.id]
      );
      // Registro en el historial del crédito. Método 'devolucion': no es plata recibida
      // (Control de Efectivo y Dashboard solo cuentan efectivo/transferencia/tarjeta).
      await insertEntity(client, 'Payment', {
        type: 'credit_payment', method: 'devolucion', amount: aplicadoCredito, payment_date: nowIso,
        credit_id: cred.id, sale_id: sale.id, location_id: sale.location_id,
        reference: `Devolución factura #${factura}`, devolucion_id: devId,
      }, ctx.companyId, ctx.user.id);
    }

    // 3) Lo que sobra: saldo a favor del cliente o efectivo
    const sobrante = total - aplicadoCredito;
    let saldoFavor = 0;
    let efectivo = 0;
    if (sobrante > 0.5) {
      if (destinoSobrante === 'saldo') {
        if (!sale.customer_id) {
          throw Object.assign(new Error('La venta no tiene un cliente registrado: no se puede dejar saldo a favor. Elige devolver en efectivo.'), { status: 400 });
        }
        saldoFavor = sobrante;
        await insertEntity(client, 'CustomerBalance', {
          customer_id: sale.customer_id, amount: sobrante, tipo: 'devolucion',
          customer_name: sale.data?.customer_name || '', sale_id: sale.id, factura, fecha,
          motivo: `Devolución factura #${factura}`, devolucion_id: devId,
        }, ctx.companyId, ctx.user.id);
      } else {
        efectivo = sobrante;
        await insertEntity(client, 'Expense', {
          description: `Devolución de dinero - factura #${factura}`, amount: sobrante, category: 'devoluciones',
          expense_date: fecha, location_id: sale.location_id, payment_method: 'cash',
          notes: `Devolución registrada por ${who}`, devolucion_id: devId,
        }, ctx.companyId, ctx.user.id);
      }
    }

    const registro = { id: devId, fecha, items: lineas, total, aplicado_credito: aplicadoCredito,
      saldo_favor: saldoFavor, efectivo, notas, registrado_por: who };
    await client.query(
      `UPDATE entity_sale SET updated_date = NOW(),
         data = jsonb_set(data, '{devoluciones}', COALESCE(data->'devoluciones', '[]'::jsonb) || $1::jsonb)
                || jsonb_build_object('total_devuelto', COALESCE((data->>'total_devuelto')::numeric, 0) + $2::numeric)
       WHERE id = $3`,
      [JSON.stringify([registro]), total, sale.id]
    );

    await client.query('COMMIT');
    res.json({ ok: true, ...registro });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('POST /devoluciones:', e.message);
    res.status(500).json({ error: 'No se pudo registrar la devolución' });
  } finally {
    client.release();
  }
});

export default router;
