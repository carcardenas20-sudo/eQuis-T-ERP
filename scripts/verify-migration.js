#!/usr/bin/env node
/**
 * verify-migration.js
 * Verifies that all JSON exports are correctly imported into PostgreSQL.
 * Checks both the generic app_entities table AND per-entity tables (runtime data path).
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const EXPORTS_DIR = path.join(__dirname, 'exports');

// Maps entity type → per-entity table name (matches entitySchemas.js)
const ENTITY_TABLE_MAP = {
  AccountPayable: 'entity_account_payable',
  BankAccount: 'entity_bank_account',
  Color: 'entity_color',
  Compra: 'entity_compra',
  Credit: 'entity_credit',
  Customer: 'entity_customer',
  Delivery: 'entity_delivery',
  Dispatch: 'entity_dispatch',
  Employee: 'entity_employee',
  EmployeePurchase: 'entity_employee_purchase',
  Expense: 'entity_expense',
  ExpenseTask: 'entity_expense_task',
  Inventory: 'entity_inventory',
  InventoryMovement: 'entity_inventory_movement',
  Location: 'entity_location',
  MateriaPrima: 'entity_materia_prima',
  Operacion: 'entity_operacion',
  PayableInstallment: 'entity_payable_installment',
  PayablePayment: 'entity_payable_payment',
  Payment: 'entity_payment',
  PaymentRequest: 'entity_payment_request',
  Presupuesto: 'entity_presupuesto',
  PriceList: 'entity_price_list',
  Product: 'entity_product',
  Producto: 'entity_producto_produccion',
  Proveedor: 'entity_proveedor',
  Purchase: 'entity_purchase',
  PurchaseItem: 'entity_purchase_item',
  Remision: 'entity_remision',
  Role: 'entity_role',
  Sale: 'entity_sale',
  SaleItem: 'entity_sale_item',
  StockMovement: 'entity_stock_movement',
  SyncInbox: 'entity_sync_inbox',
  SystemSettings: 'entity_system_settings',
};

const ENTITY_MAP = {
  'equistpos': [
    'AccountPayable','BankAccount','Credit','Customer','Expense','ExpenseTask',
    'Inventory','InventoryMovement','Location','PayableInstallment','PayablePayment',
    'PriceList','Product','Purchase','PurchaseItem','Role','SaleItem','Sale',
    'StockMovement','SyncInbox','SystemSettings'
  ],
  'produccionequist': [
    'Delivery','Dispatch','Employee','EmployeePurchase','Payment','PaymentRequest'
  ],
  'chaquetas-pro': [
    'Color','Compra','MateriaPrima','Operacion','Presupuesto','Producto','Proveedor','Remision'
  ]
};

async function main() {
  const client = await pool.connect();
  let passed = 0;
  let failed = 0;
  let totalJson = 0;
  let totalPerEntity = 0;

  console.log('🔍 Verificando migración: JSON exports vs tablas por entidad\n');

  for (const [app, entities] of Object.entries(ENTITY_MAP)) {
    console.log(`📦 App: ${app}`);
    for (const entity of entities) {
      const jsonFile = path.join(EXPORTS_DIR, app, `${entity}.json`);
      if (!fs.existsSync(jsonFile)) {
        console.log(`  ⚪ ${entity}: archivo JSON no encontrado`);
        continue;
      }

      const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      const jsonCount = Array.isArray(jsonData) ? jsonData.length : 0;

      // Check per-entity table (runtime data path)
      const tableName = ENTITY_TABLE_MAP[entity];
      let perEntityCount = 0;
      if (tableName) {
        const res = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        perEntityCount = parseInt(res.rows[0].count);
      } else {
        // Fallback to generic table
        const res = await client.query('SELECT COUNT(*) FROM app_entities WHERE entity_type = $1', [entity]);
        perEntityCount = parseInt(res.rows[0].count);
      }

      const status = jsonCount === perEntityCount ? '✅' : '❌';
      if (jsonCount === perEntityCount) passed++;
      else failed++;

      totalJson += jsonCount;
      totalPerEntity += perEntityCount;
      console.log(`  ${status} ${entity}: JSON=${jsonCount}, DB=${perEntityCount}${jsonCount !== perEntityCount ? ' ← MISMATCH' : ''}`);
    }
    console.log('');
  }

  // Check users
  const usersResult = await client.query('SELECT COUNT(*) FROM app_users');
  const userCount = parseInt(usersResult.rows[0].count);
  console.log(`👤 Usuarios en DB: ${userCount}`);

  console.log(`\n📊 Resumen:`);
  console.log(`   Entities verificadas: ${passed + failed}`);
  console.log(`   ✅ OK: ${passed}`);
  console.log(`   ❌ Mismatch: ${failed}`);
  console.log(`   Total registros (JSON): ${totalJson}`);
  console.log(`   Total registros (tablas por entidad): ${totalPerEntity}`);

  client.release();
  await pool.end();

  if (failed > 0) {
    console.log('\n⚠️  Hay diferencias. Re-ejecuta el import con: node scripts/import-to-postgres.js');
    process.exit(1);
  } else {
    console.log('\n🎉 Verificación completa: todos los registros coinciden en tablas por entidad.');
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
