#!/usr/bin/env node
/**
 * import-vlive.mjs — Migra V-LIVE (Base44) a la empresa V-LIVE del sistema nuevo.
 *
 *   node --env-file=.env scripts/import-vlive.mjs            → ENSAYO: importa todo en una
 *        transacción, corre los cuadres y DESHACE todo (ROLLBACK). No deja nada.
 *   node --env-file=.env scripts/import-vlive.mjs --commit   → IMPORTACIÓN REAL (solo el día del cambio).
 *
 * Enfoque "saldos exactos + historial":
 *  - Inventario de tiendas, inventario de producción y créditos se copian tal como están
 *    (no se recalculan), así cuadran al peso con Base44.
 *  - El historial (ventas, pagos, gastos, cajas, compras, movimientos, despachos, entregas,
 *    hojas de corte…) se copia marcado con _origen='base44_vlive' y NO mueve inventario ni saldos.
 *  - Todo lleva _lote (id de esta importación) para poder identificarlo o deshacerlo.
 * Lee de scripts/exports-vlive/ (generado por export-vlive.js).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { ENTITY_SCHEMAS, splitRecord } from '../server/entitySchemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXP = path.join(__dirname, 'exports-vlive');
const COMMIT = process.argv.includes('--commit');
const VL = 'e834dd2d-9511-4a12-bea8-558ae3c386a5'; // empresa V-LIVE en el sistema nuevo
const LOTE = `vlive_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;
const META = new Set(['created_by', 'is_sample', 'created_by_id']);

const load = (app, e) => {
  const f = path.join(EXP, app, `${e}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
};
const num = (v) => Number(v) || 0;
const ts = (v) => (v ? (/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`) : new Date().toISOString());

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const log = (...a) => console.log(...a);
const conteo = {};

function clean(rec) {
  const out = {};
  for (const [k, v] of Object.entries(rec)) if (!META.has(k) && k !== 'id' && k !== 'created_date' && k !== 'updated_date') out[k] = v;
  return out;
}

async function insert(type, rec, extra = {}) {
  const schema = ENTITY_SCHEMAS[type];
  const body = { ...clean(rec), ...extra, _origen: 'base44_vlive', _lote: LOTE };
  const created = ts(rec.created_date);
  const updated = ts(rec.updated_date || rec.created_date);
  if (schema) {
    const { typedValues, dataRest } = splitRecord(schema, body);
    const typedCols = Object.keys(schema.typed);
    const cols = ['id', ...typedCols, 'data', 'created_date', 'updated_date', 'created_by_id', 'company_id'];
    const vals = [rec.id, ...typedCols.map((c) => (typedValues[c] !== undefined ? typedValues[c] : null)),
      JSON.stringify(dataRest), created, updated, null, VL];
    await client.query(`INSERT INTO ${schema.table} (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')})`, vals);
  } else {
    await client.query(
      `INSERT INTO app_entities (id, entity_type, data, created_date, updated_date, created_by_id, company_id) VALUES ($1,$2,$3,$4,$5,NULL,$6)`,
      [rec.id, type, JSON.stringify(body), created, updated, VL]
    );
  }
  conteo[type] = (conteo[type] || 0) + 1;
}

// Inserción por lotes (una sentencia por cada 200 registros)
async function insertMany(type, rows, tf) {
  const schema = ENTITY_SCHEMAS[type];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const params = [];
    const tuples = [];
    for (const rec of chunk) {
      const extra = tf ? (tf(rec).extra || {}) : {};
      const body = { ...clean(rec), ...extra, _origen: 'base44_vlive', _lote: LOTE };
      const created = ts(rec.created_date);
      const updated = ts(rec.updated_date || rec.created_date);
      let vals;
      if (schema) {
        const { typedValues, dataRest } = splitRecord(schema, body);
        const typedCols = Object.keys(schema.typed);
        vals = [rec.id, ...typedCols.map((c) => (typedValues[c] !== undefined ? typedValues[c] : null)), JSON.stringify(dataRest), created, updated, null, VL];
      } else {
        vals = [rec.id, type, JSON.stringify(body), created, updated, null, VL];
      }
      tuples.push(`(${vals.map((_, j) => `$${params.length + j + 1}`).join(', ')})`);
      params.push(...vals);
    }
    if (schema) {
      const cols = ['id', ...Object.keys(schema.typed), 'data', 'created_date', 'updated_date', 'created_by_id', 'company_id'];
      await client.query(`INSERT INTO ${schema.table} (${cols.join(', ')}) VALUES ${tuples.join(', ')}`, params);
    } else {
      await client.query(`INSERT INTO app_entities (id, entity_type, data, created_date, updated_date, created_by_id, company_id) VALUES ${tuples.join(', ')}`, params);
    }
    conteo[type] = (conteo[type] || 0) + chunk.length;
  }
}

// ── Choques de id: ningún id de V-LIVE puede existir ya en la tabla destino ──
async function checkCollisions(type, rows) {
  if (!rows.length) return 0;
  const schema = ENTITY_SCHEMAS[type];
  const ids = rows.map((r) => r.id);
  const { rows: hit } = schema
    ? await client.query(`SELECT id FROM ${schema.table} WHERE id = ANY($1)`, [ids])
    : await client.query(`SELECT id FROM app_entities WHERE entity_type = $1 AND id = ANY($2)`, [type, ids]);
  return hit.length;
}

// ── Datos ──
const P = (e) => load('v-livepos', e);
const M = (e) => load('manufacturavlive', e);

const plan = [
  // [tipo destino, filas, transformación opcional]
  ['Location', P('Location'), (r) => ({ extra: { name: r.name === 'Lo Nuestro' ? 'Lo Nuestro – V-LIVE' : r.name, tipo: 'sucursal' } })],
  ['Category', P('Category')],
  ['Customer', P('Customer')],
  ['Product', P('Product')],
  ['PriceList', P('PriceList')],
  ['ProductPrice', P('ProductPrice')],
  ['SystemSettings', P('SystemSettings')],
  ['Supplier', P('Supplier'), (r) => ({ extra: { nombre: r.name, activo: r.is_active !== false, direccion: r.address || '', contactos: [{ nombre: r.contact_name || '', telefono: r.phone || '', email: r.email || '' }] } })],
  ['Inventory', P('Inventory')],
  ['Credit', P('Credit')],
  ['Sale', P('Sale')],
  ['SaleItem', P('SaleItem')],
  ['Payment', P('Payment')],
  ['Expense', P('Expense')],
  ['CashControl', P('CashControl')],
  ['Purchase', P('Purchase')],
  ['PurchaseItem', P('PurchaseItem')],
  ['InventoryMovement', P('InventoryMovement')],
  ['Exchange', P('Exchange')],
  ['InventoryAudit', P('InventoryAudit')],
  ['Employee', M('Employee')],
  ['Producto', M('Product'), (r) => ({ extra: { nombre: r.name, costo_mano_obra: num(r.manufacturing_price), precio_empleado: num(r.employee_price), categoria: r.category || '', descripcion: r.description || '', activo: r.is_active !== false } })],
  ['Inventory', M('Inventory')],
  ['Dispatch', M('Dispatch')],
  ['Delivery', M('Delivery')],
  ['Payment', M('Payment')],
  ['EmployeePurchase', M('EmployeePurchase')],
  ['StockMovement', M('StockMovement')],
  ['ActivityLog', M('ActivityLog')],
];

// Hojas de corte: CutRecord → HojaCorte (numeradas HC-0001… por fecha de corte)
const cuts = M('CutRecord').slice().sort((a, b) => String(a.entry_date || a.created_date).localeCompare(String(b.entry_date || b.created_date)));
const hojas = cuts.map((c, i) => {
  const sizes = (c.size_breakdown || []).map((s) => ({ size: String(s.size || '').toUpperCase(), quantity: num(s.quantity) })).filter((s) => s.quantity > 0);
  return {
    id: c.id, created_date: c.created_date, updated_date: c.updated_date,
    numero: `HC-${String(i + 1).padStart(4, '0')}`,
    fecha: String(c.entry_date || c.created_date || '').slice(0, 10),
    estado: 'activa',
    total_unidades: num(c.total_quantity),
    referencias: [{ reference: String(c.product_reference || '').toUpperCase(), product_name: c.product_name || '', sizes, total: num(c.total_quantity) }],
    rollos_usados: (c.rolls || []).map((r) => ({ codigo: '(histórico)', color: r.color || '', tela: '', hojas: num(r.sheet_count),
      metros_antes: num(r.roll_meters), metros_gastados: num(r.real_meters), metros_sobrante: num(r.leftover_meters), kilos_gastados: num(r.roll_weight_kg) })),
    total_hojas: num(c.total_sheet_count), total_metros_gastados: num(c.total_real_meters), total_kilos_gastados: num(c.total_roll_weight_kg),
    total_sobrante: num(c.total_leftover_meters), colores: c.color_summary || '', notas: c.notes || '',
    registrado_por: 'Base44 (histórico)',
  };
});
plan.push(['HojaCorte', hojas]);

// ── Ejecutar ──
log(`\n${COMMIT ? '⚠️  IMPORTACIÓN REAL' : '🧪 ENSAYO (se deshace al final)'} · lote ${LOTE}\n`);
await client.query('BEGIN');
let ok = true;
try {
  // 1. Choques
  let choques = 0;
  for (const [type, rows] of plan) {
    const n = await checkCollisions(type, rows);
    if (n) { log(`✗ ${type}: ${n} ids ya existen en el sistema`); choques += n; }
  }
  if (choques) throw new Error(`Hay ${choques} ids repetidos; no se importa nada.`);
  log('✓ Sin choques de ids');

  // 2. Insertar
  for (const [type, rows, tf] of plan) {
    await insertMany(type, rows, tf);
    process.stdout.write(`  · ${type} ${rows.length}
`);
  }
  log('✓ Registros importados:', JSON.stringify(conteo));

  // 3. Contador de hojas de corte de V-LIVE
  await client.query(
    `UPDATE entity_company SET data = jsonb_set(data, '{hoja_corte_next}', to_jsonb($1::bigint)) WHERE id = $2`,
    [hojas.length + 1, VL]
  );

  // ── 4. CUADRES contra Base44 ──
  log('\n── Cuadres (sistema nuevo vs Base44) ──');
  const checks = [];
  const chk = (nombre, nuevo, base) => { const okc = Math.abs(num(nuevo) - num(base)) < 0.5; checks.push(okc); log(`${okc ? '✓' : '✗'} ${nombre}: nuevo ${num(nuevo).toLocaleString('es-CO')} · Base44 ${num(base).toLocaleString('es-CO')}`); };
  const one = async (sql, p = [VL]) => (await client.query(sql, p)).rows[0];

  chk('Clientes', (await one(`SELECT count(*) n FROM entity_customer WHERE company_id=$1`)).n, P('Customer').length);
  chk('Productos', (await one(`SELECT count(*) n FROM entity_product WHERE company_id=$1`)).n, P('Product').length);
  const credOpen = P('Credit').filter((c) => num(c.pending_amount) > 0);
  chk('Créditos abiertos (cantidad)', (await one(`SELECT count(*) n FROM entity_credit WHERE company_id=$1 AND pending_amount > 0`)).n, credOpen.length);
  chk('Créditos abiertos (saldo $)', (await one(`SELECT COALESCE(sum(pending_amount),0) s FROM entity_credit WHERE company_id=$1`)).s, P('Credit').reduce((s, c) => s + num(c.pending_amount), 0));
  chk('Ventas (cantidad)', (await one(`SELECT count(*) n FROM entity_sale WHERE company_id=$1`)).n, P('Sale').length);
  chk('Ventas (total $)', (await one(`SELECT COALESCE(sum(total_amount),0) s FROM entity_sale WHERE company_id=$1`)).s, P('Sale').reduce((s, x) => s + num(x.total_amount), 0));
  chk('Inventario tiendas (unidades)', (await one(`SELECT COALESCE(sum(current_stock),0) s FROM entity_inventory WHERE company_id=$1 AND product_id IS NOT NULL`)).s, P('Inventory').reduce((s, i) => s + num(i.current_stock), 0));
  // por producto y sucursal
  const invNew = (await client.query(`SELECT product_id, location_id, sum(current_stock) s FROM entity_inventory WHERE company_id=$1 AND product_id IS NOT NULL GROUP BY 1,2`, [VL])).rows;
  const invMap = Object.fromEntries(invNew.map((r) => [`${r.product_id}|${r.location_id}`, num(r.s)]));
  const invBase = {};
  for (const i of P('Inventory')) { const k = `${i.product_id}|${i.location_id}`; invBase[k] = (invBase[k] || 0) + num(i.current_stock); }
  const difInv = Object.keys({ ...invBase, ...invMap }).filter((k) => Math.abs((invMap[k] || 0) - (invBase[k] || 0)) > 0.001);
  checks.push(!difInv.length); log(`${difInv.length ? '✗' : '✓'} Inventario por producto y sucursal: ${difInv.length ? difInv.length + ' diferencias' : 'idéntico'}`);
  chk('Inventario producción (unidades)', (await one(`SELECT COALESCE(sum(current_stock),0) s FROM entity_inventory WHERE company_id=$1 AND product_id IS NULL`)).s, M('Inventory').reduce((s, i) => s + num(i.current_stock), 0));

  // Pendiente por operario (despachado − entregado, unidades)
  log('\nPendiente por operario (unidades despachadas − entregadas):');
  const emps = M('Employee');
  for (const e of emps) {
    const d = (await one(`SELECT COALESCE(sum(quantity),0) s FROM entity_dispatch WHERE company_id=$1 AND employee_id=$2`, [VL, e.employee_id])).s;
    const delRows = (await client.query(`SELECT quantity, data->'items' items FROM entity_delivery WHERE company_id=$1 AND employee_id=$2`, [VL, e.employee_id])).rows;
    const ent = delRows.reduce((s, r) => s + (Array.isArray(r.items) && r.items.length ? r.items.reduce((a, i) => a + num(i.quantity), 0) : num(r.quantity)), 0);
    const baseD = M('Dispatch').filter((x) => x.employee_id === e.employee_id).reduce((s, x) => s + num(x.quantity), 0);
    const baseE = M('Delivery').filter((x) => x.employee_id === e.employee_id).reduce((s, x) => s + (x.items?.length ? x.items.reduce((a, i) => a + num(i.quantity), 0) : num(x.quantity)), 0);
    chk(`  ${e.name}`, num(d) - ent, baseD - baseE);
  }

  // Saldo en dinero por operario (entregas − pagos − compras por descuento), para comparar con Base44
  log('\nSaldo $ por operario (entregas − abonos − compras descontadas) — compáralo con lo que muestra Base44:');
  for (const e of emps) {
    const ent = M('Delivery').filter((x) => x.employee_id === e.employee_id).reduce((s, x) => s + num(x.total_amount), 0);
    const pag = M('Payment').filter((x) => x.employee_id === e.employee_id).reduce((s, x) => s + num(x.amount), 0);
    const comp = M('EmployeePurchase').filter((x) => x.employee_id === e.employee_id && x.payment_method === 'descuento_saldo').reduce((s, x) => s + num(x.total_amount) - num(x.manufacturing_total_amount), 0);
    log(`  ${e.name.padEnd(18)} entregas $${ent.toLocaleString('es-CO')} − abonos $${pag.toLocaleString('es-CO')} − compras $${comp.toLocaleString('es-CO')} = $${(ent - pag - comp).toLocaleString('es-CO')}`);
  }

  const fallas = checks.filter((x) => !x).length;
  log(`\n${fallas ? `✗ ${fallas} cuadre(s) NO cuadran` : '✓ TODOS LOS CUADRES OK'}`);
  if (COMMIT && fallas) throw new Error('No se confirma: hay cuadres que no cuadran.');
} catch (e) {
  ok = false;
  log('\n✗ ERROR:', e.message);
}

if (COMMIT && ok) {
  await client.query('COMMIT');
  log(`\n✅ Importación CONFIRMADA (lote ${LOTE}).`);
} else {
  await client.query('ROLLBACK');
  log(`\n↩️  ${COMMIT ? 'Importación cancelada' : 'Ensayo terminado'}: no quedó nada en la base de datos.`);
}
await client.end();
