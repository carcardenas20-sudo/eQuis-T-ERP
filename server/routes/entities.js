import express from 'express';
import { query } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { ADMIN_ONLY_WRITE_ENTITIES } from '../config.js';
import { ENTITY_SCHEMAS, splitRecord, mergeRecord } from '../entitySchemas.js';

const router = express.Router();

// ── Multiempresa: candado por empresa ────────────────────────────────────────
// Estas entidades NO se filtran por empresa: Company es el registro de empresas
// (no pertenece a una empresa); User tiene su propia ruta/tabla (su empresa va en
// app_users.company_id); Role = plantillas de permisos compartidas por todas las empresas.
const NOT_SCOPED = new Set(['Company', 'User', 'Role']);
const isScoped = (type) => !NOT_SCOPED.has(type);

// Resuelve la empresa activa de la petición: la del usuario, y si es super-admin
// (rol admin) puede cambiarla con el header X-Company-Id (para el selector).
// Fail-open a 'equist' (Empresa 1) ante cualquier problema, para no romper nada.
async function resolveCompany(req, res, next) {
  try {
    const { rows } = await query('SELECT role, company_id FROM app_users WHERE id = $1', [req.userId]);
    const u = rows[0];
    const userCompany = u?.company_id || 'equist';
    const isSuperAdmin = req.userRole === 'admin' || u?.role === 'admin';
    const requested = req.headers['x-company-id'];
    req.companyId = (isSuperAdmin && requested) ? String(requested) : userCompany;
    req.isSuperAdmin = isSuperAdmin;
  } catch {
    req.companyId = 'equist';
    req.isSuperAdmin = false;
  }
  next();
}
router.use(resolveCompany);

// RBAC: deny writes on privileged entity types unless caller is admin
function requireAdminForPrivileged(req, res, next) {
  const { type } = req.params;
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (isWrite && ADMIN_ONLY_WRITE_ENTITIES.has(type)) {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: `Solo administradores pueden modificar "${type}"` });
    }
  }
  next();
}

// RBAC granular (etapa 1): exige el permiso correspondiente para ELIMINAR ciertas
// entidades directamente vía API. Solo cubre borrados DIRECTOS de estas entidades
// (acciones que el frontend ya restringe por permiso). NO gatea escrituras que son
// efecto secundario de flujos (ventas, anulaciones, abonos), para no bloquear a
// usuarios legítimos. Los admin pasan siempre. Ante cualquier fallo, se permite (fail-open).
const DELETE_PERMISSION = {
  Product: 'products_delete',
  Customer: 'customers_delete',
  Expense: 'expenses_delete',
  BankAccount: 'accounting_manage_bank_accounts',
  // Anular/eliminar una venta: basta CUALQUIERA de estos permisos (según el rol usa uno u otro).
  // El frontend oculta el botón "Anular" con el mismo criterio → los usuarios legítimos pasan
  // y esto solo frena el abuso directo por API.
  Sale: ['pos_delete_sales', 'sales_cancel'],
};

// Igual que arriba pero para EDITAR (PUT/PATCH). Solo Sale por ahora: es el único PUT que el
// frontend dispara directamente sobre una venta (Sales.jsx handleSaveEditedSale); ningún otro
// flujo actualiza la venta como efecto secundario → gatear aquí no rompe nada.
const EDIT_PERMISSION = {
  Sale: ['pos_edit_sales', 'sales_edit'],
};

async function loadUserPermissions(userId) {
  if (!userId) return [];
  const { rows } = await query('SELECT role, role_id FROM app_users WHERE id = $1', [userId]);
  const u = rows[0];
  if (!u) return [];
  if (u.role === 'admin') return null; // null = admin (todos los permisos)
  if (!u.role_id) return [];
  const r = await query('SELECT data FROM entity_role WHERE id = $1', [u.role_id]);
  const perms = r.rows[0]?.data?.permissions;
  return Array.isArray(perms) ? perms : [];
}

