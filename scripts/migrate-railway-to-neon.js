#!/usr/bin/env node
/**
 * migrate-railway-to-neon.js
 * Copia TODA la base de datos de un Postgres origen (Railway) a uno destino (Neon).
 *
 * - Descubre automáticamente todas las tablas del esquema public del origen
 *   (app_users, app_entities, schema_migrations, todas las entity_*, etc.).
 * - Reconstruye cada tabla idéntica en el destino (columnas, tipos y llave primaria).
 * - Copia todas las filas en lotes, sin perder nada (ON CONFLICT DO NOTHING → re-ejecutable).
 * - Verifica que el número de filas coincida entre origen y destino.
 *
 * Uso (PowerShell):
 *   $env:SOURCE_DATABASE_URL = "postgresql://...RAILWAY..."
 *   $env:DATABASE_URL        = "postgresql://...NEON..."
 *   node scripts/migrate-railway-to-neon.js
 *
 * Es seguro correrlo varias veces: no duplica filas ya copiadas.
 */

import pg from 'pg';

// ─── Fidelidad de tipos: traer fechas y JSON como texto crudo (round-trip exacto) ──
pg.types.setTypeParser(1184, v => v); // timestamptz
pg.types.setTypeParser(1114, v => v); // timestamp
pg.types.setTypeParser(1082, v => v); // date
pg.types.setTypeParser(3802, v => v); // jsonb
pg.types.setTypeParser(114,  v => v); // json
// numeric (1700) ya llega como string por defecto → exacto

const SOURCE = process.env.SOURCE_DATABASE_URL;
const DEST   = process.env.DATABASE_URL;

if (!SOURCE || !DEST) {
  console.error('❌ Faltan variables de entorno.');
  console.error('   SOURCE_DATABASE_URL = cadena de conexión de Railway (origen)');
  console.error('   DATABASE_URL        = cadena de conexión de Neon (destino)');
  process.exit(1);
}
if (SOURCE === DEST) {
  console.error('❌ SOURCE_DATABASE_URL y DATABASE_URL son iguales. Aborto por seguridad.');
  process.exit(1);
}

const sslFor = (url) => url.includes('localhost') ? false : { rejectUnauthorized: false };
const src = new pg.Pool({ connectionString: SOURCE, ssl: sslFor(SOURCE), max: 4 });
const dst = new pg.Pool({ connectionString: DEST,   ssl: sslFor(DEST),   max: 4 });

const BATCH = 400;

function ddlType(c) {
  switch (c.data_type) {
    case 'numeric':
      return c.numeric_precision ? `numeric(${c.numeric_precision},${c.numeric_scale || 0})` : 'numeric';
    case 'character varying':
      return c.character_maximum_length ? `varchar(${c.character_maximum_length})` : 'varchar';
    case 'character':
      return c.character_maximum_length ? `char(${c.character_maximum_length})` : 'char';
    case 'timestamp with time zone':    return 'timestamptz';
    case 'timestamp without time zone': return 'timestamp';
    case 'time with time zone':         return 'timetz';
    case 'time without time zone':      return 'time';
    case 'double precision':            return 'double precision';
    case 'USER-DEFINED':                return c.udt_name;
    case 'ARRAY':                       return c.udt_name.replace(/^_/, '') + '[]';
    default:                            return c.data_type; // text, boolean, integer, bigint, jsonb, date, uuid…
  }
}

const qi = (name) => `"${String(name).replace(/"/g, '""')}"`; // quote identifier

async function getTables() {
  const { rows } = await src.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return rows.map(r => r.table_name);
}

async function getColumns(table) {
  const { rows } = await src.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale,
           character_maximum_length, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [table]);
  return rows;
}

async function getPrimaryKey(table) {
  const { rows } = await src.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema    = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name   = $1
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
  `, [table]);
  return rows.map(r => r.column_name);
}

async function ensureTable(table, cols, pk) {
  const colDefs = cols.map(c => `${qi(c.column_name)} ${ddlType(c)}`);
  const pkClause = pk.length ? `, PRIMARY KEY (${pk.map(qi).join(', ')})` : '';
  await dst.query(`CREATE TABLE IF NOT EXISTS ${qi(table)} (${colDefs.join(', ')}${pkClause})`);
  // Reconciliar por si la tabla ya existía con menos columnas (migraciones)
  for (const c of cols) {
    await dst.query(`ALTER TABLE ${qi(table)} ADD COLUMN IF NOT EXISTS ${qi(c.column_name)} ${ddlType(c)}`);
  }
}

async function copyRows(table, cols) {
  const colNames = cols.map(c => c.column_name);
  const colList = colNames.map(qi).join(', ');
  const { rows } = await src.query(`SELECT ${colList} FROM ${qi(table)}`);
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const params = [];
    const tuples = chunk.map(row => {
      const ph = colNames.map(c => {
        const v = row[c];
        params.push(v === undefined ? null : v);
        return `$${params.length}`;
      });
      return `(${ph.join(', ')})`;
    });
    await dst.query(
      `INSERT INTO ${qi(table)} (${colList}) VALUES ${tuples.join(', ')} ON CONFLICT DO NOTHING`,
      params
    );
  }
  return rows.length;
}

async function count(pool, table) {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${qi(table)}`);
  return rows[0].n;
}

async function main() {
  console.log('🚚 Migración Railway → Neon\n');
  const tables = await getTables();
  console.log(`Encontradas ${tables.length} tablas en el origen.\n`);

  const report = [];
  for (const table of tables) {
    try {
      const cols = await getColumns(table);
      const pk = await getPrimaryKey(table);
      await ensureTable(table, cols, pk);
      const copied = await copyRows(table, cols);
      const srcN = await count(src, table);
      const dstN = await count(dst, table);
      const ok = srcN === dstN;
      console.log(`${ok ? '✅' : '⚠️ '} ${table.padEnd(34)} origen ${String(srcN).padStart(6)}  →  destino ${String(dstN).padStart(6)}`);
      report.push({ table, srcN, dstN, ok });
    } catch (e) {
      console.log(`❌ ${table.padEnd(34)} ERROR: ${e.message}`);
      report.push({ table, error: e.message, ok: false });
    }
  }

  const bad = report.filter(r => !r.ok);
  console.log('\n──────────────────────────────────────────────');
  if (bad.length === 0) {
    console.log(`✅ Migración completa. ${report.length} tablas, todos los conteos coinciden.`);
  } else {
    console.log(`⚠️  ${bad.length} tabla(s) con diferencias o errores — revísalas arriba:`);
    for (const b of bad) console.log(`   - ${b.table}${b.error ? ` (${b.error})` : ` (origen ${b.srcN} vs destino ${b.dstN})`}`);
  }

  await src.end();
  await dst.end();
  process.exit(bad.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('\n❌ Error fatal:', e.message);
  try { await src.end(); await dst.end(); } catch {}
  process.exit(1);
});
