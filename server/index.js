import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool, query } from './db.js';
import { JWT_SECRET } from './config.js';
import { ENTITY_SCHEMAS, buildCreateTableSQL, buildIndexSQL } from './entitySchemas.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import uploadRoutes from './routes/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

// Permissive middleware: parses token if present, doesn't block
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.id;
      req.userEmail = decoded.email;
      req.userRole = decoded.role || null;
    } catch {}
  }
  next();
};

// Strict middleware: rejects unauthenticated requests, attaches role to req
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    req.userRole = decoded.role || null;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

app.use(authMiddleware);
app.use('/api/auth', authRoutes);

// ─── Portal público de empleados (sin auth requerida) ────────────────────────
// Solo permite leer entidades específicas del módulo operarios
const PORTAL_PUBLIC_ENTITIES = new Set([
  // Portal operario (lectura)
  'Employee', 'Payment', 'PaymentRequest', 'EmployeePurchase', 'Producto', 'AppConfig',
  // Planillador (lectura + escritura)
  'Delivery', 'Dispatch', 'Inventory', 'StockMovement', 'Devolucion', 'ActivityLog',
]);
// Entidades en las que el portal puede escribir
const PORTAL_WRITE_ENTITIES = new Set([
  'PaymentRequest',           // operario solicita pago
  'Delivery', 'Dispatch',     // planillador registra entregas/despachos
  'Inventory', 'StockMovement', 'Devolucion', 'ActivityLog', 'AppConfig',
]);
// POST /api/portal-login  → recibe employee_id lógico + pin, devuelve datos del empleado
app.post('/api/portal-login', async (req, res) => {
  const { employee_id, pin } = req.body || {};
  if (!employee_id) return res.status(400).json({ error: 'Falta employee_id' });
  try {
    const { rows } = await query(
      `SELECT id, name, is_active, position, phone, hire_date, data, created_date, updated_date
       FROM entity_employee WHERE data->>'employee_id' = $1 LIMIT 1`,
      [String(employee_id).trim()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Empleado no encontrado' });
    const row = rows[0];
    const storedPin = row.data?.portal_pin;
    if (storedPin && String(storedPin) !== String(pin || '')) {
      return res.status(401).json({ error: 'PIN incorrecto' });
    }
    const { portal_pin: _p, ...dataRest } = row.data || {};
    res.json({ ...dataRest, id: row.id, name: row.name, employee_id: row.data?.employee_id,
      is_active: row.is_active, position: row.position, phone: row.phone,
      hire_date: row.hire_date, created_date: row.created_date, updated_date: row.updated_date });
  } catch (e) {
    console.error('portal-login error', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.use('/api/portal', (req, res, next) => {
  const type = req.path.split('/')[1];
  if (!PORTAL_PUBLIC_ENTITIES.has(type)) {
    return res.status(403).json({ error: 'Acceso no permitido' });
  }
  const isRead = req.method === 'GET';
  const isWrite = ['POST', 'PUT', 'PATCH'].includes(req.method) && PORTAL_WRITE_ENTITIES.has(type);
  if (!isRead && !isWrite) {
    return res.status(403).json({ error: 'Acceso no permitido' });
  }
  next();
}, entityRoutes);

app.use('/api/entities', requireAuth, entityRoutes);
app.use('/api/upload', requireAuth, uploadRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date() }));

// ─── Function: simulateOperariosSalary ───────────────────────────────────────
// Reads pending operario deliveries and creates AccountPayable records for each
// employee that has unpaid balance.
app.post('/api/functions/simulateOperariosSalary', requireAuth, async (req, res) => {
  try {
    const { rows: employees } = await query(`SELECT id, name, data FROM entity_employee WHERE is_active = true`);
    const { rows: deliveries } = await query(`SELECT id, employee_id, total_amount, status, data FROM entity_delivery`);
    const { rows: payments } = await query(`SELECT id, employee_id, amount, data FROM entity_payment`);

    const created = [];

    for (const emp of employees) {
      const empId = emp.data?.employee_id || emp.id;
      const empName = emp.name || emp.data?.name || empId;

      // Total earned from deliveries
      const empDeliveries = deliveries.filter(d => {
        const dEmpId = d.employee_id || d.data?.employee_id;
        return dEmpId === empId;
      });

      const totalEarned = empDeliveries.reduce((sum, d) => {
        const amt = parseFloat(d.total_amount) || parseFloat(d.data?.total_amount) || 0;
        return sum + amt;
      }, 0);

      // Total paid
      const empPayments = payments.filter(p => {
        const pEmpId = p.employee_id || p.data?.employee_id;
        return pEmpId === empId;
      });

      const totalPaid = empPayments.reduce((sum, p) => {
        return sum + (parseFloat(p.amount) || parseFloat(p.data?.amount) || 0);
      }, 0);

      const pending = totalEarned - totalPaid;
      if (pending <= 0) continue;

      // Check if there's already a pending AccountPayable for this employee
      const { rows: existing } = await query(
        `SELECT id FROM entity_account_payable WHERE supplier_id = $1 AND status != 'paid'`,
        [empId]
      );
      if (existing.length > 0) continue;

      const now = new Date().toISOString();
      const id = `sal_${empId}_${Date.now()}`;
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await query(
        `INSERT INTO entity_account_payable
          (id, supplier_id, status, due_date, pending_amount, paid_amount, data, created_date, updated_date)
         VALUES ($1,$2,'pending',$3,$4,0,$5,$6,$6)`,
        [
          id, empId, dueDate, pending,
          JSON.stringify({
            supplier_name: empName,
            description: `Salario pendiente operario ${empName}`,
            type: 'manufacturing_salary',
            category: 'salarios_manufactura',
            total_amount: pending,
          }),
          now,
        ]
      );
      created.push({ employee: empName, amount: pending });
    }

    res.json({ ok: true, created });
  } catch (err) {
    console.error('simulateOperariosSalary:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve frontend (React build) ────────────────────────────────────────────
const DIST_DIR = join(__dirname, '..', 'dist');
console.log('🗂️  DIST_DIR:', DIST_DIR);
app.use(express.static(DIST_DIR));
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(DIST_DIR, 'index.html'));
});

async function runMigrations(client) {
  const migrations = [
    {
      name: 'deduplicate_employees_by_employee_id',
      sql: async () => {
        // Keep the oldest record per employee_id, delete the rest
        await client.query(`
          DELETE FROM entity_employee
          WHERE id IN (
            SELECT id FROM (
              SELECT id,
                ROW_NUMBER() OVER (
                  PARTITION BY COALESCE(name, data->>'employee_id', data->>'name')
                  ORDER BY created_date ASC
                ) AS rn
              FROM entity_employee
            ) ranked
            WHERE rn > 1
          )
        `);
        console.log('✅ Migration: duplicate employees removed');
      }
    },
    {
      name: 'add_producto_reference_and_costo_cols',
      sql: async () => {
        await client.query(`ALTER TABLE entity_producto_produccion ADD COLUMN IF NOT EXISTS reference TEXT`);
        await client.query(`ALTER TABLE entity_producto_produccion ADD COLUMN IF NOT EXISTS costo_mano_obra NUMERIC(14,4)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_entity_producto_produccion_reference ON entity_producto_produccion(reference)`);
        // Migrate existing values from JSONB to typed columns
        await client.query(`
          UPDATE entity_producto_produccion
          SET reference = NULLIF(data->>'reference', ''),
              costo_mano_obra = NULLIF(data->>'costo_mano_obra', '')::NUMERIC
          WHERE (reference IS NULL OR costo_mano_obra IS NULL)
        `);
        console.log('✅ Migration: reference + costo_mano_obra columns added to entity_producto_produccion');
      }
    }
  ];

  for (const migration of migrations) {
    const already = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [migration.name]);
    if (already.rows.length > 0) continue;
    await migration.sql();
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [migration.name]);
  }
}

async function initDB() {
  const client = await pool.connect();
  try {
    // ─── Shared tables ───────────────────────────────────────────────────────
    await client.query(`
      -- Generic JSONB table (kept as fallback + migration source)
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

      -- Dedicated user table
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

      -- Migration tracking
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ─── Per-entity tables ───────────────────────────────────────────────────
    for (const [entityType, schema] of Object.entries(ENTITY_SCHEMAS)) {
      await client.query(buildCreateTableSQL(entityType, schema));
      for (const indexSQL of buildIndexSQL(schema)) {
        await client.query(indexSQL);
      }
    }
    console.log(`✅ Per-entity tables created (${Object.keys(ENTITY_SCHEMAS).length} types)`);

    // ─── Migrations (antes del sync para que las columnas existan) ───────────
    await runMigrations(client);

    console.log('✅ DB schema initialized');

    // ─── Auto-import historical data if DB is empty ─────────────────────────
    await seedExportsData(client);

    // ─── Sync: copy rows from app_entities → per-entity tables ───────────────
    // Runs after import so data is always available in typed tables.
    {
      let migrated = 0;
      for (const [entityType, schema] of Object.entries(ENTITY_SCHEMAS)) {
        const typedCols = Object.keys(schema.typed);
        const typedTypes = schema.typed;

        const selectExprs = typedCols.map(col => {
          const colType = typedTypes[col].split(' ')[0].toUpperCase().replace(/\(.*\)/, '');
          const rawExpr = `NULLIF(data->>'${col}', '')`;
          if (colType === 'TIMESTAMPTZ') {
            return `${rawExpr}::TIMESTAMPTZ`;
          } else if (colType === 'NUMERIC') {
            return `${rawExpr}::NUMERIC`;
          } else if (colType === 'INTEGER') {
            return `${rawExpr}::INTEGER`;
          } else if (colType === 'BOOLEAN') {
            return `(NULLIF(data->>'${col}', ''))::BOOLEAN`;
          } else {
            return rawExpr;
          }
        });

        const removeKeys = typedCols.map(c => `'${c}'`).join(', ');
        const dataExpr = typedCols.length > 0
          ? `data - ARRAY[${removeKeys}]`
          : 'data';

        const selectCols = ['id', ...typedCols, 'data', 'created_date', 'updated_date', 'created_by_id'].join(', ');
        const selectValues = [`ae.id`, ...selectExprs, dataExpr, `ae.created_date`, `ae.updated_date`, `ae.created_by_id`].join(', ');

        const sql = `
          INSERT INTO ${schema.table} (${selectCols})
          SELECT ${selectValues}
          FROM app_entities ae
          WHERE ae.entity_type = '${entityType}'
          ON CONFLICT (id) DO NOTHING
        `;

        const result = await client.query(sql);
        migrated += result.rowCount || 0;
      }

      if (migrated > 0) console.log(`✅ Synced ${migrated} records to per-entity tables`);
    }

    // ─── Post-sync dedup: always remove duplicate employees after sync ────────
    const dedupResult = await client.query(`
      DELETE FROM entity_employee
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY name
              ORDER BY created_date ASC
            ) AS rn
          FROM entity_employee
        ) ranked
        WHERE rn > 1
      )
    `);
    if (dedupResult.rowCount > 0) {
      console.log(`✅ Post-sync dedup: removed ${dedupResult.rowCount} duplicate employee(s)`);
    }

    // ─── Auto-seed admin user if no users exist ──────────────────────────────
    await seedAdminUser(client);

  } finally {
    client.release();
  }
}

async function seedAdminUser(client) {
  // Check if any user already exists — if so, skip
  const existing = await client.query('SELECT COUNT(*) FROM app_users');
  const count = parseInt(existing.rows[0].count, 10);
  if (count > 0) {
    console.log(`ℹ️  Usuarios existentes: ${count} — seed omitido`);
    return;
  }

  // Use ADMIN_PASSWORD env var if set; otherwise generate a secure random one
  const plainPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(10).toString('hex');
  const hash = await bcrypt.hash(plainPassword, 10);
  const adminId = 'admin-seed-001';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@equist.local';

  await client.query(`
    INSERT INTO app_users (id, email, password_hash, full_name, role, is_active)
    VALUES ($1, $2, $3, $4, 'admin', true)
    ON CONFLICT (email) DO NOTHING
  `, [adminId, adminEmail, hash, 'Administrador']);

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         ✅ USUARIO ADMIN CREADO                  ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Email:      ${adminEmail.padEnd(36)}║`);
  console.log(`║  Contraseña: ${plainPassword.padEnd(36)}║`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('║                                                  ║');
    console.log('║  ⚠️  Contraseña generada aleatoriamente.          ║');
    console.log('║  Define ADMIN_PASSWORD en las variables de       ║');
    console.log('║  entorno para usar una contraseña fija.          ║');
  }
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
}


async function seedExportsData(client) {
  // Only runs if app_entities table is completely empty (first deploy)
  const check = await client.query('SELECT COUNT(*) FROM app_entities');
  const total = parseInt(check.rows[0].count, 10);
  if (total > 0) {
    console.log(`ℹ️  Datos existentes: ${total} registros en app_entities — import omitido`);
    return;
  }

  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname2 = path.default.dirname(fileURLToPath(import.meta.url));
  const EXPORTS_DIR = path.default.join(__dirname2, '..', 'scripts', 'exports');

  if (!fs.default.existsSync(EXPORTS_DIR)) {
    console.log('ℹ️  No se encontró scripts/exports/ — import de datos omitido');
    return;
  }

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

  console.log('');
  console.log('📦 Base de datos vacía detectada — importando datos históricos...');
  let totalImported = 0;
  let totalSkipped = 0;

  for (const [app, entities] of Object.entries(ENTITY_MAP)) {
    for (const entityType of entities) {
      const filePath = path.default.join(EXPORTS_DIR, app, `${entityType}.json`);
      if (!fs.default.existsSync(filePath)) continue;

      let records;
      try {
        records = JSON.parse(fs.default.readFileSync(filePath, 'utf8'));
      } catch { continue; }

      if (!Array.isArray(records) || records.length === 0) continue;

      let count = 0;
      for (const record of records) {
        const { id, created_date, updated_date, created_by_id, created_by, is_sample, ...data } = record;
        if (!id) continue;
        try {
          await client.query(
            `INSERT INTO app_entities (id, entity_type, data, created_date, updated_date, created_by_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id, entity_type) DO NOTHING`,
            [
              id, entityType, JSON.stringify(data),
              created_date || new Date().toISOString(),
              updated_date || new Date().toISOString(),
              created_by_id || null
            ]
          );
          count++;
        } catch { totalSkipped++; }
      }
      if (count > 0) {
        console.log(`  ✅ ${app}/${entityType}: ${count} registros`);
        totalImported += count;
      }
    }
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       📊 DATOS HISTÓRICOS IMPORTADOS             ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Registros importados: ${String(totalImported).padEnd(26)}║`);
  if (totalSkipped > 0)
    console.log(`║  Omitidos (duplicados): ${String(totalSkipped).padEnd(25)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
}

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('❌ DB init failed:', err.message);
  process.exit(1);
});
