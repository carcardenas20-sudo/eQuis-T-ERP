import express from 'express';
import { query } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { ADMIN_ONLY_WRITE_ENTITIES } from '../config.js';
import { ENTITY_SCHEMAS, splitRecord, mergeRecord } from '../entitySchemas.js';

const router = express.Router();

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

router.use('/:type', requireAdminForPrivileged);
router.use('/:type/:id', requireAdminForPrivileged);

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
        ? 'id, email, full_name, role, role_id, location_id, is_active, created_date, updated_date, data'
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
        ? 'id, email, full_name, role, role_id, location_id, is_active, created_date, updated_date, data'
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
        ...(isAdmin ? { email: u.email, created_date: u.created_date, updated_date: u.updated_date } : {}),
      });
    }

    const schema = ENTITY_SCHEMAS[type];
    if (schema) {
      const typedCols = Object.keys(schema.typed);
      const selectCols = typedCols.length > 0 ? `id, ${typedCols.join(', ')}, data, created_date, updated_date, created_by_id` : 'id, data, created_date, updated_date, created_by_id';
      const result = await query(`SELECT ${selectCols} FROM ${schema.table} WHERE id = $1`, [id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'No encontrado' });
      return res.json(mergeRecord(result.rows[0], schema));
    }

    // Fallback
    const result = await query('SELECT id, data, created_date, updated_date, created_by_id FROM app_entities WHERE entity_type = $1 AND id = $2', [type, id]);
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
      const { email, password, full_name, role, role_id, location_id, ...rest } = req.body;
      let password_hash = null;
      if (password) {
        const { default: bcrypt } = await import('bcryptjs');
        password_hash = await bcrypt.hash(password, 10);
      }
      const result = await query(
        'INSERT INTO app_users (id, email, password_hash, full_name, role, role_id, location_id, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, full_name=EXCLUDED.full_name, role=EXCLUDED.role, role_id=EXCLUDED.role_id, location_id=EXCLUDED.location_id, data=EXCLUDED.data RETURNING *',
        [id, email?.toLowerCase(), password_hash, full_name, role || 'user', role_id, location_id, JSON.stringify(rest)]
      );
      const u = result.rows[0];
      return res.json({ ...u.data, id: u.id, email: u.email, full_name: u.full_name, role: u.role, role_id: u.role_id, location_id: u.location_id, is_active: u.is_active, created_date: u.created_date, updated_date: u.updated_date });
    }

    const schema = ENTITY_SCHEMAS[type];
    const { id: _id, created_date, updated_date, created_by_id, ...recordData } = req.body;

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
      'INSERT INTO app_entities (id, entity_type, data, created_date, updated_date, created_by_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(id, entity_type) DO UPDATE SET data=EXCLUDED.data, updated_date=EXCLUDED.updated_date',
      [id, type, JSON.stringify(recordData), now, now, createdBy]
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
      const { email, password, full_name, role, role_id, location_id, is_active, id: _id, created_date, updated_date, ...rest } = req.body;
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
      const result = await query(
        `UPDATE ${schema.table} SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'No encontrado' });
      return res.json(mergeRecord(result.rows[0], schema));
    }

    // Fallback
    const result = await query(
      'UPDATE app_entities SET data = data || $1::jsonb, updated_date = $2 WHERE entity_type = $3 AND id = $4 RETURNING *',
      [JSON.stringify(updates), now, type, id]
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
      await query(`DELETE FROM ${schema.table} WHERE id = $1`, [id]);
    } else {
      await query('DELETE FROM app_entities WHERE entity_type = $1 AND id = $2', [type, id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
