/**
 * localClient.js
 * Cliente local que reemplaza el SDK de Base44.
 * Provee la misma interfaz: client.entities.X.filter(), .list(), .get(), .create(), .update(), .delete()
 * y client.auth.me(), .login(), .logout()
 */

const API_BASE = '/api';
const TOKEN_KEY = 'equist_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(t) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch {}
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    const msg = err.error || err.message || `HTTP ${response.status}`;
    const error = new Error(msg);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/**
 * Serialize a filter object to query string params.
 * Simple scalar values become ?key=value (JSONB containment).
 * Object values (operator style like {$gte, $lte, $in}) are JSON-encoded
 * into _filter param for the server to parse into SQL operators.
 */
function serializeFilter(queryObj) {
  const params = new URLSearchParams();
  const operatorFilter = {};
  let hasOperators = false;
  const simpleFilter = {};

  if (queryObj && typeof queryObj === 'object') {
    for (const [k, v] of Object.entries(queryObj)) {
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === 'object') {
        operatorFilter[k] = v;
        hasOperators = true;
      } else {
        simpleFilter[k] = String(v);
      }
    }
  }

  // Scalar filters as flat params (JSONB containment on server)
  for (const [k, v] of Object.entries(simpleFilter)) {
    params.set(k, v);
  }

  // Operator-style filters encoded as JSON
  if (hasOperators) {
    params.set('_filter', JSON.stringify(operatorFilter));
  }

  return params;
}

function makeEntity(entityType) {
  return {
    list: (orderBy, limit) => {
      const params = new URLSearchParams();
      if (orderBy) params.set('_order_by', orderBy);
      if (limit) params.set('_limit', String(limit));
      const qs = params.toString();
      return apiFetch(`/entities/${entityType}${qs ? '?' + qs : ''}`);
    },
    filter: (queryObj, orderBy, limit) => {
      const params = serializeFilter(queryObj);
      if (orderBy) params.set('_order_by', orderBy);
      if (limit) params.set('_limit', String(limit));
      const qs = params.toString();
      return apiFetch(`/entities/${entityType}${qs ? '?' + qs : ''}`);
    },
    get: (id) => apiFetch(`/entities/${entityType}/${id}`),
    create: (data) => apiFetch(`/entities/${entityType}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/entities/${entityType}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/entities/${entityType}/${id}`, { method: 'DELETE' }),
  };
}

const auth = {
  me: () => apiFetch('/auth/me'),
  login: (email, password) => apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  logout: () => {
    setToken(null);
  },
  redirectToLogin: () => {
    setToken(null);
    window.location.reload();
  },
};

const entitiesProxy = new Proxy({}, {
  get: (_, entityType) => makeEntity(String(entityType)),
});

export const localClient = {
  entities: entitiesProxy,
  auth,
};
