/**
 * portalClient.js
 * Cliente sin autenticación para el portal público de empleados.
 * Usa /api/portal en lugar de /api/entities — solo lectura, entidades limitadas.
 */

// Multiempresa: el enlace del portal trae ?empresa=<id> (V-LIVE, etc.). Se recuerda en el
// dispositivo para las siguientes visitas. Sin parámetro = eQuis-T (enlaces de siempre).
const PORTAL_COMPANY_KEY = 'equist_portal_company';
export function getPortalCompany() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('empresa');
    if (fromUrl !== null) {
      if (fromUrl) localStorage.setItem(PORTAL_COMPANY_KEY, fromUrl); else localStorage.removeItem(PORTAL_COMPANY_KEY);
      return fromUrl;
    }
    return localStorage.getItem(PORTAL_COMPANY_KEY) || '';
  } catch { return ''; }
}
export function portalHeaders(extra = {}) {
  const c = getPortalCompany();
  return { 'Content-Type': 'application/json', ...(c ? { 'X-Portal-Company': c } : {}), ...extra };
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`/api/portal${path}`, {
    ...options,
    headers: portalHeaders(options.headers || {}),
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
