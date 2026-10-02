import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, query } from '../db.js';
import { ENTITY_SCHEMAS, splitRecord } from '../entitySchemas.js';

// Actas de entrega de efectivo (EE-0001…):
//  - El líder de punto declara que entrega el efectivo de uno o varios días a un receptor.
//  - El receptor (admin o con permiso de contabilidad) confirma lo que recibió: coincide o con diferencia.
//  - Al confirmar, esos días quedan "Recogido" en Control de Efectivo. Confirmada = inmutable.
//  - Quién y cuándo sale SIEMPRE de la sesión (nadie firma por otro).
const router = express.Router();

const num = (v) => Number(v) || 0;
const r0 = (v) => Math.round(num(v));

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
  const companyId = (isAdmin && requested) ? String(requested) : (u.company_id || 'equist');
  const canManage = isAdmin || permissions.includes('accounting_view_transactions');
  // Sucursal del usuario + sus puestos ambulantes
  let locationIds = [];
  if (u.location_id) {
    const { rows: hijos } = await query(
      `SELECT id FROM entity_location WHERE company_id = $1 AND data->>'tipo' = 'ambulante' AND data->>'parent_location_id' = $2`,
      [companyId, u.location_id]
    );
    locationIds = [u.location_id, ...hijos.map((h) => h.id)];
  }
  return {
    user: u, isAdmin, canManage, companyId, locationIds,
    canDeliver: canManage || permissions.includes('cash_control_view'),
    name: u.full_name || u.email,
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
  await client.query(`INSERT INTO ${schema.table} (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')})`, vals);
  return id;
}

// Efectivo neto de un día de caja = efectivo − gastos en efectivo de ese día y sucursal
async function netCash(client, companyId, control) {
  const day = String(control.control_date).slice(0, 10);
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(amount), 0) s FROM entity_expense
     WHERE company_id = $1 AND location_id = $2 AND payment_method = 'cash' AND LEFT(expense_date::text, 10) = $3`,
    [companyId, control.location_id, day]
  );
  return num(control.cash_amount) - num(rows[0]?.s);
}

const mapRow = (r) => ({ ...(r.data || {}), id: r.id, numero: r.numero, location_id: r.location_id, estado: r.estado,
  monto_entregado: num(r.monto_entregado), created_date: r.created_date });

// Lista de actas (líder: las de su punto; admin/contabilidad: todas)
router.get('/', async (req, res) => {
  const ctx = await loadContext(req).catch(() => null);
  if (!ctx?.canDeliver) return res.status(403).json({ error: 'Sin permiso' });
  try {
    const params = [ctx.companyId];
    let where = 'company_id = $1';
    if (!ctx.canManage) {
      if (!ctx.locationIds.length) return res.json([]);
      params.push(ctx.locationIds);
      where += ` AND location_id = ANY($2)`;
    }
    const { rows } = await query(`SELECT * FROM entity_entrega_efectivo WHERE ${where} ORDER BY created_date DESC LIMIT 300`, params);
    res.json(rows.map(mapRow));
  } catch (e) {
    res.json([]);
  }
});

// Posibles receptores: administradores o usuarios con permiso de contabilidad de la empresa
router.get('/receptores', async (req, res) => {
  const ctx = await loadContext(req).catch(() => null);
  if (!ctx?.canDeliver) return res.status(403).json({ error: 'Sin permiso' });
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.email, u.role, r.data->'permissions' AS perms
     FROM app_users u LEFT JOIN entity_role r ON r.id = u.role_id
     WHERE u.is_active = true AND (u.role = 'admin' OR u.company_id = $1)`,
    [ctx.companyId]
  );
  res.json(rows
    .filter((u) => u.role === 'admin' || (Array.isArray(u.perms) && u.perms.includes('accounting_view_transactions')))
    .map((u) => ({ id: u.id, nombre: u.full_name || u.email })));
});