async function requirePermissionForSensitiveDelete(req, res, next) {
  try {
    if (req.method !== 'DELETE') return next();
    const needed = DELETE_PERMISSION[req.params.type];
    if (!needed) return next();
    if (req.userRole === 'admin') return next();
    const perms = await loadUserPermissions(req.userId);
    if (perms === null) return next(); // admin
    // `needed` puede ser un permiso (string) o una lista de permisos aceptables (cualquiera vale)
    const neededList = Array.isArray(needed) ? needed : [needed];
    if (!neededList.some(p => perms.includes(p))) {
      return res.status(403).json({ error: `No tienes permiso para eliminar "${req.params.type}"` });
    }
    next();
  } catch (e) {
    console.warn('RBAC (delete) omitido por error:', e.message);
    next(); // fail-open: no bloquear por un fallo técnico
  }
}

async function requirePermissionForSensitiveEdit(req, res, next) {
  try {
    if (req.method !== 'PUT' && req.method !== 'PATCH') return next();
    const needed = EDIT_PERMISSION[req.params.type];
    if (!needed) return next();
    if (req.userRole === 'admin') return next();
    const perms = await loadUserPermissions(req.userId);
    if (perms === null) return next(); // admin
    const neededList = Array.isArray(needed) ? needed : [needed];
    if (!neededList.some(p => perms.includes(p))) {
      return res.status(403).json({ error: `No tienes permiso para modificar "${req.params.type}"` });
    }
    next();
  } catch (e) {
    console.warn('RBAC (edit) omitido por error:', e.message);
    next(); // fail-open: no bloquear por un fallo técnico
  }
}

// ── Numeración de facturas por empresa ──────────────────────────────────────
// Cada empresa lleva su contador en entity_company.data (invoice_prefix, invoice_next).
// El número se asigna aquí (servidor) con un UPDATE atómico: dos ventas simultáneas
// nunca reciben el mismo número. Si la empresa no tiene contador configurado,
// la venta queda sin número, como antes.
async function assignInvoiceNumber(saleId, companyId, idFromClient) {
  try {
    // POST con id existente = upsert de una venta ya creada: conservar su número
    // (o su ausencia) en vez de gastar uno nuevo o borrarlo.
    if (idFromClient) {
      const ex = await query('SELECT invoice_number FROM entity_sale WHERE id = $1', [saleId]);
      if (ex.rows[0]) return ex.rows[0].invoice_number;
    }
    const { rows } = await query(
      `UPDATE entity_company
         SET data = jsonb_set(data, '{invoice_next}', to_jsonb((data->>'invoice_next')::bigint + 1)),
             updated_date = NOW()
       WHERE id = $1 AND (data->>'invoice_next') ~ '^[0-9]+$'
       RETURNING (data->>'invoice_next')::bigint - 1 AS n, COALESCE(data->>'invoice_prefix', '') AS prefix`,
      [companyId]
    );
    return rows[0] ? `${rows[0].prefix}${rows[0].n}` : null;
  } catch (e) {
    console.warn('Numeración de factura omitida por error:', e.message);
    return null; // fail-open: la venta se guarda igual, sin número
  }
}

router.use('/:type', requireAdminForPrivileged);
router.use('/:type/:id', requireAdminForPrivileged);
router.use('/:type/:id', requirePermissionForSensitiveDelete);
router.use('/:type/:id', requirePermissionForSensitiveEdit);

function buildOrderBy(orderByParam, schema) {
  if (!orderByParam) return 'ORDER BY created_date DESC';
  const desc = orderByParam.startsWith('-');
  const field = desc ? orderByParam.slice(1) : orderByParam;
  const dir = desc ? 'DESC' : 'ASC';
  if (field === 'created_date' || field === 'updated_date') {
    return `ORDER BY ${field} ${dir}`;
  }
  const typedCols = schema ? Object.keys(schema.typed) : [];
  if (typedCols.includes(field)) {
    return `ORDER BY ${field} ${dir} NULLS LAST`;
  }
  return `ORDER BY data->>'${field.replace(/'/g, '')}' ${dir} NULLS LAST`;
}

