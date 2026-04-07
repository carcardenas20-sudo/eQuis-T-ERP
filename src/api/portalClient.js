/**
 * portalClient.js
 * Cliente sin autenticación para el portal público de empleados.
 * Usa /api/portal en lugar de /api/entities — solo lectura, entidades limitadas.
 */

async function apiFetch(path, options = {}) {
  const response = await fetch(`/api/portal${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json();
}

function makeEntity(entityType) {
  return {
    list: (orderBy) => {
      const params = new URLSearchParams();
      if (orderBy) params.set('_order_by', orderBy);
      const qs = params.toString();
      return apiFetch(`/${entityType}${qs ? '?' + qs : ''}`);
    },
    filter: (queryObj, orderBy) => {
      const params = new URLSearchParams();
      if (queryObj) Object.entries(queryObj).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)); });
      if (orderBy) params.set('_order_by', orderBy);
      const qs = params.toString();
      return apiFetch(`/${entityType}${qs ? '?' + qs : ''}`);
    },
    get: (id) => apiFetch(`/${entityType}/${id}`),
    create: (body) => apiFetch(`/${entityType}`, { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => apiFetch(`/${entityType}/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  };
}

const entitiesProxy = new Proxy({}, {
  get: (_, entityType) => makeEntity(String(entityType)),
});

export const portalClient = { entities: entitiesProxy };
