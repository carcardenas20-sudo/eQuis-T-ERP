import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, query } from '../db.js';
import { ENTITY_SCHEMAS, splitRecord } from '../entitySchemas.js';

// Hojas de corte (producción tipo V-LIVE):
//  - El cortador registra referencias con tallas/cantidades y los rollos usados
//    (hojas tendidas y metros que QUEDARON en cada rollo).
//  - Al guardar, en una sola transacción: número HC-0001 por empresa, descuento de
//    rollos, suma de unidades al inventario de producción (por referencia) y movimiento.
//  - Anular revierte todo, solo si esas unidades aún no se despacharon.
const router = express.Router();

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
    allowed: isAdmin || permissions.includes('produccion_view'),
    companyId: (isAdmin && requested) ? String(requested) : (u.company_id || 'equist'),
  };
}

const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;
const todayBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

async function insertEntity(client, type, record, companyId, userId, id = uuidv4()) {
  const schema = ENTITY_SCHEMAS[type];
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

// Suma (o resta) unidades al inventario de producción de una referencia y deja el movimiento.
async function moveProductionStock(client, { companyId, userId, reference, qty, reason, hojaId }) {
  const { rows } = await client.query(
    `SELECT id, current_stock FROM entity_inventory
     WHERE company_id = $1 AND product_id IS NULL AND data->>'product_reference' = $2
     ORDER BY current_stock DESC LIMIT 1 FOR UPDATE`,
    [companyId, reference]
  );
  const prev = rows[0] ? num(rows[0].current_stock) : 0;
  const next = prev + qty;
  if (next < -0.001) {
    const e = new Error(`La referencia ${reference} solo tiene ${prev} unidades en producción (ya se despacharon las demás).`);
    e.status = 400;
    throw e;
  }
  if (rows[0]) {
    await client.query('UPDATE entity_inventory SET current_stock = $1, updated_date = NOW() WHERE id = $2', [next, rows[0].id]);
  } else {
    await insertEntity(client, 'Inventory', { current_stock: next, product_reference: reference, min_stock: 0 }, companyId, userId);
  }
  await insertEntity(client, 'StockMovement', {
    movement_type: qty >= 0 ? 'entrada' : 'salida',
    quantity: Math.abs(qty),
    movement_date: todayBogota(),
    reference_id: hojaId,
    product_reference: reference,
    reason,
    previous_stock: prev,
    new_stock: next,
  }, companyId, userId);
}

router.post('/', async (req, res) => {
  const ctx = await loadContext(req).catch(() => null);
  if (!ctx?.allowed) return res.status(403).json({ error: 'No tienes permiso para registrar hojas de corte' });

  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.fecha || '')) ? req.body.fecha : todayBogota();
  const notas = String(req.body?.notas || '').slice(0, 500);
  const referencias = (Array.isArray(req.body?.referencias) ? req.body.referencias : [])
    .map(r => ({
      reference: String(r.reference || '').trim().toUpperCase(),
      product_name: String(r.product_name || '').trim(),
      sizes: (Array.isArray(r.sizes) ? r.sizes : [])
        .map(s => ({ size: String(s.size || '').trim().toUpperCase(), quantity: Math.round(num(s.quantity)) }))
        .filter(s => s.size && s.quantity > 0),
    }))
    .filter(r => r.reference && r.sizes.length)
    .map(r => ({ ...r, total: r.sizes.reduce((s, x) => s + x.quantity, 0) }));
  const rollosIn = (Array.isArray(req.body?.rollos) ? req.body.rollos : [])
    .filter(r => r.rollo_id && r.sobrante_metros !== '' && r.sobrante_metros !== undefined && r.sobrante_metros !== null);

  if (!referencias.length) return res.status(400).json({ error: 'Agrega al menos una referencia con tallas y cantidades.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Número consecutivo por empresa (HC-0001…)
    const { rows: cn } = await client.query(
      `UPDATE entity_company
         SET data = jsonb_set(data, '{hoja_corte_next}', to_jsonb(COALESCE((data->>'hoja_corte_next')::bigint, 1) + 1))
       WHERE id = $1 RETURNING (data->>'hoja_corte_next')::bigint - 1 AS n`,
      [ctx.companyId]
    );
    const numero = `HC-${String(cn[0]?.n || 1).padStart(4, '0')}`;
    const hojaId = uuidv4();

    // Rollos usados: lo gastado = disponible − lo que quedó
    const rollosUsados = [];
    for (const r of rollosIn) {
      const sobrante = num(r.sobrante_metros);
      const { rows } = await client.query(
        'SELECT id, codigo, metros_disponibles, data FROM entity_rollo_tela WHERE id = $1 AND company_id = $2 FOR UPDATE',
        [r.rollo_id, ctx.companyId]
      );
      const rollo = rows[0];
      if (!rollo) throw Object.assign(new Error('Uno de los rollos no existe.'), { status: 400 });
      const disp = num(rollo.metros_disponibles);
      if (sobrante < 0 || sobrante > disp + 0.001) {
        throw Object.assign(new Error(`El rollo ${rollo.codigo} tenía ${disp} m; revisa lo que quedó.`), { status: 400 });
      }
      const gastado = r2(disp - sobrante);
      const kilosIni = num(rollo.data?.kilos_iniciales);
      const metrosIni = num(rollo.data?.metros_iniciales);
      const mov = { fecha, tipo: 'consumo', metros: gastado, nota: `Hoja de corte ${numero}`, referencia_tipo: 'hoja_corte', referencia_id: hojaId };
      await client.query(
        `UPDATE entity_rollo_tela
           SET metros_disponibles = $1, estado = $2, updated_date = NOW(),
               data = jsonb_set(data, '{movimientos}', COALESCE(data->'movimientos', '[]'::jsonb) || $3::jsonb)
         WHERE id = $4`,
        [sobrante, sobrante > 0.001 ? 'disponible' : 'agotado', JSON.stringify([mov]), rollo.id]
      );
      rollosUsados.push({
        rollo_id: rollo.id, codigo: rollo.codigo,
        tela: rollo.data?.materia_prima_nombre || '', color: rollo.data?.color_nombre || '',
        hojas: Math.round(num(r.hojas)), puntas: String(r.puntas || '').slice(0, 100),
        metros_antes: disp, metros_gastados: gastado, metros_sobrante: sobrante,
        kilos_gastados: metrosIni > 0 ? r2(kilosIni * gastado / metrosIni) : 0,
      });
    }

    // Unidades cortadas → inventario de producción (listas para despachar a operarios)
    for (const ref of referencias) {
      await moveProductionStock(client, {
        companyId: ctx.companyId, userId: ctx.user.id, reference: ref.reference, qty: ref.total,
        reason: `Hoja de corte ${numero}`, hojaId,
      });
    }

    const totalUnidades = referencias.reduce((s, r) => s + r.total, 0);
    await insertEntity(client, 'HojaCorte', {
      numero, fecha, estado: 'activa', total_unidades: totalUnidades,
      referencias,
      rollos_usados: rollosUsados,
      total_hojas: rollosUsados.reduce((s, r) => s + r.hojas, 0),
      total_metros_gastados: r2(rollosUsados.reduce((s, r) => s + r.metros_gastados, 0)),
      total_kilos_gastados: r2(rollosUsados.reduce((s, r) => s + r.kilos_gastados, 0)),
      total_sobrante: r2(rollosUsados.reduce((s, r) => s + r.metros_sobrante, 0)),
      colores: [...new Set(rollosUsados.map(r => r.color).filter(Boolean))].join(', '),
      notas,
      registrado_por: ctx.user.full_name || ctx.user.email,
    }, ctx.companyId, ctx.user.id, hojaId);

    await client.query('COMMIT');
    res.json({ ok: true, id: hojaId, numero, total_unidades: totalUnidades });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('POST /hojas-corte:', e.message);
    res.status(500).json({ error: 'No se pudo guardar la hoja de corte' });
  } finally {
    client.release();
  }
});

