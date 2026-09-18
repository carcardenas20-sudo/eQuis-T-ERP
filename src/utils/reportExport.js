import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

// ── Etiquetas ────────────────────────────────────────────────────────────────
const METHOD_LABELS = { cash: 'Efectivo', transfer: 'Transferencia', qr: 'QR', card: 'Tarjeta', credit: 'Crédito' };
const STATUS_LABELS = { completed: 'Completada', credit: 'Crédito', cancelled: 'Anulada', pending: 'Pendiente' };
const CATEGORY_LABELS = {
  chaquetas_hombre: 'Chaquetas Hombre', chaquetas_mujer: 'Chaquetas Mujer',
  chaquetas_niños: 'Chaquetas Niños', accesorios: 'Accesorios', materia_prima: 'Materia Prima',
};

// Fecha "de negocio" en Colombia (yyyy-mm-dd) a partir del created_date.
function colombiaDay(dateVal) {
  try {
    return new Date(dateVal).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  } catch {
    return String(dateVal || '').slice(0, 10);
  }
}

// Aplica los MISMOS filtros que los componentes de reporte (created_date, sucursal, vendedor).
function filterSales(data, filters) {
  const { sales = [] } = data;
  const { startDate, endDate, location, employee } = filters;
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end = endDate ? new Date(endDate + 'T23:59:59') : null;
  return sales.filter(sale => {
    const d = new Date(sale.created_date || sale.sale_date);
    const dateMatch = start && end ? d >= start && d <= end : true;
    const locMatch = location === 'all' || sale.location_id === location;
    const empMatch = employee === 'all' || sale.created_by === employee;
    return dateMatch && locMatch && empMatch;
  });
}

// Construye todas las agregaciones a partir de los datos ya filtrados.
function buildAggregations(data, filters) {
  const { saleItems = [], products = [], locations = [], users = [] } = data;
  const fSales = filterSales(data, filters);
  const saleIds = new Set(fSales.map(s => s.id));
  const fItems = saleItems.filter(it => saleIds.has(it.sale_id));

  const locName = Object.fromEntries(locations.map(l => [l.id, l.name]));
  const userName = Object.fromEntries(users.map(u => [u.email, u.full_name]));
  const prodBySku = Object.fromEntries(products.map(p => [p.sku, p]));

  const totalVentas = fSales.reduce((s, v) => s + (Number(v.total_amount) || 0), 0);
  const numVentas = fSales.length;

  // Por método de pago
  const byMethod = {};
  fSales.forEach(v => {
    const methods = Array.isArray(v.payment_methods) ? v.payment_methods : [];
    if (methods.length) {
      methods.forEach(m => { byMethod[m.method] = (byMethod[m.method] || 0) + (Number(m.amount) || 0); });
    } else {
      byMethod.cash = (byMethod.cash || 0) + (Number(v.total_amount) || 0);
    }
  });

  // Por día
  const byDay = {};
  fSales.forEach(v => {
    const d = colombiaDay(v.created_date || v.sale_date);
    if (!byDay[d]) byDay[d] = { total: 0, count: 0 };
    byDay[d].total += Number(v.total_amount) || 0;
    byDay[d].count += 1;
  });

  // Por producto / categoría (desde ítems)
  const byProduct = {};
  const byCategory = {};
  let costoTotal = 0;
  fItems.forEach(it => {
    const p = prodBySku[it.product_id];
    const rev = Number(it.line_total) || 0;
    const qty = Number(it.quantity) || 0;
    const cost = (Number(p?.base_cost) || 0) * qty;
    costoTotal += cost;
    const pk = it.product_id || 's/sku';
    if (!byProduct[pk]) byProduct[pk] = { name: p?.name || 'Producto no encontrado', qty: 0, revenue: 0, cost: 0 };
    byProduct[pk].qty += qty; byProduct[pk].revenue += rev; byProduct[pk].cost += cost;
    const cat = p?.category || 'sin_categoria';
    if (!byCategory[cat]) byCategory[cat] = 0;
    byCategory[cat] += rev;
  });

  // Por vendedor / sucursal
  const byEmployee = {};
  const byLocation = {};
  fSales.forEach(v => {
    const emp = v.created_by || '—';
    if (!byEmployee[emp]) byEmployee[emp] = { total: 0, count: 0 };
    byEmployee[emp].total += Number(v.total_amount) || 0; byEmployee[emp].count += 1;
    const loc = v.location_id || '—';
    if (!byLocation[loc]) byLocation[loc] = { total: 0, count: 0 };
    byLocation[loc].total += Number(v.total_amount) || 0; byLocation[loc].count += 1;
  });

  return {
    fSales, fItems, locName, userName, prodBySku,
    totalVentas, numVentas, ticket: numVentas ? totalVentas / numVentas : 0,
    unidades: fItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
    costoTotal, utilidad: totalVentas - costoTotal,
    byMethod, byDay, byProduct, byCategory, byEmployee, byLocation,
  };
}

