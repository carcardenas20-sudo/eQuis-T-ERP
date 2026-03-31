/**
 * ✅ SISTEMA DE FECHAS SIMPLIFICADO
 * Todas las fechas se manejan en hora local del servidor
 */

/**
 * Obtiene la fecha y hora actual como ISO string
 */
export const getCurrentSaleDateTime = () => {
  return new Date().toISOString();
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD
 */
export const getCurrentDateString = () => {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};

// YYYY-MM-DD para una fecha dada en zona América/Bogotá
export const getColombiaDateString = (date = new Date()) => {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};

/**
 * Formatea una fecha para mostrar en pantalla
 */
export const formatColombiaDate = (dateString, format = 'dd/MM/yyyy HH:mm') => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  if (format.includes('HH:mm')) {
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  return `${day}/${month}/${year}`;
};

/**
 * Convierte fecha de input (YYYY-MM-DD) a ISO datetime
 */
export const inputDateToISO = (dateString, hour = 12, minute = 0) => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0);
  return date.toISOString();
};

// ✅ FUNCIONES LEGACY (para compatibilidad)
export const getNowInColombia = getCurrentSaleDateTime;
export const toColombiaTime = (date) => date;
export const fromColombiaTime = (date) => date;
export const dateStringToColombiaISO = inputDateToISO;
export const dateToColombiaISO = (date) => date ? new Date(date).toISOString() : null; // legacy, avoid for date-only filters
export const getLastNDaysRangeInColombia = (days) => {
  const now = new Date();
  const end = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const startDate = new Date(now);
  // include today, so subtract days-1
  startDate.setDate(startDate.getDate() - (days - 1));
  const start = startDate.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  return { start, end };
};
export const getThisWeekStartInColombia = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
};
export const getThisMonthStartInColombia = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
};