// Registrar entrega
router.post('/', async (req, res) => {
  const ctx = await loadContext(req).catch(() => null);
  if (!ctx?.canDeliver) return res.status(403).json({ error: 'No tienes permiso para registrar entregas de efectivo' });
  const controlIds = (Array.isArray(req.body?.control_ids) ? req.body.control_ids : []).map(String);
  const monto = r0(req.body?.monto_entregado);
  const receptorId = String(req.body?.receptor_user_id || '');
  const notas = String(req.body?.notas || '').slice(0, 300);
  if (!controlIds.length) return res.status(400).json({ error: 'Escoge los días que estás entregando.' });
  if (monto < 0) return res.status(400).json({ error: 'Valor inválido.' });
  if (!receptorId) return res.status(400).json({ error: 'Escoge a quién le entregas.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: rec } = await client.query('SELECT id, full_name, email FROM app_users WHERE id = $1 AND is_active = true', [receptorId]);
    if (!rec[0]) throw Object.assign(new Error('Receptor no válido'), { status: 400 });

    const { rows: controls } = await client.query(
      `SELECT * FROM entity_cash_control WHERE id = ANY($1) AND company_id = $2 FOR UPDATE`,
      [controlIds, ctx.companyId]
    );
    if (controls.length !== controlIds.length) throw Object.assign(new Error('Algún día de caja no existe.'), { status: 400 });
    const locs = [...new Set(controls.map((c) => c.location_id))];
    if (locs.length !== 1) throw Object.assign(new Error('Una entrega debe ser de un solo punto.'), { status: 400 });
    if (!ctx.canManage && !ctx.locationIds.includes(locs[0])) throw Object.assign(new Error('Solo puedes entregar el efectivo de tu punto.'), { status: 403 });
    for (const c of controls) {
      if (c.cash_collected) throw Object.assign(new Error(`El ${String(c.control_date).slice(0, 10)} ya fue recogido.`), { status: 400 });
      if (c.data?.entrega_estado === 'pendiente') throw Object.assign(new Error(`El ${String(c.control_date).slice(0, 10)} ya está en otra entrega pendiente (${c.data.entrega_numero}).`), { status: 400 });
    }

    let esperado = 0;
    const dias = [];
    for (const c of controls) {
      const neto = await netCash(client, ctx.companyId, c);
      esperado += neto;
      dias.push({ control_id: c.id, fecha: String(c.control_date).slice(0, 10), neto: r0(neto) });
    }
    dias.sort((a, b) => a.fecha.localeCompare(b.fecha));

    const { rows: cn } = await client.query(
      `UPDATE entity_company SET data = jsonb_set(data, '{entrega_efectivo_next}', to_jsonb(COALESCE((data->>'entrega_efectivo_next')::bigint, 1) + 1))
       WHERE id = $1 RETURNING (data->>'entrega_efectivo_next')::bigint - 1 AS n`,
      [ctx.companyId]
    );
    const numero = `EE-${String(cn[0]?.n || 1).padStart(4, '0')}`;
    const id = uuidv4();
    const now = new Date().toISOString();
    await insertEntity(client, 'EntregaEfectivo', {
      numero, location_id: locs[0], estado: 'pendiente', monto_entregado: monto,
      dias, monto_esperado: r0(esperado), diferencia_declarada: monto - r0(esperado),
      entregado_por_id: ctx.user.id, entregado_por: ctx.name, fecha_entrega: now,
      receptor_id: rec[0].id, receptor: rec[0].full_name || rec[0].email, notas,
    }, ctx.companyId, ctx.user.id, id);

    await client.query(
      `UPDATE entity_cash_control SET updated_date = NOW(),
         data = data || jsonb_build_object('entrega_id', $1::text, 'entrega_numero', $2::text, 'entrega_estado', 'pendiente')
       WHERE id = ANY($3)`,
      [id, numero, controlIds]
    );
    await client.query('COMMIT');
    res.json({ ok: true, id, numero, monto_esperado: r0(esperado), monto_entregado: monto });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('POST /entregas-efectivo:', e.message);
    res.status(500).json({ error: 'No se pudo registrar la entrega' });
  } finally {
    client.release();
  }
});

// Confirmar recepción (receptor designado, admin o contabilidad)
router.post('/:id/confirmar', async (req, res) => {
  const ctx = await loadContext(req).catch(() => null);
  if (!ctx) return res.status(401).json({ error: 'No autenticado' });
  const recibido = r0(req.body?.monto_recibido);
  const nota = String(req.body?.nota || '').slice(0, 300);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM entity_entrega_efectivo WHERE id = $1 AND company_id = $2 FOR UPDATE', [req.params.id, ctx.companyId]);
    const ent = rows[0];
    if (!ent) throw Object.assign(new Error('Acta no encontrada'), { status: 404 });
    if (ent.estado !== 'pendiente') throw Object.assign(new Error('Esta acta ya fue confirmada o anulada.'), { status: 409 });
    if (!(ctx.canManage || ent.data?.receptor_id === ctx.user.id)) throw Object.assign(new Error('Solo el receptor o un administrador puede confirmar.'), { status: 403 });
    if (ent.data?.entregado_por_id === ctx.user.id && !ctx.isAdmin) throw Object.assign(new Error('Quien entrega no puede confirmar su propia entrega.'), { status: 403 });
    const diferencia = recibido - num(ent.monto_entregado);
    if (Math.abs(diferencia) >= 1 && !nota.trim()) throw Object.assign(new Error('Hay diferencia: escribe una nota explicando.'), { status: 400 });
    const estado = Math.abs(diferencia) < 1 ? 'confirmada' : 'con_diferencia';
    const now = new Date().toISOString();

    await client.query(
      `UPDATE entity_entrega_efectivo SET estado = $1, updated_date = NOW(), data = data || $2::jsonb WHERE id = $3`,
      [estado, JSON.stringify({ estado, monto_recibido: recibido, diferencia_recepcion: diferencia, nota_recepcion: nota,
        confirmado_por_id: ctx.user.id, confirmado_por: ctx.name, fecha_confirmacion: now }), ent.id]
    );
    const ids = (ent.data?.dias || []).map((d) => d.control_id);
    await client.query(
      `UPDATE entity_cash_control SET cash_collected = true, updated_date = NOW(),
         data = data || jsonb_build_object('cash_collected_date', $1::text, 'cash_collected_by', $2::text, 'entrega_estado', $3::text)
       WHERE id = ANY($4) AND company_id = $5`,
      [now, ctx.user.email, estado, ids, ctx.companyId]
    );
    await client.query('COMMIT');
    res.json({ ok: true, estado, diferencia });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('confirmar entrega:', e.message);
    res.status(500).json({ error: 'No se pudo confirmar' });
  } finally {
    client.release();
  }
});