// Anular: devuelve la tela a los rollos y quita las unidades del inventario de producción.
router.post('/:id/anular', async (req, res) => {
  const ctx = await loadContext(req).catch(() => null);
  if (!ctx?.allowed) return res.status(403).json({ error: 'No tienes permiso' });
  const motivo = String(req.body?.motivo || '').slice(0, 300);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id, estado, data FROM entity_hoja_corte WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [req.params.id, ctx.companyId]
    );
    const hoja = rows[0];
    if (!hoja) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Hoja no encontrada' }); }
    if (hoja.estado === 'anulada') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Ya estaba anulada' }); }
    const numero = hoja.data?.numero || '';

    for (const ref of hoja.data?.referencias || []) {
      await moveProductionStock(client, {
        companyId: ctx.companyId, userId: ctx.user.id, reference: ref.reference, qty: -num(ref.total),
        reason: `Anulación hoja de corte ${numero}`, hojaId: hoja.id,
      });
    }
    for (const u of hoja.data?.rollos_usados || []) {
      const mov = { fecha: todayBogota(), tipo: 'ajuste', metros: num(u.metros_gastados), nota: `Anulación hoja de corte ${numero}` };
      await client.query(
        `UPDATE entity_rollo_tela
           SET metros_disponibles = metros_disponibles + $1, estado = 'disponible', updated_date = NOW(),
               data = jsonb_set(data, '{movimientos}', COALESCE(data->'movimientos', '[]'::jsonb) || $2::jsonb)
         WHERE id = $3 AND company_id = $4`,
        [num(u.metros_gastados), JSON.stringify([mov]), u.rollo_id, ctx.companyId]
      );
    }
    await client.query(
      `UPDATE entity_hoja_corte SET estado = 'anulada', updated_date = NOW(), data = data || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ estado: 'anulada', motivo_anulacion: motivo, anulada_por: ctx.user.full_name || ctx.user.email, fecha_anulacion: todayBogota() }), hoja.id]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('anular hoja:', e.message);
    res.status(500).json({ error: 'No se pudo anular' });
  } finally {
    client.release();
  }
});

export default router;
