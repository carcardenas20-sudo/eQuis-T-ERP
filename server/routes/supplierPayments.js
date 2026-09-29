import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, query } from '../db.js';
import { ENTITY_SCHEMAS, splitRecord } from '../entitySchemas.js';

// Pagos a proveedores desde los puntos de venta (líderes de punto).
//  - Ven las cuentas pendientes de cada proveedor SIN montos (el servidor no los envía).
//  - Registran cuánto pagaron (solo efectivo de su punto) y el servidor lo reparte en
//    orden, de la cuenta más antigua a la más nueva, en una sola transacción.
//  - Si el pago supera lo pendiente con ese proveedor, no se guarda.
const router = express.Router();

const PERMISSION = 'supplier_payments';

async function loadContext(req) {
  const { rows } = await query(
    'SELECT id, full_name, email, role, role_id, location_id, company_id FROM app_users WHERE id = $1',
    [req.userId]
  );
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
    isAdmin,
    allowed: isAdmin || permissions.includes(PERMISSION),
    companyId: (isAdmin && requested) ? String(requested) : (u.company_id || 'equist'),
  };
}

// Cuentas por pagar de PROVEEDORES pendientes (no salarios de operarios ni gastos fijos).
const PENDING_SQL = `
  SELECT id, supplier_id, status, due_date, created_date, pending_amount, paid_amount, data
  FROM entity_account_payable
  WHERE company_id = $1
    AND status IN ('pending', 'partial')
    AND COALESCE(data->>'category', '') <> 'salarios_manufactura'
    AND COALESCE(data->>'type', '') <> 'manufacturing_salary'
    AND COALESCE(data->>'category', '') <> 'gasto_fijo'
`;
// Se agrupa por NOMBRE: hay cuentas del mismo proveedor con supplier_id y otras solo con el nombre;
// si se agrupara por id, el mismo proveedor saldría dos veces y el orden de pago se rompería.
const supplierKey = (row) => {
  const name = (row.data?.supplier_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return name ? `name:${name}` : `id:${row.supplier_id || row.id}`;
};
const pendingOf = (row) => {
  const total = Number(row.data?.total_amount) || 0;
  const paid = Number(row.paid_amount) || 0;
  const p = row.pending_amount != null ? Number(row.pending_amount) : total - paid;
  return Math.max(0, p);
};
// Orden de pago: primero la que vence antes; sin fecha de vencimiento, al final; empate → la más antigua.
const byOldest = (a, b) => {
  const da = a.due_date ? String(a.due_date).slice(0, 10) : '9999-12-31';
  const db = b.due_date ? String(b.due_date).slice(0, 10) : '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;
  return String(a.created_date).localeCompare(String(b.created_date));
};

async function insertEntity(client, type, record, companyId, userId) {
  const schema = ENTITY_SCHEMAS[type];
  const id = uuidv4();
  const now = new Date().toISOString();
  const { typedValues, dataRest } = splitRecord(schema, record);
  const typedCols = Object.keys(schema.typed);
  const cols = ['id', ...typedCols, 'data', 'created_date', 'updated_date', 'created_by_id', 'company_id'];
  const vals = [id, ...typedCols.map(c => typedValues[c] !== undefined ? typedValues[c] : null),
    JSON.stringify(dataRest), now, now, userId, companyId];
  await client.query(
    `INSERT INTO ${schema.table} (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')})`,
    vals
  );
  return id;
}

// GET: proveedores con cuentas pendientes (sin montos) + mis pagos recientes.
router.get('/', async (req, res) => {
  try {
    const ctx = await loadContext(req);
    if (!ctx?.allowed) return res.status(403).json({ error: 'No tienes permiso para registrar pagos a proveedores' });

    const { rows } = await query(PENDING_SQL, [ctx.companyId]);
    const groups = {};
    for (const r of rows) {
      if (pendingOf(r) <= 0.5) continue;
      const key = supplierKey(r);
      if (!groups[key]) groups[key] = { key, name: r.data?.supplier_name || '(Sin nombre)', accounts: [] };
      groups[key].accounts.push({
        id: r.id,
        description: r.data?.description || '',
        invoice_number: r.data?.invoice_number || '',
        due_date: r.due_date ? String(r.due_date).slice(0, 10) : null,
        created_date: r.created_date,
        partial: r.status === 'partial',
      });
    }
    const suppliers = Object.values(groups)
      .map(g => ({ ...g, accounts: g.accounts.sort(byOldest) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Pagos que ESTE usuario registró (los montos que él mismo pagó sí se muestran).
    const recent = await query(
      `SELECT data->>'payment_date' AS payment_date, data->>'supplier_name' AS supplier_name,
              data->>'batch_id' AS batch_id, (data->>'amount')::numeric AS amount
       FROM entity_payable_payment
       WHERE company_id = $1 AND data->>'registered_by' = $2
         AND (data->>'payment_date') >= $3
       ORDER BY data->>'payment_date' DESC`,
      [ctx.companyId, ctx.user.id, new Date(Date.now() - 30 * 86400000).toISOString()]
    );
    const batches = {};
    for (const p of recent.rows) {
      const k = p.batch_id || p.payment_date;
      if (!batches[k]) batches[k] = { date: p.payment_date, supplier_name: p.supplier_name, amount: 0 };
      batches[k].amount += Number(p.amount) || 0;
    }

    let locationName = null;
    if (ctx.user.location_id) {
      const l = await query('SELECT name FROM entity_location WHERE id = $1', [ctx.user.location_id]);
      locationName = l.rows[0]?.name || null;
    }
    res.json({
      location: ctx.user.location_id ? { id: ctx.user.location_id, name: locationName } : null,
      suppliers,
      recent: Object.values(batches).slice(0, 20),
    });
  } catch (err) {
    console.error('GET /supplier-payments:', err.message);
    res.status(500).json({ error: 'Error cargando las cuentas' });
  }
});

// POST: registrar un pago en efectivo a un proveedor y repartirlo en orden.
router.post('/', async (req, res) => {
  const ctx = await loadContext(req).catch(() => null);
  if (!ctx?.allowed) return res.status(403).json({ error: 'No tienes permiso para registrar pagos a proveedores' });

  const amount = Math.round(Number(req.body?.amount) || 0);
  const supplier = String(req.body?.supplier_key || '');
  const notes = String(req.body?.notes || '').slice(0, 300);
  const locationId = ctx.user.location_id || (ctx.isAdmin ? req.body?.location_id : null);
  if (amount <= 0) return res.status(400).json({ error: 'Escribe el valor que se pagó.' });
  if (!supplier) return res.status(400).json({ error: 'Elige el proveedor.' });
  if (!locationId) return res.status(400).json({ error: 'Tu usuario no tiene un punto de venta asignado. Pídele al administrador que te asigne uno.' });

  // Fecha de la que sale el efectivo (puede ser un día anterior). No futura, máx. 60 días atrás.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const payDate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.payment_date || '')) ? req.body.payment_date : today;
  const oldest = new Date(Date.now() - 60 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  if (payDate > today) return res.status(400).json({ error: 'La fecha no puede ser futura.' });
  if (payDate < oldest) return res.status(400).json({ error: 'La fecha es muy antigua (máximo 60 días atrás).' });
  // Si el efectivo de ese día ya se recogió, un gasto nuevo descuadraría un día cerrado.
  const closed = await query(
    `SELECT 1 FROM entity_cash_control WHERE company_id = $1 AND location_id = $2 AND LEFT(control_date, 10) = $3 AND cash_collected = true LIMIT 1`,
    [ctx.companyId, locationId, payDate]
  ).catch(() => ({ rows: [] }));
  if (closed.rows.length) {
    return res.status(400).json({ error: 'El efectivo de ese día ya fue recogido. Elige otra fecha o pídele al administrador que lo reabra.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Bloquear las cuentas del proveedor mientras se reparte el pago.
    const { rows } = await client.query(`${PENDING_SQL} FOR UPDATE`, [ctx.companyId]);
    const accounts = rows.filter(r => supplierKey(r) === supplier && pendingOf(r) > 0.5).sort(byOldest);
    const totalPending = accounts.reduce((s, r) => s + pendingOf(r), 0);
    if (!accounts.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este proveedor ya no tiene cuentas pendientes.' });
    }
    if (amount > totalPending + 0.5) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El pago supera lo pendiente con este proveedor. Verifica el valor con el administrador.' });
    }

    const supplierName = accounts[0].data?.supplier_name || '';
    const batchId = uuidv4();
    // Hoy: hora real. Día anterior: mediodía de ese día (hora Colombia).
    const nowIso = payDate === today ? new Date().toISOString() : new Date(`${payDate}T12:00:00-05:00`).toISOString();
    const who = ctx.user.full_name || ctx.user.email;
    let remaining = amount;
    const applied = [];

    for (const acc of accounts) {
      if (remaining <= 0.5) break;
      const pending = pendingOf(acc);
      const pay = Math.min(pending, remaining);
      remaining -= pay;

      // Gasto en efectivo del punto → aparece en Control de Efectivo.
      const expenseId = await insertEntity(client, 'Expense', {
        description: `Pago a ${supplierName} - ${acc.data?.description || ''}`.trim(),
        amount: pay,
        category: acc.data?.category || 'otros',
        expense_date: payDate,
        location_id: locationId,
        payment_method: 'cash',
        supplier: supplierName,
        notes: `Abono a cuenta por pagar #${acc.id} · registrado por ${who}${notes ? ` · ${notes}` : ''}`,
      }, ctx.companyId, ctx.user.id);

      await insertEntity(client, 'PayablePayment', {
        payable_id: acc.id,
        payment_date: nowIso,
        amount: pay,
        method: 'cash',
        reference: '',
        location_id: locationId,
        notes: `Pago desde punto de venta · ${who}${notes ? ` · ${notes}` : ''}`,
        expense_id: expenseId,
        registered_by: ctx.user.id,
        registered_by_name: who,
        supplier_name: supplierName,
        batch_id: batchId,
      }, ctx.companyId, ctx.user.id);

      const newPaid = (Number(acc.paid_amount) || 0) + pay;
      const newPending = Math.max(0, pending - pay);
      const newStatus = newPending <= 0.5 ? 'paid' : 'partial';
      await client.query(
        'UPDATE entity_account_payable SET paid_amount = $1, pending_amount = $2, status = $3, updated_date = NOW() WHERE id = $4',
        [newPaid, newPending, newStatus, acc.id]
      );
      applied.push({ description: acc.data?.description || '', invoice_number: acc.data?.invoice_number || '', settled: newStatus === 'paid' });
    }

    await client.query('COMMIT');
    res.json({ ok: true, supplier_name: supplierName, amount, payment_date: payDate, applied });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('POST /supplier-payments:', err.message);
    res.status(500).json({ error: 'No se pudo registrar el pago' });
  } finally {
    client.release();
  }
});

export default router;