// Anular (solo mientras está pendiente: quien la hizo o un administrador)
router.post('/:id/anular', async (req, res) => {
  const ctx = await loadContext(req).catch(() => null);
  if (!ctx) return res.status(401).json({ error: 'No autenticado' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM entity_entrega_efectivo WHERE id = $1 AND company_id = $2 FOR UPDATE', [req.params.id, ctx.companyId]);
    const ent = rows[0];
    if (!ent) throw Object.assign(new Error('Acta no encontrada'), { status: 404 });
    if (ent.estado !== 'pendiente') throw Object.assign(new Error('Solo se puede anular un acta pendiente.'), { status: 409 });
    if (!(ctx.isAdmin || ent.data?.entregado_por_id === ctx.user.id)) throw Object.assign(new Error('Solo quien la registró o un administrador puede anularla.'), { status: 403 });
    await client.query(
      `UPDATE entity_entrega_efectivo SET estado = 'anulada', updated_date = NOW(),
         data = data || jsonb_build_object('estado', 'anulada', 'anulada_por', $1::text, 'fecha_anulacion', $2::text) WHERE id = $3`,
      [ctx.name, new Date().toISOString(), ent.id]
    );
    const ids = (ent.data?.dias || []).map((d) => d.control_id);
    await client.query(
      `UPDATE entity_cash_control SET updated_date = NOW(), data = data - 'entrega_id' - 'entrega_numero' - 'entrega_estado'
       WHERE id = ANY($1) AND company_id = $2`,
      [ids, ctx.companyId]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.status) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: 'No se pudo anular' });
  } finally {
    client.release();
  }
});

export default router;
