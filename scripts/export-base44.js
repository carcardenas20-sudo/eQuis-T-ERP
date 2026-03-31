#!/usr/bin/env node

/**
 * export-base44.js
 * Exports all records from the three Base44 apps via REST API.
 * Saves results to scripts/exports/{app}/{EntityName}.json
 *
 * Required environment variables:
 *   BASE44_EQUISTPOS_APP_ID, BASE44_EQUISTPOS_API_KEY
 *   BASE44_PRODUCCIONEQUIST_APP_ID, BASE44_PRODUCCIONEQUIST_API_KEY
 *   BASE44_CHAQUETAS_APP_ID, BASE44_CHAQUETAS_API_KEY
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── App configurations ─────────────────────────────────────────────────────

// Strip any accidental surrounding single or double quotes from secret values.
function stripQuotes(s) {
  return (s || '').replace(/^['"]+|['"]+$/g, '');
}

// Resolve appId and apiKey from env vars, auto-detecting if they were accidentally swapped.
// Base44 app IDs are 24-char hex strings; API keys are JWT tokens ("eyJ...") or longer hex strings.
function resolveCredentials(appIdVar, apiKeyVar) {
  const rawAppId = stripQuotes(process.env[appIdVar] || '');
  const rawApiKey = stripQuotes(process.env[apiKeyVar] || '');
  const isJwt = (s) => s.startsWith('eyJ');
  const is24hex = (s) => /^[0-9a-f]{24}$/i.test(s);
  const isLongHex = (s) => /^[0-9a-f]{25,}$/i.test(s);

  // Canonical case: APP_ID is 24-char hex, API_KEY is JWT
  if (is24hex(rawAppId) && isJwt(rawApiKey)) {
    return { appId: rawAppId, apiKey: rawApiKey };
  }
  // Swapped case 1: APP_ID holds JWT, API_KEY holds 24-char hex app id
  if (isJwt(rawAppId) && is24hex(rawApiKey)) {
    return { appId: rawApiKey, apiKey: rawAppId };
  }
  // Swapped case 2: both are hex but API_KEY is shorter (24-char app id) and APP_ID is longer token
  if (is24hex(rawApiKey) && isLongHex(rawAppId)) {
    return { appId: rawApiKey, apiKey: rawAppId };
  }
  // Fallback: use as-is and let the API return a useful error
  return { appId: rawAppId, apiKey: rawApiKey };
}

const APPS = [
  {
    name: 'equistpos',
    envPrefix: 'BASE44_EQUISTPOS',
    ...resolveCredentials('BASE44_EQUISTPOS_APP_ID', 'BASE44_EQUISTPOS_API_KEY'),
    entities: [
      'Product', 'Sale', 'SaleItem', 'Customer', 'Credit', 'Inventory',
      'InventoryMovement', 'Purchase', 'PurchaseItem',
      'Expense', 'ExpenseTask', 'Location', 'Role', 'PriceList',
      'BankAccount', 'PayablePayment', 'AccountPayable', 'PayableInstallment',
      'SystemSettings', 'SyncInbox'
    ],
  },
  {
    name: 'produccionequist',
    envPrefix: 'BASE44_PRODUCCIONEQUIST',
    ...resolveCredentials('BASE44_PRODUCCIONEQUIST_APP_ID', 'BASE44_PRODUCCIONEQUIST_API_KEY'),
    entities: [
      'Employee', 'Delivery', 'Dispatch', 'EmployeePurchase', 'Payment',
      'PaymentRequest'
    ],
  },
  {
    name: 'chaquetas-pro',
    envPrefix: 'BASE44_CHAQUETAS',
    ...resolveCredentials('BASE44_CHAQUETAS_APP_ID', 'BASE44_CHAQUETAS_API_KEY'),
    entities: [
      'MateriaPrima', 'Color', 'Producto', 'Presupuesto',
      'Remision', 'Operacion', 'Proveedor', 'Compra'
    ],
  },
];

const BASE44_API_BASE = 'https://base44.app/api';
const PAGE_SIZE = 100;
const EXPORTS_DIR = path.join(__dirname, 'exports');
const DELAY_MS = 1500; // delay between entity requests to avoid rate limiting

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── HTTP helper ────────────────────────────────────────────────────────────

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('Request timed out'));
    });
  });
}

// ── Fetch one page with retry on rate limit ───────────────────────────────

async function fetchPageWithRetry(url, headers, maxRetries = 5) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await httpGet(url, headers);

    if (response.status === 429) {
      const waitMs = 3000 * (attempt + 1);
      process.stdout.write(`[rate-limited, waiting ${waitMs / 1000}s] `);
      await sleep(waitMs);
      lastError = new Error(`HTTP 429: Rate limit exceeded`);
      continue;
    }

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.body)}`);
    }

    return response.body;
  }
  throw lastError;
}

// ── Fetch all pages for one entity ────────────────────────────────────────

async function fetchAllRecords(appId, apiKey, entityName) {
  const records = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${BASE44_API_BASE}/apps/${appId}/entities/${entityName}?limit=${PAGE_SIZE}&skip=${offset}`;
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = await fetchPageWithRetry(url, headers);

    // Base44 may return an array directly or { data: [...], total: N }
    let page;
    if (Array.isArray(body)) {
      page = body;
    } else if (body && Array.isArray(body.data)) {
      page = body.data;
    } else if (body && Array.isArray(body.items)) {
      page = body.items;
    } else {
      page = [];
    }

    records.push(...page);

    if (page.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  return records;
}

// ── Main export logic ──────────────────────────────────────────────────────

async function exportApp(app) {
  const results = [];

  const appDir = path.join(EXPORTS_DIR, app.name);
  fs.mkdirSync(appDir, { recursive: true });

  for (const entityName of app.entities) {
    let status = 'OK';
    let count = 0;
    let errorMsg = '';

    try {
      process.stdout.write(`  → ${app.name} / ${entityName} ... `);
      const records = await fetchAllRecords(app.appId, app.apiKey, entityName);
      count = records.length;

      const filePath = path.join(appDir, `${entityName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
      console.log(`${count} records`);
    } catch (err) {
      status = 'ERROR';
      errorMsg = err.message;
      console.log(`ERROR — ${err.message}`);
    }

    results.push({ app: app.name, entity: entityName, count, status, error: errorMsg });

    // Avoid rate limiting
    await sleep(DELAY_MS);
  }

  return results;
}

async function main() {
  // Validate required env vars
  const missing = [];
  for (const app of APPS) {
    if (!app.appId) missing.push(`${app.envPrefix}_APP_ID`);
    if (!app.apiKey) missing.push(`${app.envPrefix}_API_KEY`);
  }
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach((k) => console.error(`  - ${k}`));
    process.exit(1);
  }

  fs.mkdirSync(EXPORTS_DIR, { recursive: true });

  console.log('=== Base44 Data Export ===\n');

  const allResults = [];

  for (const app of APPS) {
    console.log(`\n[${app.name}]`);
    const results = await exportApp(app);
    allResults.push(...results);
  }

  // ── Summary table ──────────────────────────────────────────────────────
  console.log('\n\n=== Export Summary ===\n');

  const colWidths = { app: 20, entity: 28, count: 10, status: 8 };
  const header =
    'App'.padEnd(colWidths.app) +
    'Entity'.padEnd(colWidths.entity) +
    'Records'.padStart(colWidths.count) +
    '  Status';
  const separator = '-'.repeat(header.length);

  console.log(header);
  console.log(separator);

  let totalOk = 0;
  let totalError = 0;

  for (const r of allResults) {
    const line =
      r.app.padEnd(colWidths.app) +
      r.entity.padEnd(colWidths.entity) +
      String(r.count).padStart(colWidths.count) +
      '  ' + r.status +
      (r.error ? `  (${r.error.slice(0, 60)})` : '');
    console.log(line);
    if (r.status === 'OK') totalOk++;
    else totalError++;
  }

  console.log(separator);
  console.log(`\nTotal entities: ${allResults.length} | OK: ${totalOk} | ERROR: ${totalError}`);
  console.log(`\nExported files saved to: ${EXPORTS_DIR}`);

  if (totalError > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
