#!/usr/bin/env node
/**
 * import-to-postgres.js
 * Imports all exported Base44 JSON files into the local PostgreSQL database.
 * Admin password uses ADMIN_PASSWORD env var; falls back to a random 16-char password
 * printed once to stdout (never hardcoded). Change after first login.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const EXPORTS_DIR = path.join(__dirname, 'exports');

const ENTITY_MAP = {
  'equistpos': [
    'AccountPayable', 'BankAccount', 'Credit', 'Customer', 'Expense', 'ExpenseTask',
    'Inventory', 'InventoryMovement', 'Location', 'PayableInstallment', 'PayablePayment',
    'PriceList', 'Product', 'Purchase', 'PurchaseItem', 'Role', 'SaleItem', 'Sale',
    'StockMovement', 'SyncInbox', 'SystemSettings'
  ],
  'produccionequist': [
    'Delivery', 'Dispatch', 'Employee', 'EmployeePurchase', 'Payment', 'PaymentRequest'
  ],
  'chaquetas-pro': [
    'Color', 'Compra', 'MateriaPrima', 'Operacion', 'Presupuesto', 'Producto', 'Proveedor', 'Remision'
  ]
};

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_entities (
      id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}',
      created_date TIMESTAMPTZ DEFAULT NOW(),
      updated_date TIMESTAMPTZ DEFAULT NOW(),
      created_by_id TEXT,
      PRIMARY KEY (id, entity_type)
    );
    CREATE INDEX IF NOT EXISTS idx_entities_type ON app_entities(entity_type);
    CREATE INDEX IF NOT EXISTS idx_entities_data ON app_entities USING gin(data);

    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      full_name TEXT,
      role TEXT DEFAULT 'user',
      role_id TEXT,
      location_id TEXT,
      is_active BOOLEAN DEFAULT true,
      data JSONB DEFAULT '{}',
      created_date TIMESTAMPTZ DEFAULT NOW(),
      updated_date TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function importEntity(client, app, entityType) {
  const filePath = path.join(EXPORTS_DIR, app, `${entityType}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚪ ${app}/${entityType}: archivo no encontrado, saltando`);
    return 0;
  }

  const records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(records) || records.length === 0) {
    console.log(`  ⚪ ${entityType}: 0 registros`);
    return 0;
  }

  let count = 0;
  for (const record of records) {
    const { id, created_date, updated_date, created_by_id, created_by, is_sample, ...data } = record;
    if (!id) continue;

    try {
      await client.query(`
        INSERT INTO app_entities (id, entity_type, data, created_date, updated_date, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id, entity_type) DO UPDATE SET
          data = EXCLUDED.data,
          updated_date = EXCLUDED.updated_date
      `, [
        id,
        entityType,
        JSON.stringify(data),
        created_date || new Date().toISOString(),
        updated_date || new Date().toISOString(),
        created_by_id
      ]);
      count++;
    } catch (err) {
      console.error(`    Error en ${entityType}/${id}:`, err.message);
    }
  }

  console.log(`  ✅ ${entityType}: ${count}/${records.length} registros importados`);
  return count;
}

async function createAdminUser(client) {
  const bcrypt = await import('bcryptjs');

  // Use ADMIN_PASSWORD env var if provided; otherwise generate a secure random password
  const plainPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(8).toString('hex');
  const hash = await bcrypt.default.hash(plainPassword, 10);
  const adminId = 'admin-local-001';

  const res = await client.query(`
    INSERT INTO app_users (id, email, password_hash, full_name, role, is_active)
    VALUES ($1, $2, $3, $4, 'admin', true)
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `, [adminId, 'admin@equist.local', hash, 'Administrador']);

  if (res.rowCount > 0) {
    console.log('  ✅ Usuario admin creado: admin@equist.local');
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`  🔑 Contraseña generada: ${plainPassword}`);
      console.log('  ⚠️  Cambia la contraseña después del primer inicio de sesión.');
      console.log('  ℹ️  Para usar una contraseña fija, define ADMIN_PASSWORD antes de ejecutar este script.');
    }
  } else {
    console.log('  ℹ️  Usuario admin ya existe, contraseña no modificada');
  }
}

async function main() {
  console.log('🚀 Importando datos a PostgreSQL...\n');
  const client = await pool.connect();

  try {
    await ensureSchema(client);
    console.log('✅ Schema verificado\n');

    let totalImported = 0;

    for (const [app, entities] of Object.entries(ENTITY_MAP)) {
      console.log(`📦 App: ${app}`);
      for (const entity of entities) {
        const n = await importEntity(client, app, entity);
        totalImported += n;
      }
      console.log('');
    }

    console.log('👤 Creando usuario administrador...');
    await createAdminUser(client);

    console.log(`\n🎉 Importación completa: ${totalImported} registros en total`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
