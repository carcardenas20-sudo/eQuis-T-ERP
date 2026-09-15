// Borra el registro de caja DUPLICADO del 28-jul-2026 en "Lo Nuestro".
// Seguro: solo actúa si hay exactamente 2 registros y el duplicado NO está marcado.
// Correr con:  node --env-file=.env borrar_dup_caja.mjs
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const LOC = '68cf129b65e6000b09661e3c';

const { rows } = await pool.query(`
  SELECT id, cash_amount, transfer_amount, cash_collected, transfers_verified
  FROM entity_cash_control
  WHERE control_date::text LIKE '2026-07-28%' AND location_id = $1
  ORDER BY (COALESCE(cash_amount,0) + COALESCE(transfer_amount,0)) ASC`, [LOC]);

console.log(`Registros del 28-jul en "Lo Nuestro": ${rows.length}`);
rows.forEach((x, i) => console.log(`  ${i === 0 ? 'BORRAR  →' : 'CONSERVAR:'} id=${x.id}  efvo=${x.cash_amount}  transf=${x.transfer_amount}  recogido=${x.cash_collected}  verif=${x.transfers_verified}`));

if (rows.length !== 2) {
  console.log('\n⚠️  No son exactamente 2 registros — NO se borra nada por seguridad.');
} else if (rows[0].cash_collected || rows[0].transfers_verified) {
  console.log('\n⚠️  El duplicado ya está marcado como recogido/verificado — NO se borra. Avísame.');
} else {
  const del = await pool.query(`DELETE FROM entity_cash_control WHERE id = $1`, [rows[0].id]);
  console.log(`\n✅ Listo: borrado ${del.rowCount} registro duplicado. Recarga la página de Control de Efectivo.`);
}
await pool.end();