/**
 * Build SQL conditions from operator-style filter object.
 * Supports: $gte, $lte, $gt, $lt, $in, $ne
 */
function buildOperatorClauses(operatorFilter, startParamIndex, schema) {
  const clauses = [];
  const params = [];
  let idx = startParamIndex;
  const typedCols = schema ? Object.keys(schema.typed) : [];

  for (const [field, ops] of Object.entries(operatorFilter)) {
    if (!ops || typeof ops !== 'object') continue;
    const safeField = field.replace(/[^a-zA-Z0-9_]/g, '');
    const isTyped = typedCols.includes(safeField);
    const colRef = isTyped ? safeField : `data->>'${safeField}'`;

    for (const [op, val] of Object.entries(ops)) {
      switch (op) {
        case '$gte':
          clauses.push(`${colRef} >= $${idx}`);
          params.push(String(val));
          idx++;
          break;
        case '$lte':
          clauses.push(`${colRef} <= $${idx}`);
          params.push(String(val));
          idx++;
          break;
        case '$gt':
          clauses.push(`${colRef} > $${idx}`);
          params.push(String(val));
          idx++;
          break;
        case '$lt':
          clauses.push(`${colRef} < $${idx}`);
          params.push(String(val));
          idx++;
          break;
        case '$in':
          if (Array.isArray(val) && val.length > 0) {
            clauses.push(`${colRef} = ANY($${idx}::text[])`);
            params.push(val.map(String));
            idx++;
          }
          break;
        case '$ne':
          clauses.push(`(${colRef} IS DISTINCT FROM $${idx})`);
          params.push(String(val));
          idx++;
          break;
        default:
          break;
      }
    }
  }
  return { clauses, params };
}

// ─── GET list ────────────────────────────────────────────────────────────────

