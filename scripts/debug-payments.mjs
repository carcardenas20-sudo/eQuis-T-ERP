import { query } from '../server/db.js';

console.log('\n=== DIAGNÓSTICO DE ABONOS ===\n');

// 1. ¿Cuántos registros hay en entity_payment?
const total = await query(`SELECT COUNT(*) FROM entity_payment`);
console.log('Total registros en entity_payment:', total.rows[0].count);

// 2. ¿Existen las columnas type y location_id?
const cols = await query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'entity_payment'
  ORDER BY ordinal_position
`);
console.log('\nColumnas de entity_payment:');
cols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

// 3. Buscar credit_payments por columna type
const byType = await query(`SELECT COUNT(*) FROM entity_payment WHERE type = 'credit_payment'`);
console.log('\nRegistros con type = credit_payment (columna):', byType.rows[0].count);

// 4. Buscar credit_payments por JSONB
const byJsonb = await query(`SELECT COUNT(*) FROM entity_payment WHERE data @> '{"type":"credit_payment"}'::jsonb`);
console.log('Registros con type = credit_payment (JSONB):', byJsonb.rows[0].count);

// 5. Mostrar los últimos 5 credit_payments con sus campos clave
const recent = await query(`
  SELECT id, type, amount, payment_date,
         data->>'method' as method,
         data->>'location_id' as location_id_jsonb,
         location_id,
         data->>'type' as type_jsonb,
         data->>'amount' as amount_jsonb
  FROM entity_payment
  WHERE type = 'credit_payment' OR data @> '{"type":"credit_payment"}'::jsonb
  ORDER BY created_date DESC
  LIMIT 5
`);
console.log('\nÚltimos credit_payments:');
recent.rows.forEach(r => {
  console.log(`  id=${r.id.slice(-8)}`);
  console.log(`    type(col)=${r.type} | type(jsonb)=${r.type_jsonb}`);
  console.log(`    amount(col)=${r.amount} | amount(jsonb)=${r.amount_jsonb}`);
  console.log(`    payment_date=${r.payment_date}`);
  console.log(`    method=${r.method} | location_id(col)=${r.location_id} | location_id(jsonb)=${r.location_id_jsonb}`);
});

// 6. Ver migraciones ejecutadas
const migs = await query(`SELECT name, applied_at FROM schema_migrations ORDER BY applied_at`);
console.log('\nMigraciones ejecutadas:');
migs.rows.forEach(m => console.log(`  ${m.name}: ${m.applied_at}`));

process.exit(0);
