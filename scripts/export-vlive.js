#!/usr/bin/env node
/**
 * export-vlive.js
 * Descarga (SOLO LECTURA) todos los registros de las dos apps de V-LIVE en Base44
 * a scripts/exports-vlive/{app}/{Entidad}.json (carpeta excluida de git).
 *
 * Variables en .env:
 *   BASE44_VLIVEPOS_APP_ID, BASE44_VLIVEPROD_APP_ID
 *   BASE44_VLIVE_TOKEN  (o BASE44_VLIVEPOS_TOKEN / BASE44_VLIVEPROD_TOKEN)
 *
 * Uso: node --env-file=.env scripts/export-vlive.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'exports-vlive');
const API = 'https://base44.app/api';
const PAGE = 100;
const clean = (s) => String(s || '').trim().replace(/^['"]+|['"]+$/g, '');

const APPS = [
  {
    name: 'v-livepos',
    appId: clean(process.env.BASE44_VLIVEPOS_APP_ID),
    token: clean(process.env.BASE44_VLIVEPOS_TOKEN || process.env.BASE44_VLIVE_TOKEN),
    entities: [
      'AccountPayable', 'AmbulantInventory', 'BankAccount', 'CashControl', 'Category', 'Credit',
      'Customer', 'CustomerBalance', 'Exchange', 'Expense', 'Inventory', 'InventoryAudit',
      'InventoryMovement', 'Location', 'PayablePayment', 'Payment', 'PriceList', 'Product',
      'ProductPrice', 'Purchase', 'PurchaseItem', 'Role', 'Sale', 'SaleItem', 'Supplier',
      'SystemSettings', 'User',
    ],
  },
  {
    name: 'manufacturavlive',
    appId: clean(process.env.BASE44_VLIVEPROD_APP_ID),
    token: clean(process.env.BASE44_VLIVEPROD_TOKEN || process.env.BASE44_VLIVE_TOKEN),
    entities: [
      'ActivityLog', 'CutRecord', 'Delivery', 'Dispatch', 'Employee', 'EmployeePurchase',
      'Inventory', 'Payment', 'PaymentRequest', 'Product', 'StockMovement', 'User',
    ],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPage(url, token, tries = 5) {
  for (let i = 0; i <= tries; i++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (res.status === 429) { await sleep(3000 * (i + 1)); continue; }
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${String(typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 200)}`);
    return body;
  }
  throw new Error('HTTP 429: demasiadas solicitudes');
}

async function fetchAll(app, entity) {
  const out = [];
  for (let skip = 0; ; skip += PAGE) {
    const body = await getPage(`${API}/apps/${app.appId}/entities/${entity}?limit=${PAGE}&skip=${skip}`, app.token);
    const page = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.items) ? body.items : [];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

const resumen = [];
for (const app of APPS) {
  if (!app.appId || !app.token) { console.log(`✗ ${app.name}: falta App ID o token en .env`); continue; }
  const dir = path.join(OUT, app.name);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\n== ${app.name} ==`);
  for (const entity of app.entities) {
    try {
      const rows = await fetchAll(app, entity);
      fs.writeFileSync(path.join(dir, `${entity}.json`), JSON.stringify(rows, null, 2));
      console.log(`  ${entity.padEnd(20)} ${rows.length}`);
      resumen.push({ app: app.name, entity, count: rows.length });
    } catch (e) {
      console.log(`  ${entity.padEnd(20)} ERROR ${e.message}`);
      resumen.push({ app: app.name, entity, error: e.message });
    }
    await sleep(800);
  }
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, '_resumen.json'), JSON.stringify({ fecha: new Date().toISOString(), resumen }, null, 2));
console.log('\nListo. Archivos en scripts/exports-vlive/');