router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const isAdmin = req.userRole === 'admin';

    // User entity: dedicated table with role-based field visibility
    if (type === 'User') {
      const fields = isAdmin
        ? 'id, email, full_name, role, role_id, location_id, is_active, company_id, created_date, updated_date, data'
        : 'id, full_name, role, role_id, location_id, is_active';
      const result = await query(
        `SELECT ${fields} FROM app_users WHERE is_active = true ORDER BY full_name`
      );
      return res.json(result.rows.map(u => ({
        ...(isAdmin ? u.data : {}),
        id: u.id,
        full_name: u.full_name,
        role: u.role,
        role_id: u.role_id,
        location_id: u.location_id,
        is_active: u.is_active,
        company_id: u.company_id,
        ...(isAdmin ? { email: u.email, created_date: u.created_date, updated_date: u.updated_date } : {}),
      })));
    }

    const schema = ENTITY_SCHEMAS[type];
    const { _limit, _skip, _order_by, _filter, ...simpleFilterParams } = req.query;
    const limit = parseInt(_limit) || 10000;
    const skip = parseInt(_skip) || 0;
    const orderBy = buildOrderBy(_order_by, schema);

    if (schema) {
      // ── Use per-entity table ──
      const params = [];
      const whereClauses = [];

      // Simple scalar filters
      const typedCols = Object.keys(schema.typed);
      for (const [k, v] of Object.entries(simpleFilterParams)) {
        if (v === '' || v === 'undefined' || v === 'null') continue;
        const safeK = k.replace(/[^a-zA-Z0-9_]/g, '');
        if (typedCols.includes(safeK)) {
          params.push(v);
          whereClauses.push(`${safeK} = $${params.length}`);
        } else {
          params.push(JSON.stringify({ [safeK]: v }));
          whereClauses.push(`data @> $${params.length}::jsonb`);
        }
      }

      // Operator-style filters
      if (_filter) {
        try {
          const operatorFilter = JSON.parse(_filter);
          const { clauses, params: opParams } = buildOperatorClauses(operatorFilter, params.length + 1, schema);
          for (const p of opParams) params.push(p);
          for (const c of clauses) whereClauses.push(c);
        } catch {
          return res.status(400).json({ error: 'Parámetro _filter inválido' });
        }
      }

      // Candado por empresa
      if (isScoped(type)) {
        params.push(req.companyId);
        whereClauses.push(`company_id = $${params.length}`);
      }

      const whereStr = whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : '';
      const typedColsSel = typedCols.join(', ');
      const selectCols = typedCols.length > 0 ? `id, ${typedColsSel}, data, created_date, updated_date, created_by_id` : 'id, data, created_date, updated_date, created_by_id';
      params.push(limit);
      params.push(skip);
      const sql = `SELECT ${selectCols} FROM ${schema.table}${whereStr} ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`;
      const result = await query(sql, params);
      return res.json(result.rows.map(r => mergeRecord(r, schema)));
    }

    // ── Fallback: generic JSONB table ──
    const params = [type];
    const whereClauses = [];
    const simpleObj = {};
    for (const [k, v] of Object.entries(simpleFilterParams)) {
      if (v !== '' && v !== 'undefined' && v !== 'null') simpleObj[k] = v;
    }
    if (Object.keys(simpleObj).length > 0) {
      params.push(JSON.stringify(simpleObj));
      whereClauses.push(`data @> $${params.length}::jsonb`);
    }
    if (_filter) {
      try {
        const operatorFilter = JSON.parse(_filter);
        const { clauses, params: opParams } = buildOperatorClauses(operatorFilter, params.length + 1, null);
        for (const p of opParams) params.push(p);
        for (const c of clauses) whereClauses.push(c);
      } catch {
        return res.status(400).json({ error: 'Parámetro _filter inválido' });
      }
    }
    // Candado por empresa (los tipos sin esquema siempre se scopean)
    if (isScoped(type)) {
      params.push(req.companyId);
      whereClauses.push(`company_id = $${params.length}`);
    }
    const whereExtra = whereClauses.length > 0 ? ' AND ' + whereClauses.join(' AND ') : '';
    params.push(limit);
    params.push(skip);
    const sql = `SELECT id, data, created_date, updated_date, created_by_id FROM app_entities WHERE entity_type = $1${whereExtra} ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await query(sql, params);
    return res.json(result.rows.map(r => ({ ...r.data, id: r.id, created_date: r.created_date, updated_date: r.updated_date, created_by_id: r.created_by_id })));
  } catch (err) {
    console.error(`GET /entities/${req.params.type}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET single ──────────────────────────────────────────────────────────────