function metaLine(filters, data) {
  const locName = filters.location === 'all'
    ? 'Todas las sucursales'
    : (data.locations.find(l => l.id === filters.location)?.name || filters.location);
  const empName = filters.employee === 'all'
    ? 'Todos los vendedores'
    : (data.users.find(u => u.email === filters.employee)?.full_name || filters.employee);
  return { locName, empName, rango: `${filters.startDate} a ${filters.endDate}` };
}

// ── EXCEL ────────────────────────────────────────────────────────────────────
export function exportReportsExcel(data, filters) {
  const a = buildAggregations(data, filters);
  const { locName: locStr, empName, rango } = metaLine(filters, data);
  const wb = XLSX.utils.book_new();
  const money = (n) => Math.round(Number(n) || 0);

  // Resumen
  const resumen = [
    ['REPORTE DE VENTAS — eQuis-T'],
    ['Rango', rango],
    ['Sucursal', locStr],
    ['Vendedor', empName],
    ['Generado', new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })],
    [],
    ['Total ventas', money(a.totalVentas)],
    ['N.º de ventas', a.numVentas],
    ['Ticket promedio', money(a.ticket)],
    ['Unidades vendidas', a.unidades],
    ['Costo estimado', money(a.costoTotal)],
    ['Utilidad estimada', money(a.utilidad)],
    [],
    ['POR MÉTODO DE PAGO', ''],
    ...Object.entries(a.byMethod).sort((x, y) => y[1] - x[1]).map(([m, v]) => [METHOD_LABELS[m] || m, money(v)]),
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
  wsResumen['!cols'] = [{ wch: 26 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // Ventas por día
  const dias = Object.entries(a.byDay).sort((x, y) => x[0] < y[0] ? -1 : 1)
    .map(([d, v]) => ({ Fecha: d, 'N.º ventas': v.count, Total: money(v.total) }));
  const wsDias = XLSX.utils.json_to_sheet(dias.length ? dias : [{ Fecha: '', 'N.º ventas': '', Total: '' }]);
  wsDias['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsDias, 'Ventas por día');

  // Por producto
  const prods = Object.entries(a.byProduct).sort((x, y) => y[1].revenue - x[1].revenue)
    .map(([sku, v]) => ({
      Producto: v.name, SKU: sku, Cantidad: v.qty, Ingresos: money(v.revenue),
      Costo: money(v.cost), Utilidad: money(v.revenue - v.cost),
      'Margen %': v.revenue > 0 ? Math.round(((v.revenue - v.cost) / v.revenue) * 100) : 0,
    }));
  const wsProd = XLSX.utils.json_to_sheet(prods.length ? prods : [{ Producto: 'Sin datos' }]);
  wsProd['!cols'] = [{ wch: 34 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsProd, 'Por producto');

  // Por categoría
  const cats = Object.entries(a.byCategory).sort((x, y) => y[1] - x[1])
    .map(([c, v]) => ({ Categoría: CATEGORY_LABELS[c] || c, Ingresos: money(v) }));
  const wsCat = XLSX.utils.json_to_sheet(cats.length ? cats : [{ Categoría: 'Sin datos', Ingresos: 0 }]);
  wsCat['!cols'] = [{ wch: 24 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsCat, 'Por categoría');

  // Por vendedor
  const emps = Object.entries(a.byEmployee).sort((x, y) => y[1].total - x[1].total)
    .map(([e, v]) => ({ Vendedor: a.userName[e] || e, 'N.º ventas': v.count, Total: money(v.total) }));
  const wsEmp = XLSX.utils.json_to_sheet(emps.length ? emps : [{ Vendedor: 'Sin datos' }]);
  wsEmp['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsEmp, 'Por vendedor');

  // Por sucursal
  const locs = Object.entries(a.byLocation).sort((x, y) => y[1].total - x[1].total)
    .map(([l, v]) => ({ Sucursal: a.locName[l] || l, 'N.º ventas': v.count, Total: money(v.total) }));
  const wsLoc = XLSX.utils.json_to_sheet(locs.length ? locs : [{ Sucursal: 'Sin datos' }]);
  wsLoc['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsLoc, 'Por sucursal');

  // Detalle de ventas
  const detalle = a.fSales
    .slice()
    .sort((x, y) => new Date(x.created_date) - new Date(y.created_date))
    .map(v => ({
      Fecha: colombiaDay(v.created_date || v.sale_date),
      Factura: v.invoice_number || String(v.id || '').slice(-8),
      Sucursal: a.locName[v.location_id] || v.location_id || '',
      Vendedor: a.userName[v.created_by] || v.created_by || '',
      Cliente: v.customer_name || '',
      Estado: STATUS_LABELS[v.status] || v.status || '',
      Métodos: (Array.isArray(v.payment_methods) ? v.payment_methods : [])
        .map(m => `${METHOD_LABELS[m.method] || m.method}: ${money(m.amount)}`).join(' · '),
      Total: money(v.total_amount),
    }));
  const wsDet = XLSX.utils.json_to_sheet(detalle.length ? detalle : [{ Fecha: 'Sin ventas' }]);
  wsDet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 24 }, { wch: 12 }, { wch: 32 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsDet, 'Detalle ventas');

  XLSX.writeFile(wb, `Reporte_ventas_${filters.startDate}_a_${filters.endDate}.xlsx`);
}

// ── PDF (resumen de una página) ──────────────────────────────────────────────
export function exportReportsPDF(data, filters) {
  const a = buildAggregations(data, filters);
  const { locName: locStr, empName, rango } = metaLine(filters, data);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  const left = 40;
  let y = 46;

  doc.setFontSize(18); doc.setFont(undefined, 'bold');
  doc.text('Reporte de Ventas — eQuis-T', left, y); y += 20;
  doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(90);
  doc.text(`Rango: ${rango}    Sucursal: ${locStr}    Vendedor: ${empName}`, left, y); y += 13;
  doc.text(`Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`, left, y);
  doc.setTextColor(0); y += 24;

  // KPIs
  const kpis = [
    ['Total ventas', money(a.totalVentas)],
    ['N.º de ventas', String(a.numVentas)],
    ['Ticket promedio', money(a.ticket)],
    ['Unidades', String(a.unidades)],
    ['Utilidad estimada', money(a.utilidad)],
  ];
  doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text('Resumen', left, y); y += 6;
  doc.setDrawColor(220); doc.line(left, y, 555, y); y += 16;
  doc.setFontSize(11); doc.setFont(undefined, 'normal');
  kpis.forEach(([k, v]) => {
    doc.text(k, left, y); doc.setFont(undefined, 'bold'); doc.text(v, 300, y); doc.setFont(undefined, 'normal'); y += 17;
  });
  y += 12;

  const section = (title, rows) => {
    if (y > 720) { doc.addPage(); y = 46; }
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(title, left, y); y += 6;
    doc.setDrawColor(220); doc.line(left, y, 555, y); y += 16;
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    if (!rows.length) { doc.setTextColor(150); doc.text('Sin datos', left, y); doc.setTextColor(0); y += 16; }
    rows.forEach(([k, v]) => {
      if (y > 780) { doc.addPage(); y = 46; }
      doc.text(String(k).slice(0, 60), left, y); doc.text(String(v), 400, y); y += 15;
    });
    y += 12;
  };

  section('Por método de pago', Object.entries(a.byMethod).sort((x, y2) => y2[1] - x[1]).map(([m, v]) => [METHOD_LABELS[m] || m, money(v)]));
  section('Top 10 productos', Object.entries(a.byProduct).sort((x, y2) => y2[1].revenue - x[1].revenue).slice(0, 10).map(([, v]) => [v.name, money(v.revenue)]));
  section('Por sucursal', Object.entries(a.byLocation).sort((x, y2) => y2[1].total - x[1].total).map(([l, v]) => [a.locName[l] || l, money(v.total)]));

  doc.save(`Reporte_ventas_${filters.startDate}_a_${filters.endDate}.pdf`);
}
