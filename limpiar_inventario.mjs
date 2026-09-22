// Limpieza de "apuntes falsos" de inventario.
// SEGURO POR DEFECTO: dry-run (no borra nada, solo muestra). Para ejecutar de verdad:
//   EXECUTE=1 node --env-file=.env limpiar_inventario.mjs
// Antes de borrar hace un RESPALDO de las filas afectadas en un archivo JSON.
import pg from 'pg';
import { writeFileSync } from 'fs';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = async (sql, p) => (await pool.query(sql, p)).rows;
const EXECUTE = process.env.EXECUTE === '1';
const locs = await q(`SELECT id, name FROM entity_location`);
const L = {}; locs.forEach(l => L[l.id] = l.name);
const idOf = (s) => (String(s || '').match(/#([0-9a-fA-F-]{6,})/) || [])[1] || null;

// A) ANULACIONES FANTASMA (return sin venta detrás)
const sales = await q(`SELECT product_id, location_id, data->>'reason' reason FROM entity_inventory_movement WHERE movement_type='sale'`);
const saleKeys = new Set();
sales.forEach(s => { const id = idOf(s.reason); if (id) saleKeys.add(`${s.location_id}|${s.product_id}|${id}`); });
const returns = await q(`SELECT id, to_char(movement_date,'YYYY-MM-DD') d, product_id, location_id, quantity, data->>'reason' reason
  FROM entity_inventory_movement WHERE movement_type='return' AND (data->>'reason') LIKE 'Anulaci%'`);
const phantomIds = [];
for (const r of returns) { const id = idOf(r.reason); if (id && !saleKeys.has(`${r.location_id}|${r.product_id}|${id}`)) phantomIds.push(r); }

// B) DUPLICADOS EXACTOS (mantener 1, borrar el resto) en transfer* y return
const dupExtras = await q(`
  WITH ranked AS (
    SELECT id, product_id, location_id, quantity, movement_type, data->>'reason' reason,
           to_char(movement_date,'YYYY-MM-DD') d,
           ROW_NUMBER() OVER (PARTITION BY to_char(movement_date,'YYYY-MM-DD'), movement_type, product_id, location_id, quantity, data->>'reason' ORDER BY created_date) rn
    FROM entity_inventory_movement
    WHERE movement_type IN ('transfer_in','transfer_out','transfer_return','return','entry','merchandise_assignment')
  )
  SELECT id, d, movement_type, product_id, location_id, quantity, reason FROM ranked WHERE rn > 1`);

// Unir ids a borrar (sin repetir)
const toDelete = new Map();
phantomIds.forEach(r => toDelete.set(r.id, { ...r, motivo: 'anulación sin venta' }));
dupExtras.forEach(r => toDelete.set(r.id, { ...r, motivo: 'movimiento duplicado' }));
const rows = [...toDelete.values()];

console.log(`=== LIMPIEZA DE MOVIMIENTOS FALSOS — modo ${EXECUTE ? 'EJECUTAR ⚠️' : 'DRY-RUN (no borra)'} ===`);
const porSede = {};
rows.forEach(r => { const s = L[r.location_id] || r.location_id; porSede[s] = porSede[s] || { n: 0, u: 0 }; porSede[s].n++; porSede[s].u += Number(r.quantity); });
Object.entries(porSede).forEach(([s, v]) => console.log(`  ${s}: ${v.n} movimientos a borrar (${v.u > 0 ? '+' : ''}${Math.round(v.u)} uds de efecto)`));
console.log(`  TOTAL: ${rows.length} movimientos`);
console.log('  — muestra —');
rows.slice(0, 15).forEach(r => console.log(`    ${r.d} | ${L[r.location_id]||r.location_id} | ${r.movement_type} | ref ${r.product_id} | ${Number(r.quantity)} | ${r.motivo}`));
if (rows.length > 15) console.log(`    … y ${rows.length - 15} más`);

// FICHAS DUPLICADAS (solo se REPORTA; consolidar mantiene la suma, no cambia el número)
const fichas = await q(`SELECT product_id, location_id, COUNT(*) n, SUM(current_stock) suma FROM entity_inventory
  WHERE location_id IS NOT NULL GROUP BY 1,2 HAVING COUNT(*)>1`);
console.log('\n=== FICHAS DUPLICADAS (se consolidarían a 1 fila, manteniendo la suma) ===');
fichas.forEach(f => console.log(`  ${L[f.location_id]||f.location_id} | ref ${f.product_id} | ${f.n} fichas → 1 fila = ${Number(f.suma)} (sin cambiar el total)`));

if (!EXECUTE) {
  console.log('\nDRY-RUN: no se borró nada. Para ejecutar: EXECUTE=1 node --env-file=.env limpiar_inventario.mjs');
} else {
  // Respaldo antes de borrar
  const backup = await q(`SELECT * FROM entity_inventory_movement WHERE id = ANY($1::text[])`, [rows.map(r => r.id)]);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bfile = `respaldo_movimientos_borrados_${stamp}.json`;
  writeFileSync(bfile, JSON.stringify(backup, null, 2));
  console.log(`\nRespaldo de ${backup.length} filas → ${bfile}`);
  const del = await q(`DELETE FROM entity_inventory_movement WHERE id = ANY($1::text[])`, [rows.map(r => r.id)]);
  console.log(`Borrados ${del.length ?? rows.length} movimientos falsos.`);
  console.log('NOTA: las fichas de inventario (números mostrados) NO se tocaron — se ajustan con el conteo físico.');
}
await pool.end();