router.get('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const isAdmin = req.userRole === 'admin';

    if (type === 'User') {
      const fields = isAdmin
        ? 'id, email, full_name, role, role_id, location_id, is_active, company_id, created_date, updated_date, data'
        : 'id, full_name, role, role_id, location_id, is_active';
      const result = await query(`SELECT ${fields} FROM app_users WHERE id = $1`, [id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'No encontrado' });
      const u = result.rows[0];
      return res.json({
        ...(isAdmin ? u.data : {}),
        id: u.id,
        full_name: u.full_name,
        role: u.role,
        role_id: u.role_id,
        location_id: u.location_id,
        is_active: u.is_active,
        company_id: u.company_id,
        ...(isAdmin ? { email: u.email, created_date: u.created_date, updated_date: u.updated_date } : {}),
      });
    }

    const schema = ENTITY_SCHEMAS[type];
    if (schema) {
      const typedCols = Object.keys(schema.typed);
      const selectCols = typedCols.length > 0 ? `id, ${typedCols.join(', ')}, data, created_date, updated_date, created_by_id` : 'id, data, created_date, updated_date, created_by_id';
      const scoped = isScoped(type);
      const result = await query(
        `SELECT ${selectCols} FROM ${schema.table} WHERE id = $1${scoped ? ' AND company_id = $2' : ''}`,
        scoped ? [id, req.companyId] : [id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'No encontrado' });
      return res.json(mergeRecord(result.rows[0], schema));
    }

    // Fallback
    const result = await query('SELECT id, data, created_date, updated_date, created_by_id FROM app_entities WHERE entity_type = $1 AND id = $2 AND company_id = $3', [type, id, req.companyId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    const r = result.rows[0];
    return res.json({ ...r.data, id: r.id, created_date: r.created_date, updated_date: r.updated_date, created_by_id: r.created_by_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST create ──────────────────────────────────────────────────────────────

router.post('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const id = req.body.id || uuidv4();
    const createdBy = req.userId || null;
    const now = new Date().toISOString();

    if (type === 'User') {
      const { email, password, full_name, role, role_id, location_id, company_id: _cid, ...rest } = req.body;
      let password_hash = null;
      if (password) {
        const { default: bcrypt } = await import('bcryptjs');
        password_hash = await bcrypt.hash(password, 10);
      }
      const result = await query(
        'INSERT INTO app_users (id, email, password_hash, full_name, role, role_id, location_id, data, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, full_name=EXCLUDED.full_name, role=EXCLUDED.role, role_id=EXCLUDED.role_id, location_id=EXCLUDED.location_id, data=EXCLUDED.data RETURNING *',
        // El usuario nuevo queda en la empresa activa de quien lo crea (el selector del admin).
        [id, email?.toLowerCase(), password_hash, full_name, role || 'user', role_id, location_id, JSON.stringify(rest), req.companyId || 'equist']
      );
      const u = result.rows[0];
      return res.json({ ...u.data, id: u.id, email: u.email, full_name: u.full_name, role: u.role, role_id: u.role_id, location_id: u.location_id, is_active: u.is_active, created_date: u.created_date, updated_date: u.updated_date });
    }

    const schema = ENTITY_SCHEMAS[type];
    const { id: _id, created_date, updated_date, created_by_id, ...recordData } = req.body;

    if (type === 'Sale' && !recordData.invoice_number) {
      recordData.invoice_number = await assignInvoiceNumber(id, req.companyId, !!req.body.id);
    }

    if (schema) {
      const { typedValues, dataRest } = splitRecord(schema, recordData);
      const typedCols = Object.keys(schema.typed);
      const colNames = ['id', ...typedCols, 'data', 'created_date', 'updated_date', 'created_by_id'];
      const colValues = [
        id,
        ...typedCols.map(c => typedValues[c] !== undefined ? typedValues[c] : null),
        JSON.stringify(dataRest),
        now,
        now,
        createdBy,
      ];
      // Candado por empresa: sellar el registro con la empresa activa
      if (isScoped(type)) { colNames.push('company_id'); colValues.push(req.companyId); }
      const placeholders = colValues.map((_, i) => `$${i + 1}`).join(', ');
      const updateCols = [...typedCols.map(c => `${c} = EXCLUDED.${c}`), 'data = EXCLUDED.data', 'updated_date = EXCLUDED.updated_date'];
      const result = await query(
        `INSERT INTO ${schema.table} (${colNames.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateCols.join(', ')} RETURNING *`,
        colValues
      );
      return res.json(mergeRecord(result.rows[0], schema));
    }

    // Fallback
    await query(
      'INSERT INTO app_entities (id, entity_type, data, created_date, updated_date, created_by_id, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT(id, entity_type) DO UPDATE SET data=EXCLUDED.data, updated_date=EXCLUDED.updated_date',
      [id, type, JSON.stringify(recordData), now, now, createdBy, req.companyId]
    );
    return res.json({ ...recordData, id, created_date: now, updated_date: now, created_by_id: createdBy });
  } catch (err) {
    console.error(`POST /entities/${req.params.type}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT update ───────────────────────────────────────────────────────────────

router.put('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const now = new Date().toISOString();

    if (type === 'User') {
      const { email, password, full_name, role, role_id, location_id, is_active, company_id: _cid, id: _id, created_date, updated_date, ...rest } = req.body;
      const sets = ['updated_date = NOW()'];
      const params = [id];
      if (email !== undefined) { params.push(email.toLowerCase()); sets.push(`email = $${params.length}`); }
      if (full_name !== undefined) { params.push(full_name); sets.push(`full_name = $${params.length}`); }
      if (role !== undefined) { params.push(role); sets.push(`role = $${params.length}`); }
      if (role_id !== undefined) { params.push(role_id); sets.push(`role_id = $${params.length}`); }
      if (location_id !== undefined) { params.push(location_id); sets.push(`location_id = $${params.length}`); }
      if (is_active !== undefined) { params.push(is_active); sets.push(`is_active = $${params.length}`); }
      if (password) {
        const { default: bcrypt } = await import('bcryptjs');
        params.push(await bcrypt.hash(password, 10)); sets.push(`password_hash = $${params.length}`);
      }
      if (Object.keys(rest).length > 0) {
        params.push(JSON.stringify(rest)); sets.push(`data = data || $${params.length}::jsonb`);
      }
      const result = await query(`UPDATE app_users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
      const u = result.rows[0];
      if (!u) return res.status(404).json({ error: 'No encontrado' });
      return res.json({ ...u.data, id: u.id, email: u.email, full_name: u.full_name, role: u.role, role_id: u.role_id, location_id: u.location_id, is_active: u.is_active, created_date: u.created_date, updated_date: u.updated_date });
    }

    const schema = ENTITY_SCHEMAS[type];
    const { id: _id, created_date, updated_date, created_by_id, ...updates } = req.body;

    // El contador de facturas nunca retrocede al editar la empresa: si el formulario
    // se abrió antes de unas ventas, guardaría un número viejo y se repetirían facturas.
    if (type === 'Company' && updates.invoice_next !== undefined) {
      const cur = await query(`SELECT (data->>'invoice_next') AS n FROM entity_company WHERE id = $1`, [id]);
      const current = Number(cur.rows[0]?.n);
      if (Number.isFinite(current) && Number(updates.invoice_next) < current) updates.invoice_next = current;
    }

    if (schema) {
      const { typedValues, dataRest } = splitRecord(schema, updates);
      const typedCols = Object.keys(schema.typed);
      const sets = ['updated_date = $1', 'data = data || $2::jsonb'];
      const params = [now, JSON.stringify(dataRest)];
      for (const col of typedCols) {
        if (typedValues[col] !== undefined) {
          params.push(typedValues[col]);
          sets.push(`${col} = $${params.length}`);
        }
      }
      params.push(id);
      let whereClause = `id = $${params.length}`;
      if (isScoped(type)) { params.push(req.companyId); whereClause += ` AND company_id = $${params.length}`; }
      const result = await query(
        `UPDATE ${schema.table} SET ${sets.join(', ')} WHERE ${whereClause} RETURNING *`,
        params
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'No encontrado' });
      return res.json(mergeRecord(result.rows[0], schema));
    }

    // Fallback
    const result = await query(
      'UPDATE app_entities SET data = data || $1::jsonb, updated_date = $2 WHERE entity_type = $3 AND id = $4 AND company_id = $5 RETURNING *',
      [JSON.stringify(updates), now, type, id, req.companyId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    const r = result.rows[0];
    return res.json({ ...r.data, id: r.id, created_date: r.created_date, updated_date: r.updated_date, created_by_id: r.created_by_id });
  } catch (err) {
    console.error(`PUT /entities/${req.params.type}/${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

router.delete('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const schema = ENTITY_SCHEMAS[type];

    if (type === 'User') {
      await query('UPDATE app_users SET is_active = false WHERE id = $1', [id]);
    } else if (schema) {
      const scoped = isScoped(type);
      await query(
        `DELETE FROM ${schema.table} WHERE id = $1${scoped ? ' AND company_id = $2' : ''}`,
        scoped ? [id, req.companyId] : [id]
      );
    } else {
      await query('DELETE FROM app_entities WHERE entity_type = $1 AND id = $2 AND company_id = $3', [type, id, req.companyId]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
