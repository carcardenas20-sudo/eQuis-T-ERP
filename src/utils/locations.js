// Puestos ambulantes: son "sucursales" de tipo ambulante que pertenecen a una sucursal
// (parent_location_id). Tienen inventario, ventas y caja propios, pero en filtros y
// reportes se suman a su sucursal.

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export const isAmbulante = (loc) => loc?.tipo === "ambulante";

// Sucursal + sus puestos ambulantes (para filtrar ventas, inventario, caja…).
export function locationFamilyIds(locationId, locations) {
  if (!locationId || locationId === "all") return [];
  const hijos = (locations || []).filter((l) => isAmbulante(l) && l.parent_location_id === locationId).map((l) => l.id);
  return [locationId, ...hijos];
}

// Filtro para las consultas: un id solo o { $in: [...] } si tiene ambulantes.
export function locationFilterValue(locationId, locations) {
  const ids = locationFamilyIds(locationId, locations);
  if (ids.length <= 1) return locationId;
  return { $in: ids };
}

// "Puesto Plaza (de Centro)" para mostrar.
export function locationLabel(loc, locations) {
  if (!loc) return "";
  if (!isAmbulante(loc)) return loc.name;
  const padre = (locations || []).find((l) => l.id === loc.parent_location_id);
  return padre ? `${loc.name} (ambulante de ${padre.name})` : `${loc.name} (ambulante)`;
}

export const diasTexto = (dias) => (Array.isArray(dias) && dias.length ? dias.slice().sort().map((d) => DIAS_CORTOS[d]).join(" · ") : "Todos los días");

// ¿Hoy (hora Colombia) es día de venta del puesto?
export function esDiaDeVenta(loc, date = new Date()) {
  if (!isAmbulante(loc) || !Array.isArray(loc.dias_venta) || !loc.dias_venta.length) return true;
  const d = new Date(date.toLocaleString("en-US", { timeZone: "America/Bogota" })).getDay();
  return loc.dias_venta.includes(d);
}

// Sucursales cacheadas por carga de página (para armar filtros sin repetir consultas).
import { Location } from "@/entities/all";
let locationsPromise = null;
export function loadLocationsCached() {
  if (!locationsPromise) {
    locationsPromise = Location.list().catch(() => { locationsPromise = null; return []; });
  }
  return locationsPromise;
}
// Valor de filtro location_id que incluye los puestos ambulantes de la sucursal.
export async function locationFilterAsync(locationId) {
  return locationFilterValue(locationId, await loadLocationsCached());
}
