import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Combined";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Trash2, Clock, RefreshCw, ChevronUp, ChevronDown, Plus, Minus, Save, Image, Truck, PackageCheck, CheckCircle2, X } from "lucide-react";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import PendingMobileView from "@/components/pending/MobileView";
import RouteChecklist from "@/components/route/RouteChecklist";

const WIDTHS_KEY = "pending_column_widths";

async function getSavedOrder() {
  try {
    const configs = await base44.entities.AppConfig.filter({ key: "pending_row_order" });
    if (configs.length > 0) return JSON.parse(configs[0].value);
  } catch {}
  return [];
}
async function saveOrder(ids) {
  try {
    const configs = await base44.entities.AppConfig.filter({ key: "pending_row_order" });
    if (configs.length > 0) {
      await base44.entities.AppConfig.update(configs[0].id, { value: JSON.stringify(ids) });
    } else {
      await base44.entities.AppConfig.create({ key: "pending_row_order", value: JSON.stringify(ids) });
    }
  } catch {}
}
function getSavedWidths() {
  try { return JSON.parse(localStorage.getItem(WIDTHS_KEY)) || null; }
  catch { return null; }
}
function saveWidths(widths) { localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths)); }

function getNextFriday() {
  // Usar zona horaria de Colombia (UTC-5)
  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const today = new Date();
  const parts = formatter.formatToParts(today);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  const localToday = new Date(`${year}-${month}-${day}`);
  const dayOfWeek = localToday.getDay();
  const daysUntilFriday = dayOfWeek === 5 ? 7 : (5 - dayOfWeek + 7) % 7;
  
  const nextFriday = new Date(localToday);
  nextFriday.setDate(localToday.getDate() + daysUntilFriday);
  
  return nextFriday.toISOString().split("T")[0];
}

async function getActiveFriday() {
  try {
    const configs = await base44.entities.AppConfig.filter({ key: "active_friday" });
    if (configs.length > 0) return configs[0].value;
  } catch {}
  return getNextFriday();
}

async function setActiveFriday(fridayDate) {
  try {
    const configs = await base44.entities.AppConfig.filter({ key: "active_friday" });
    if (configs.length > 0) {
      await base44.entities.AppConfig.update(configs[0].id, { value: fridayDate });
    } else {
      await base44.entities.AppConfig.create({ key: "active_friday", value: fridayDate });
    }
  } catch {}
}

export default function Pending() {
  const [rowsMap, setRowsMap] = useState({});
  const [orderedIds, setOrderedIds] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removedIds, setRemovedIds] = useState(new Set());
  const [blankRows, setBlankRows] = useState(4);
  const [orderSaved, setOrderSaved] = useState(false);
  const [columnWidths, setColumnWidths] = useState(() => getSavedWidths() || {
    sist: 28, entrego: 22, queda: 22, cant: 40, ref: 80, obs: 70
  });
  const [dispatchModal, setDispatchModal] = useState(null);
  const [dispatchItems, setDispatchItems] = useState([{ product_reference: "", quantity: "" }]);
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);
  const [deliveryModal, setDeliveryModal] = useState(null);
  const [deliveryItems, setDeliveryItems] = useState([{ product_reference: "", quantity: "" }]);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [activeFriday, setActiveFriday] = useState(null);
  const tableRef = useRef(null);
  const printAreaRef = useRef(null);

  const updateWidth = (key, value) => {
    const newWidths = { ...columnWidths, [key]: parseInt(value) || 10 };
    setColumnWidths(newWidths);
    saveWidths(newWidths);
  };

  useEffect(() => { 
    loadData();
    loadActiveFriday();
  }, []);

  const loadActiveFriday = async () => {
    const friday = await getActiveFriday();
    setActiveFriday(friday);
  };

  const loadData = async () => {
    setLoading(true);
    const [employees, productsData, deliveries, dispatches, inventoryData] = await Promise.all([
      base44.entities.Employee.list(),
      base44.entities.Producto.list(),
      base44.entities.Delivery.list(),
      base44.entities.Dispatch.list(),
      base44.entities.Inventory.list(),
    ]);
    const normProductos = (productsData || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra }));
    setAllProducts(normProductos);
    setInventory(inventoryData);

    // Calcular rango de mes actual (últimas 4 semanas)
    const today = new Date();
    const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);

    const map = {};
    const weeklyDeliveries = {}; // Rastrear entregas por semana por empleado
    dispatches.forEach(d => {
      if (!map[d.employee_id]) map[d.employee_id] = {};
      if (!map[d.employee_id][d.product_reference])
        map[d.employee_id][d.product_reference] = { dispatched: 0, delivered: 0 };
      map[d.employee_id][d.product_reference].dispatched += d.quantity || 0;
    });

    deliveries.forEach(delivery => {
      const empId = delivery.employee_id;
      if (!map[empId]) return;
      if (delivery.items && delivery.items.length > 0) {
        delivery.items.forEach(item => {
          if (map[empId][item.product_reference])
            map[empId][item.product_reference].delivered += item.quantity || 0;
        });
        // Contar para promedio semanal
        if (delivery.delivery_date) {
          const deliveryDate = new Date(delivery.delivery_date);
          if (deliveryDate >= fourWeeksAgo && deliveryDate <= today) {
            if (!weeklyDeliveries[empId]) weeklyDeliveries[empId] = 0;
            weeklyDeliveries[empId] += delivery.items.reduce((s, i) => s + (i.quantity || 0), 0);
          }
        }
      } else if (delivery.product_reference && map[empId][delivery.product_reference]) {
        map[empId][delivery.product_reference].delivered += delivery.quantity || 0;
        // Contar para promedio semanal
        if (delivery.delivery_date) {
          const deliveryDate = new Date(delivery.delivery_date);
          if (deliveryDate >= fourWeeksAgo && deliveryDate <= today) {
            if (!weeklyDeliveries[empId]) weeklyDeliveries[empId] = 0;
            weeklyDeliveries[empId] += delivery.quantity || 0;
          }
        }
      }
    });

    const activeRefs = new Set();
    Object.values(map).forEach(empMap =>
      Object.entries(empMap).forEach(([ref, data]) => {
        if (data.dispatched - data.delivered > 0) activeRefs.add(ref);
      })
    );

    const activeProducts = normProductos.filter(p => activeRefs.has(p.reference));
    setProducts(activeProducts);

    const newMap = {};
    employees
      .filter(e => map[e.employee_id])
      .forEach(employee => {
        const empMap = map[employee.employee_id] || {};
        const productCols = {};
        let total = 0;
        activeProducts.forEach(product => {
          const data = empMap[product.reference] || { dispatched: 0, delivered: 0 };
          const pending = Math.max(0, data.dispatched - data.delivered);
          productCols[product.reference] = pending;
          total += pending;
        });
        if (total > 0) {
          const totalDelivered = weeklyDeliveries[employee.employee_id] || 0;
          const weeklyAverage = Math.round((totalDelivered / 4) * 10) / 10;

          // % rendimiento (misma lógica que ProductionStats)
          const empDisps = dispatches
            .filter(d => d.employee_id === employee.employee_id)
            .map(d => ({ ...d, dispatch_date: (d.dispatch_date || '').slice(0, 10) }))
            .sort((a, b) => b.dispatch_date.localeCompare(a.dispatch_date));
          const empDelivs = deliveries
            .filter(d => d.employee_id === employee.employee_id)
            .map(d => ({ ...d, delivery_date: (d.delivery_date || '').slice(0, 10) }))
            .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date));
          const getU = (d) => d.items?.length > 0 ? d.items.reduce((s, i) => s + (i.quantity || 0), 0) : (d.quantity || 0);
          const dDates = [...new Set(empDisps.map(d => d.dispatch_date))].sort((a, b) => b.localeCompare(a));
          const lastDDate = dDates[0] || null;
          const penDDate = dDates[1] || null;
          const lastEDate = empDelivs.length > 0 ? empDelivs[0].delivery_date : null;
          const noEntrego = lastDDate && (!lastEDate || lastDDate > lastEDate);
          const lastEUnits = noEntrego ? 0 : (lastEDate ? empDelivs.filter(d => d.delivery_date === lastEDate).reduce((s, d) => s + getU(d), 0) : null);
          const refDDate = noEntrego ? lastDDate : penDDate;
          const penDUnits = refDDate ? empDisps.filter(d => d.dispatch_date === refDDate).reduce((s, d) => s + (d.quantity || 0), 0) : null;
          const performancePct = (lastEUnits !== null && penDUnits > 0) ? Math.round((lastEUnits / penDUnits) * 100) : null;

          newMap[employee.employee_id] = {
            id: employee.employee_id,
            employeeName: employee.name,
            phone: employee.phone || '',
            ...productCols,
            total,
            weeklyAverage,
            performancePct,
          };
        }
      });

    setRowsMap(newMap);
    const savedOrder = await getSavedOrder();
    const validIds = Object.keys(newMap);
    const ordered = [];
    savedOrder.forEach(id => { if (newMap[id]) ordered.push(id); });
    validIds.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });
    setOrderedIds(ordered);
    setRemovedIds(new Set());
    setLoading(false);
  };

  const visibleIds = orderedIds.filter(id => !removedIds.has(id) && rowsMap[id]);
  const visibleRows = visibleIds.map(id => rowsMap[id]);

  const moveRow = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= visibleIds.length) return;
    const newOrdered = [...orderedIds];
    const idA = visibleIds[index];
    const idB = visibleIds[targetIndex];
    const realA = newOrdered.indexOf(idA);
    const realB = newOrdered.indexOf(idB);
    [newOrdered[realA], newOrdered[realB]] = [newOrdered[realB], newOrdered[realA]];
    setOrderedIds(newOrdered);
    setOrderSaved(false);
  };

  const handleSaveOrder = async () => {
    await saveOrder(visibleIds);
    setOrderSaved(true);
    setTimeout(() => setOrderSaved(false), 2000);
  };

  const removeRow = (id) => setRemovedIds(prev => new Set([...prev, id]));

  const openDispatchModal = (row) => {
    setDispatchModal({ employeeId: row.id, employeeName: row.employeeName });
    setDispatchItems([{ product_reference: "", quantity: "" }]);
    setDispatchSuccess(false);
  };

  const closeDispatchModal = () => {
    setDispatchModal(null);
    setDispatchItems([{ product_reference: "", quantity: "" }]);
    setDispatchSuccess(false);
  };

  const handleDispatchItemChange = (index, field, value) => {
    const updated = [...dispatchItems];
    updated[index] = { ...updated[index], [field]: value };
    setDispatchItems(updated);
  };

  const addDispatchItem = () => setDispatchItems(prev => [...prev, { product_reference: "", quantity: "" }]);
  const removeDispatchItem = (index) => setDispatchItems(prev => prev.filter((_, i) => i !== index));

  // Delivery modal handlers
  const openDeliveryModal = (row) => {
    // Pre-fill with the pending products for this employee
    const pending = products
      .filter(p => (row[p.reference] || 0) > 0)
      .map(p => ({ product_reference: p.reference, quantity: String(row[p.reference]) }));
    setDeliveryModal({ employeeId: row.id, employeeName: row.employeeName, row });
    setDeliveryItems(pending.length > 0 ? pending : [{ product_reference: "", quantity: "" }]);
    setDeliverySuccess(false);
  };

  const closeDeliveryModal = () => {
    setDeliveryModal(null);
    setDeliveryItems([{ product_reference: "", quantity: "" }]);
    setDeliverySuccess(false);
  };

  const handleDeliveryItemChange = (index, field, value) => {
    const updated = [...deliveryItems];
    updated[index] = { ...updated[index], [field]: value };
    setDeliveryItems(updated);
  };

  const addDeliveryItem = () => setDeliveryItems(prev => [...prev, { product_reference: "", quantity: "" }]);
  const removeDeliveryItem = (index) => setDeliveryItems(prev => prev.filter((_, i) => i !== index));

  const handleDeliverySave = async () => {
    const validItems = deliveryItems.filter(item => item.product_reference && Number(item.quantity) > 0);
    if (validItems.length === 0) return;
    setDeliverySaving(true);
    const today_date = activeFriday || getNextFriday();
    // Get product prices for the delivery
    const itemsWithPrice = validItems.map(item => {
      const product = allProducts.find(p => p.reference === item.product_reference);
      const unit_price = product?.manufacturing_price || 0;
      const qty = Number(item.quantity);
      return {
        product_reference: item.product_reference,
        quantity: qty,
        unit_price,
        total_amount: unit_price * qty,
      };
    });
    const total_amount = itemsWithPrice.reduce((s, i) => s + i.total_amount, 0);
    await base44.entities.Delivery.create({
      employee_id: deliveryModal.employeeId,
      delivery_date: today_date,
      items: itemsWithPrice,
      total_amount,
      status: "pendiente",
    });
    setDeliverySaving(false);
    setDeliverySuccess(true);
    setTimeout(() => {
      closeDeliveryModal();
      loadData();
    }, 1200);
  };

  const handleDispatchSave = async () => {
    const validItems = dispatchItems.filter(item => item.product_reference && item.quantity > 0);
    if (validItems.length === 0) return;
    setDispatchSaving(true);
    const today_date = activeFriday || getNextFriday();
    await Promise.all(validItems.map(item =>
      base44.entities.Dispatch.create({
        employee_id: dispatchModal.employeeId,
        product_reference: item.product_reference,
        quantity: Number(item.quantity),
        dispatch_date: today_date,
        status: "despachado",
      })
    ));
    setDispatchSaving(false);
    setDispatchSuccess(true);
    setTimeout(() => {
      closeDispatchModal();
      loadData();
    }, 1200);
  };

  const today = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const nameCellW = 150;
  const totalCellW = 56;

  const getYesterdayFriday = () => {
    const d = new Date(activeFriday);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  };

  const getTomorrowFriday = () => {
    const d = new Date(activeFriday);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  };

  const handleCloseFriday = async () => {
    const nextFri = getTomorrowFriday();
    await setActiveFriday(nextFri);
    setActiveFriday(nextFri);
    loadData();
  };

  const exportExcel = () => {
    const headers = ["NOMBRE", "NÚMERO", ...products.flatMap(p => [p.name + " (SIST.)", p.name + " (ENTREGÓ)", p.name + " (LE QUEDA)"]), "TOTAL", "D.CANT1", "D.REF1", "D.CANT2", "D.REF2", "OBSERVACIONES"];
    const data = visibleRows.map(row => [
      row.employeeName, row.phone,
      ...products.flatMap(p => [row[p.reference] || 0, "", ""]),
      row.total, ...Array(4).fill(""), "",
    ]);
    const blanks = Array.from({ length: blankRows }, () => Array(headers.length).fill(""));
    const totalsRow = ["TOTAL GENERAL", "", ...products.flatMap(p => [visibleRows.reduce((s, r) => s + (r[p.reference] || 0), 0), "", ""]), visibleRows.reduce((s, r) => s + r.total, 0), ...Array(5).fill("")];
    const ws = XLSX.utils.aoa_to_sheet([[`PLANILLA PENDIENTES — ${today}`], [], headers, ...data, ...blanks, [], totalsRow]);
    ws["!cols"] = [{ wch: 20 }, { wch: 12 }, ...products.flatMap(() => [{ wch: 4 }, { wch: 3 }, { wch: 3 }]), { wch: 7 }, ...Array(2).fill({ wch: 5 }), ...Array(2).fill({ wch: 15 }), { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pendientes");
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`;
      link.download = `planilla_pendientes_${today.replace(/\//g, "-")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      XLSX.writeFile(wb, `planilla_pendientes_${today.replace(/\//g, "-")}.xlsx`);
    }
  };

  const buildPlanillaHtml = () => `
    <!DOCTYPE html><html><head><meta charset="utf-8"/><title>Planilla Pendientes</title>
    <style>
      @page { size: letter landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 8px; margin: 0; padding: 0; }
      h2 { text-align: center; font-size: 11px; margin: 0 0 6px 0; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #94a3b8; padding: 2px 3px; font-size: 7px; }
      .bg-dark { background: #1e293b; color: white; } .bg-darker { background: #0f172a; color: white; }
      .bg-mid { background: #334155; color: white; } .bg-orange { background: #7c2d12; color: white; }
      .bg-orange2 { background: #9a3412; color: #fed7aa; } .bg-amber { background: #78350f; color: #fef3c7; }
      .bg-yellow { background: #713f12; color: #fef9c3; } .bg-green { background: #14532d; color: white; }
      .bg-orange-light { background: #fff7ed; } .bg-amber-light { background: #fffbeb; }
      .bg-yellow-light { background: #fefce8; } .bg-green-light { background: #f0fdf4; }
      .bg-gray { background: #f1f5f9; } .text-orange { color: #c2410c; font-weight: bold; }
      .text-dim { color: #cbd5e1; } .border-l-thick { border-left: 3px solid #1e293b !important; }
      .bold { font-weight: bold; } .center { text-align: center; } .sub { font-size: 6px; color: #94a3b8; }
    </style></head><body>
    <h2>PLANILLA PENDIENTES — ${today}</h2>
    <table><thead>
      <tr class="bg-dark">
        <th rowspan="2" style="text-align:left;width:110px"><div>NOMBRE</div><div class="sub">TELÉFONO</div></th>
        ${products.map(p => `<th colspan="3" class="bg-orange border-l-thick center">${p.name}</th>`).join("")}
        <th rowspan="2" class="bg-darker center" style="width:${totalCellW}px">TOTAL</th>
        <th colspan="4" class="bg-mid center">DESPACHO</th>
        <th rowspan="2" class="bg-green center" style="width:${columnWidths.obs}px">OBSERVACIONES</th>
      </tr>
      <tr class="bg-mid">
        ${products.map(() => `
          <th class="bg-orange2 center border-l-thick" style="width:${columnWidths.sist}px">S</th>
          <th class="bg-amber center" style="width:${columnWidths.entrego}px">E</th>
          <th class="bg-yellow center" style="width:${columnWidths.queda}px">Q</th>
        `).join("")}
        <th class="bg-mid center" style="width:${columnWidths.cant}px">CANT.</th>
        <th class="bg-mid center" style="width:${columnWidths.ref}px">REF.</th>
        <th class="bg-mid center" style="width:${columnWidths.cant}px">CANT.</th>
        <th class="bg-mid center" style="width:${columnWidths.ref}px">REF.</th>
      </tr>
    </thead><tbody>
      ${[...visibleRows, ...Array.from({ length: blankRows }, () => null)].map((row, i) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
          <td style="width:110px">${row ? `<div class="bold">${row.employeeName}</div><div class="sub">${row.phone || "—"}</div>` : ""}</td>
          ${products.map(p => {
            const val = row ? (row[p.reference] || 0) : 0;
            return `
              <td class="bg-orange-light center border-l-thick" style="width:${columnWidths.sist}px">
                ${row ? (val > 0 ? `<span class="text-orange">${val}</span>` : `<span class="text-dim">—</span>`) : ""}
              </td>
              <td class="bg-amber-light" style="width:${columnWidths.entrego}px"></td>
              <td class="bg-yellow-light" style="width:${columnWidths.queda}px"></td>
            `;
          }).join("")}
          <td class="bg-gray center bold" style="width:${totalCellW}px;border:2px solid #1e293b">${row ? row.total : ""}</td>
          <td style="width:${columnWidths.cant}px"></td><td style="width:${columnWidths.ref}px"></td>
          <td style="width:${columnWidths.cant}px"></td><td style="width:${columnWidths.ref}px"></td>
          <td class="bg-green-light" style="width:${columnWidths.obs}px"></td>
        </tr>
      `).join("")}
    </tbody><tfoot>
      <tr class="bg-dark bold">
        <td style="color:white;padding:3px 4px">TOTAL GENERAL</td>
        ${products.map(p => {
          const total = visibleRows.reduce((s, r) => s + (r[p.reference] || 0), 0);
          return `
            <td class="bg-orange center border-l-thick" style="color:white">${total}</td>
            <td class="bg-amber"></td><td class="bg-yellow"></td>
          `;
        }).join("")}
        <td class="bg-darker center" style="color:white;border:2px solid #475569">${visibleRows.reduce((s, r) => s + r.total, 0)}</td>
        <td class="bg-mid"></td><td class="bg-mid"></td><td class="bg-mid"></td><td class="bg-mid"></td>
        <td class="bg-green"></td>
      </tr>
    </tfoot></table></body></html>
  `;

  const exportJPG = async () => {
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;background:white;padding:16px;font-family:Arial,sans-serif;font-size:8px;width:1200px;";
    document.body.appendChild(container);
    const rowsHtml = visibleRows.map((row, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
        <td style="border:1px solid #cbd5e1;padding:3px 4px;width:130px">
          <div style="font-weight:bold;font-size:8px">${row.employeeName}</div>
          <div style="font-size:6px;color:#94a3b8">${row.phone || "—"}</div>
        </td>
        ${products.map(p => {
          const val = row[p.reference] || 0;
          return `
            <td style="border-left:3px solid #cbd5e1;border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;background:#fff7ed;text-align:center;width:${columnWidths.sist}px">
              ${val > 0 ? `<span style="color:#c2410c;font-weight:bold">${val}</span>` : `<span style="color:#cbd5e1">—</span>`}
            </td>
            <td style="border:1px solid #e2e8f0;background:#fffbeb;width:${columnWidths.entrego}px"></td>
            <td style="border:1px solid #e2e8f0;background:#fefce8;width:${columnWidths.queda}px"></td>
          `;
        }).join("")}
        <td style="border:2px solid #1e293b;background:#f1f5f9;text-align:center;font-weight:bold;width:${totalCellW}px">${row.total}</td>
        <td style="border:1px solid #e2e8f0;width:${columnWidths.cant}px"></td>
        <td style="border:1px solid #e2e8f0;width:${columnWidths.ref}px"></td>
        <td style="border:1px solid #e2e8f0;width:${columnWidths.cant}px"></td>
        <td style="border:1px solid #e2e8f0;width:${columnWidths.ref}px"></td>
        <td style="border:1px solid #e2e8f0;background:#f0fdf4;width:${columnWidths.obs}px"></td>
      </tr>
    `).join("");
    container.innerHTML = `
      <div style="text-align:center;font-weight:bold;font-size:12px;margin-bottom:8px;text-transform:uppercase">Planilla Pendientes — ${today}</div>
      <table style="border-collapse:collapse;font-size:8px">
        <thead>
          <tr style="background:#1e293b;color:white">
            <th style="border:1px solid #475569;padding:3px 4px;width:130px;text-align:left">NOMBRE / TELÉFONO</th>
            ${products.map(p => `<th colspan="3" style="background:#7c2d12;color:white;border-left:3px solid #1e293b;border:1px solid #475569;padding:2px;text-align:center;font-size:7px">${p.name}</th>`).join("")}
            <th style="background:#0f172a;color:white;border:2px solid #475569;width:${totalCellW}px;text-align:center">TOTAL</th>
            <th colspan="4" style="background:#334155;color:white;border:1px solid #475569;text-align:center">DESPACHO</th>
            <th style="background:#14532d;color:white;border:1px solid #475569;width:${columnWidths.obs}px;text-align:center">OBS</th>
          </tr>
          <tr style="background:#334155;color:white;text-align:center">
            ${products.map(() => `
              <th style="background:#9a3412;color:#fed7aa;border-left:3px solid #1e293b;border:1px solid #475569;width:${columnWidths.sist}px">S</th>
              <th style="background:#78350f;color:#fef3c7;border:1px solid #475569;width:${columnWidths.entrego}px">E</th>
              <th style="background:#713f12;color:#fef9c3;border:1px solid #475569;width:${columnWidths.queda}px">Q</th>
            `).join("")}
            <th style="border:2px solid #475569;width:${totalCellW}px"></th>
            <th style="border:1px solid #475569;width:${columnWidths.cant}px;font-size:6px">CANT</th>
            <th style="border:1px solid #475569;width:${columnWidths.ref}px;font-size:6px">REF</th>
            <th style="border:1px solid #475569;width:${columnWidths.cant}px;font-size:6px">CANT</th>
            <th style="border:1px solid #475569;width:${columnWidths.ref}px;font-size:6px">REF</th>
            <th style="border:1px solid #475569;width:${columnWidths.obs}px"></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#1e293b;color:white;font-weight:bold">
            <td style="border:1px solid #475569;padding:3px 4px">TOTAL GENERAL</td>
            ${products.map(p => {
              const total = visibleRows.reduce((s, r) => s + (r[p.reference] || 0), 0);
              return `
                <td style="background:#7c2d12;color:white;border-left:3px solid #475569;border:1px solid #475569;text-align:center">${total}</td>
                <td style="background:#78350f;border:1px solid #475569"></td>
                <td style="background:#713f12;border:1px solid #475569"></td>
              `;
            }).join("")}
            <td style="background:#0f172a;color:white;border:2px solid #475569;text-align:center">${visibleRows.reduce((s, r) => s + r.total, 0)}</td>
            <td style="background:#334155;border:1px solid #475569"></td><td style="background:#334155;border:1px solid #475569"></td>
            <td style="background:#334155;border:1px solid #475569"></td><td style="background:#334155;border:1px solid #475569"></td>
            <td style="background:#14532d;border:1px solid #475569"></td>
          </tr>
        </tfoot>
      </table>
    `;
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
    document.body.removeChild(container);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`<html><body style="margin:0;background:#111;text-align:center"><img src="${dataUrl}" style="max-width:100%;display:block"/><p style="color:white;font-family:sans-serif;padding:12px;font-size:14px">📥 Mantén presionada la imagen para guardarla</p></body></html>`);
        win.document.close();
      } else {
        const link = document.createElement("a");
        link.download = `planilla_pendientes_${today.replace(/\//g, "-")}.jpg`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } else {
      const link = document.createElement("a");
      link.download = `planilla_pendientes_${today.replace(/\//g, "-")}.jpg`;
      link.href = dataUrl;
      link.click();
    }
  };

  const exportPDF = () => {
    const html = buildPlanillaHtml();
    const win = window.open("", "_blank");
    if (!win) { alert("El navegador bloqueó la nueva pestaña. Por favor permite ventanas emergentes para este sitio."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) { setTimeout(() => win.print(), 800); }
    else { setTimeout(() => { win.print(); win.close(); }, 500); }
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-slate-600">Calculando pendientes...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-full mx-auto">

        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-900">Planilla de Pendientes</h1>
          <p className="text-slate-500 text-xs mt-0.5">Fecha: {today} · {visibleRows.length} empleado(s) · Viernes activo: {activeFriday ? new Date(activeFriday).toLocaleDateString("es-CO") : "—"}</p>

          {/* Desktop buttons */}
          <div className="hidden sm:flex gap-1.5 flex-wrap mt-2">
            <Button onClick={loadData} variant="outline" size="sm" className="h-8 px-2">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button onClick={handleSaveOrder} variant="outline" size="sm" className={`h-8 px-2.5 text-xs ${orderSaved ? "text-green-700 border-green-400 bg-green-50" : "text-blue-700 border-blue-300"}`}>
              <Save className="w-3.5 h-3.5 mr-1" />{orderSaved ? "✓ Guardado" : "Guardar orden"}
            </Button>
            <Button onClick={exportExcel} variant="outline" size="sm" className="h-8 px-2.5 text-xs text-green-700 border-green-300">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />Excel
            </Button>
            <Button onClick={exportPDF} variant="outline" size="sm" className="h-8 px-2.5 text-xs text-red-700 border-red-300">
              <FileText className="w-3.5 h-3.5 mr-1" />PDF
            </Button>
            <Button onClick={exportJPG} variant="outline" size="sm" className="h-8 px-2.5 text-xs text-purple-700 border-purple-300">
              <Image className="w-3.5 h-3.5 mr-1" />JPG
            </Button>
            <Button onClick={handleCloseFriday} variant="outline" size="sm" className="h-8 px-2.5 text-xs text-orange-700 border-orange-300 ml-2">
              🔒 Cerrar Viernes
            </Button>
          </div>

          {/* Mobile buttons */}
          <div className="flex sm:hidden flex-col gap-2 mt-3 w-full">
            <Button onClick={loadData} variant="outline" className="w-full justify-start gap-3 h-12 text-sm">
              <RefreshCw className="w-4 h-4" /> Actualizar datos
            </Button>
            <Button onClick={handleSaveOrder} variant="outline" className={`w-full justify-start gap-3 h-12 text-sm ${orderSaved ? "text-green-700 border-green-400 bg-green-50" : "text-blue-700 border-blue-300"}`}>
              <Save className="w-4 h-4" /> {orderSaved ? "✓ Orden guardado" : "Guardar orden de ruta"}
            </Button>
            <Button onClick={exportExcel} variant="outline" className="w-full justify-start gap-3 h-12 text-sm text-green-700 border-green-300 bg-green-50">
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </Button>
            <Button onClick={exportPDF} variant="outline" className="w-full justify-start gap-3 h-12 text-sm text-red-700 border-red-300 bg-red-50">
              <FileText className="w-4 h-4" /> Exportar PDF (nueva pestaña)
            </Button>
            <Button onClick={exportJPG} variant="outline" className="w-full justify-start gap-3 h-12 text-sm text-purple-700 border-purple-300 bg-purple-50">
              <Image className="w-4 h-4" /> Exportar JPG (nueva pestaña)
            </Button>
          </div>
        </div>

        {/* Checklist de Ruta */}
        <RouteChecklist
          employees={Object.values(rowsMap)}
          dispatches={[]}
          deliveries={[]}
          routeRows={visibleRows}
        />

        {/* Desktop controls */}
        <div className="hidden sm:flex flex-wrap gap-2 mb-4 items-center">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
            <span className="text-xs text-slate-600">Filas en blanco:</span>
            <button onClick={() => setBlankRows(b => Math.max(0, b - 1))} className="w-6 h-6 rounded border border-slate-300 flex items-center justify-center hover:bg-slate-100">
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-bold text-slate-800 w-5 text-center text-xs">{blankRows}</span>
            <button onClick={() => setBlankRows(b => b + 1)} className="w-6 h-6 rounded border border-slate-300 flex items-center justify-center hover:bg-slate-100">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <details className="flex-1 min-w-[160px] bg-white border border-slate-200 rounded-lg shadow-sm">
            <summary className="px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
              Anchos de columnas (px)
            </summary>
            <div className="px-4 pb-3 pt-1 grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { key: "sist", label: "S" }, { key: "entrego", label: "E" }, { key: "queda", label: "Q" },
                { key: "cant", label: "CANT." }, { key: "ref", label: "REF." }, { key: "obs", label: "OBS." },
              ].map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">{label}</label>
                  <input type="number" min="10" max="300" value={columnWidths[key]}
                    onChange={(e) => updateWidth(key, e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-mono" />
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* Mobile view */}
        <div className="sm:hidden mt-2">
          <PendingMobileView 
            visibleRows={visibleRows} 
            products={products} 
            activeFriday={activeFriday}
          />
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block">
          {visibleRows.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-white rounded-xl border border-slate-200 shadow">
              <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">¡Todo al día!</p>
              <p>No hay material pendiente de entrega.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-x-auto" ref={tableRef}>
              <div className="p-4" ref={printAreaRef}>
                <div className="text-center mb-4 font-bold text-slate-800 text-lg border-b pb-3 uppercase tracking-wide">
                  Planilla Pendientes — {today}
                </div>
                <table className="text-xs border-collapse" style={{ tableLayout: "auto", width: "max-content" }}>
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="border border-slate-600 no-print" rowSpan={2} style={{ width: 32 }}></th>
                      <th className="border border-slate-600 px-2 py-2 text-left align-middle" rowSpan={2} style={{ width: nameCellW, minWidth: nameCellW, maxWidth: nameCellW }}>
                        <div className="font-bold text-xs whitespace-nowrap">NOMBRE</div>
                        <div className="font-normal text-slate-400 text-xs whitespace-nowrap">TELÉFONO</div>
                      </th>
                      <th className="border border-slate-600 text-center align-middle" rowSpan={2} style={{ width: 60, minWidth: 60 }}>
                        <div className="font-bold text-xs whitespace-nowrap">PROM./SEM.</div>
                        <div className="font-normal text-slate-400 text-xs whitespace-nowrap">(unidades)</div>
                      </th>
                      <th className="border border-slate-600 text-center align-middle" rowSpan={2} style={{ width: 52, minWidth: 52 }}>
                        <div className="font-bold text-xs whitespace-nowrap">% REND.</div>
                      </th>
                      {products.map(p => (
                        <th key={p.reference} colSpan={3} className="bg-orange-900 text-center text-white"
                          style={{ width: columnWidths.sist + columnWidths.entrego + columnWidths.queda, borderLeft: "4px solid #1e293b", borderTop: "1px solid #475569", borderRight: "1px solid #475569", borderBottom: "1px solid #475569", fontSize: "9px", fontWeight: "bold", padding: "4px 2px", whiteSpace: "normal", wordBreak: "break-word", lineHeight: "1.2", maxWidth: columnWidths.sist + columnWidths.entrego + columnWidths.queda }}>
                          {p.name}
                        </th>
                      ))}
                      <th className="bg-slate-900 text-center align-middle text-white" rowSpan={2}
                        style={{ width: totalCellW, border: "2px solid #475569", fontSize: "9px", fontWeight: "bold", padding: "4px 2px", whiteSpace: "normal", wordBreak: "break-word", lineHeight: "1.2" }}>
                        TOTAL
                      </th>
                      <th className="bg-slate-700 text-center" colSpan={4}
                        style={{ width: (columnWidths.cant + columnWidths.ref) * 2, border: "1px solid #475569" }}>
                        DESPACHO
                      </th>
                      <th className="bg-green-900 text-center align-middle text-white" rowSpan={2}
                        style={{ width: columnWidths.obs, minWidth: columnWidths.obs, border: "1px solid #475569", fontSize: "9px", fontWeight: "bold", padding: "4px 2px", whiteSpace: "nowrap", lineHeight: "1.2" }}>
                        OBSERVACIONES
                      </th>
                      <th className="border border-slate-600 no-print" rowSpan={2} style={{ width: 80 }}></th>
                    </tr>
                    <tr className="bg-slate-700 text-white text-center">
                      {products.map(p => (
                        <React.Fragment key={p.reference}>
                          <th className="py-1 bg-orange-800 text-orange-200" style={{ width: columnWidths.sist, borderLeft: "4px solid #1e293b", borderTop: "1px solid #475569", borderRight: "1px solid #475569", borderBottom: "1px solid #475569" }}>S</th>
                          <th className="py-1 bg-amber-900 text-amber-200" style={{ width: columnWidths.entrego, border: "1px solid #475569" }}>E</th>
                          <th className="py-1 bg-yellow-900 text-yellow-200" style={{ width: columnWidths.queda, border: "1px solid #475569" }}>Q</th>
                        </React.Fragment>
                      ))}
                      {[1, 2].map(n => (
                        <React.Fragment key={n}>
                          <th className="py-1 bg-slate-700 text-xs" style={{ width: columnWidths.cant, border: "1px solid #475569" }}>CANT.</th>
                          <th className="py-1 bg-slate-600 text-xs" style={{ width: columnWidths.ref, border: "1px solid #475569" }}>REF.</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, i) => (
                      <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="border border-slate-200 no-print px-1 py-1 text-center" style={{ width: 32 }}>
                          <div className="flex flex-col items-center gap-0.5">
                            <button onClick={() => moveRow(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-blue-600 disabled:opacity-20">
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => moveRow(i, 1)} disabled={i === visibleRows.length - 1} className="text-slate-400 hover:text-blue-600 disabled:opacity-20">
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="border border-slate-200 px-2 py-1" style={{ width: nameCellW, minWidth: nameCellW, maxWidth: nameCellW }}>
                          <div className="font-semibold text-slate-900 text-xs leading-tight">{row.employeeName}</div>
                          <div className="text-slate-400 text-xs leading-tight">{row.phone || "—"}</div>
                        </td>
                        <td className="border border-slate-200 text-center bg-blue-50 text-xs font-semibold text-blue-800" style={{ width: 60 }}>
                          {row.weeklyAverage || "—"}
                        </td>
                        <td className="border border-slate-200 text-center text-xs font-bold" style={{ width: 52,
                          color: row.performancePct === null ? '#94a3b8' : row.performancePct >= 85 ? '#15803d' : row.performancePct >= 65 ? '#b45309' : '#dc2626',
                          background: row.performancePct === null ? '#f8fafc' : row.performancePct >= 85 ? '#f0fdf4' : row.performancePct >= 65 ? '#fffbeb' : '#fef2f2'
                        }}>
                          {row.performancePct !== null ? `${row.performancePct}%` : '—'}
                        </td>
                        {products.map(p => (
                          <React.Fragment key={p.reference}>
                            <td className="text-center bg-orange-50" style={{ width: columnWidths.sist, borderLeft: "4px solid #cbd5e1", borderTop: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                              {row[p.reference] > 0
                                ? <span className="font-bold text-orange-700 text-xs">{row[p.reference]}</span>
                                : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                            <td className="border border-slate-200 bg-amber-50" style={{ width: columnWidths.entrego }}></td>
                            <td className="border border-slate-200 bg-yellow-50" style={{ width: columnWidths.queda }}></td>
                          </React.Fragment>
                        ))}
                        <td className="text-center font-bold text-slate-900 bg-slate-100 text-xs" style={{ width: totalCellW, border: "2px solid #1e293b" }}>{row.total}</td>
                        <td className="border border-slate-200" style={{ width: columnWidths.cant }}></td>
                        <td className="border border-slate-200" style={{ width: columnWidths.ref }}></td>
                        <td className="border border-slate-200" style={{ width: columnWidths.cant }}></td>
                        <td className="border border-slate-200" style={{ width: columnWidths.ref }}></td>
                        <td className="border border-slate-200 bg-green-50 text-xs text-slate-700" style={{ width: columnWidths.obs, minWidth: columnWidths.obs, maxHeight: "60px", overflow: "hidden", wordBreak: "break-word" }}>
                          {row.observations ? <span className="line-clamp-2">{row.observations}</span> : ""}
                        </td>
                        <td className="border border-slate-200 no-print px-1 text-center" style={{ width: 80 }}>
                          <div className="flex items-center gap-0.5 justify-center">
                            <button onClick={() => openDispatchModal(row)} className="text-blue-500 hover:text-blue-700 p-1" title="Despachar">
                              <Truck className="w-4 h-4" />
                            </button>
                            <button onClick={() => openDeliveryModal(row)} className="text-green-600 hover:text-green-800 p-1" title="Registrar entrega">
                              <PackageCheck className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600 p-1" title="Ocultar fila">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {Array.from({ length: blankRows }).map((_, i) => (
                      <tr key={"blank-" + i} style={{ height: 32 }} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="border border-slate-200 no-print" style={{ width: 32 }}></td>
                        <td className="border border-slate-200" style={{ width: nameCellW }}></td>
                        <td className="border border-slate-200 bg-blue-50" style={{ width: 60 }}></td>
                        <td className="border border-slate-200" style={{ width: 52 }}></td>
                        {products.map(p => (
                          <React.Fragment key={p.reference}>
                            <td className="bg-orange-50" style={{ width: columnWidths.sist, borderLeft: "4px solid #cbd5e1", borderTop: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}></td>
                            <td className="border border-slate-200 bg-amber-50" style={{ width: columnWidths.entrego }}></td>
                            <td className="border border-slate-200 bg-yellow-50" style={{ width: columnWidths.queda }}></td>
                          </React.Fragment>
                        ))}
                        <td className="border border-slate-200 bg-slate-50" style={{ width: totalCellW }}></td>
                        {[1, 2].map(n => (
                          <React.Fragment key={n}>
                            <td className="border border-slate-200" style={{ width: columnWidths.cant }}></td>
                            <td className="border border-slate-200" style={{ width: columnWidths.ref }}></td>
                          </React.Fragment>
                        ))}
                        <td className="border border-slate-200 bg-green-50" style={{ width: columnWidths.obs }}></td>
                        <td className="border border-slate-200 no-print" style={{ width: 80 }}></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-white font-bold">
                      <td className="border border-slate-600 no-print" style={{ width: 32 }}></td>
                      <td className="border border-slate-600 px-3 py-2 text-xs" style={{ width: nameCellW }}>TOTAL GENERAL</td>
                      <td className="border border-slate-600 bg-blue-900 text-center text-xs" style={{ width: 60 }}>
                        {Math.round((visibleRows.reduce((s, r) => s + (r.weeklyAverage || 0), 0) / visibleRows.length) * 10) / 10 || "—"}
                      </td>
                      <td className="border border-slate-600 bg-slate-700 text-center text-xs" style={{ width: 52 }}></td>
                      {products.map(p => (
                        <React.Fragment key={p.reference}>
                          <td className="text-center bg-orange-900 text-xs" style={{ width: columnWidths.sist, borderLeft: "4px solid #475569", borderTop: "1px solid #475569", borderRight: "1px solid #475569", borderBottom: "1px solid #475569" }}>
                            {visibleRows.reduce((s, r) => s + (r[p.reference] || 0), 0)}
                          </td>
                          <td className="border border-slate-600 bg-amber-900" style={{ width: columnWidths.entrego }}></td>
                          <td className="border border-slate-600 bg-yellow-900" style={{ width: columnWidths.queda }}></td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-600 text-center bg-slate-900 text-xs" style={{ width: totalCellW }}>
                        {visibleRows.reduce((s, r) => s + r.total, 0)}
                      </td>
                      {[1, 2].map(n => (
                        <React.Fragment key={n}>
                          <td className="border border-slate-600 bg-slate-700" style={{ width: columnWidths.cant }}></td>
                          <td className="border border-slate-600 bg-slate-700" style={{ width: columnWidths.ref }}></td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-600 bg-green-900" style={{ width: columnWidths.obs }}></td>
                      <td className="border border-slate-600 no-print" style={{ width: 80 }}></td>
                    </tr>
                  </tfoot>
                </table>
                {removedIds.size > 0 && (
                  <div className="mt-3 text-xs text-slate-400 text-right no-print">
                    {removedIds.size} fila(s) oculta(s) ·{" "}
                    <button onClick={() => setRemovedIds(new Set())} className="text-blue-500 underline hover:text-blue-700">
                      Restaurar todo
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="hidden sm:block text-xs text-slate-400 mt-3 no-print">
          💡 Usa las flechas ↑↓ para definir el orden de ruta. 🚚 = despachar · 📦 = registrar entrega.
        </p>
      </div>

      {/* Modal de entrega rápida */}
      {deliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={closeDeliveryModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <PackageCheck className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-bold text-slate-900">Registrar Entrega</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">{deliveryModal.employeeName}</p>

            {deliverySuccess ? (
              <div className="flex flex-col items-center py-8 gap-3 text-green-700">
                <CheckCircle2 className="w-12 h-12" />
                <p className="font-semibold text-lg">¡Entrega registrada!</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {deliveryItems.map((item, i) => {
                    const product = allProducts.find(p => p.reference === item.product_reference);
                    const pending = deliveryModal.row[item.product_reference] || 0;
                    const qty = Number(item.quantity);
                    const overPending = item.product_reference && qty > pending;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex gap-2 items-center">
                          <select
                            value={item.product_reference}
                            onChange={e => handleDeliveryItemChange(i, "product_reference", e.target.value)}
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                          >
                            <option value="">— Producto —</option>
                            {allProducts.map(p => {
                              const pend = deliveryModal.row[p.reference] || 0;
                              return (
                                <option key={p.reference} value={p.reference}>
                                  {p.name} (pendiente: {pend})
                                </option>
                              );
                            })}
                          </select>
                          <input
                            type="number" min="1" placeholder="Cant."
                            value={item.quantity}
                            onChange={e => handleDeliveryItemChange(i, "quantity", e.target.value)}
                            className={`w-20 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 ${overPending ? "border-orange-400 focus:ring-orange-400 bg-orange-50" : "border-slate-300 focus:ring-green-400"}`}
                          />
                          {deliveryItems.length > 1 && (
                            <button onClick={() => removeDeliveryItem(i)} className="text-red-400 hover:text-red-600">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {item.product_reference && (
                          <div className={`text-xs px-1 ${overPending ? "text-orange-600 font-semibold" : "text-slate-400"}`}>
                            {overPending
                              ? `⚠️ Pendiente: ${pending} — estás registrando ${qty - pending} más de lo despachado`
                              : `Pendiente despachado: ${pending}${product ? ` · $${(product.manufacturing_price * qty).toLocaleString("es-CO")}` : ""}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={addDeliveryItem} className="text-xs text-green-600 hover:underline mb-4 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Agregar otro producto
                </button>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={closeDeliveryModal}>Cancelar</Button>
                  <Button
                    onClick={handleDeliverySave}
                    disabled={deliverySaving || deliveryItems.every(i => !i.product_reference || !i.quantity)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {deliverySaving ? "Guardando..." : "Confirmar entrega"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de despacho rápido */}
      {dispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={closeDispatchModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">Despachar</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">{dispatchModal.employeeName}</p>

            {dispatchSuccess ? (
              <div className="flex flex-col items-center py-8 gap-3 text-green-700">
                <CheckCircle2 className="w-12 h-12" />
                <p className="font-semibold text-lg">¡Despachado correctamente!</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {dispatchItems.map((item, i) => {
                    const invRecord = inventory.find(inv => inv.product_reference === item.product_reference);
                    const stock = invRecord ? invRecord.current_stock : null;
                    const qty = Number(item.quantity);
                    const overStock = stock !== null && qty > stock;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex gap-2 items-center">
                          <select
                            value={item.product_reference}
                            onChange={e => handleDispatchItemChange(i, "product_reference", e.target.value)}
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="">— Producto —</option>
                            {allProducts.map(p => {
                              const inv = inventory.find(inv => inv.product_reference === p.reference);
                              const s = inv ? inv.current_stock : 0;
                              return (
                                <option key={p.reference} value={p.reference}>
                                  {p.name} (stock: {s})
                                </option>
                              );
                            })}
                          </select>
                          <input
                            type="number" min="1" placeholder="Cant."
                            value={item.quantity}
                            onChange={e => handleDispatchItemChange(i, "quantity", e.target.value)}
                            className={`w-20 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 ${overStock ? "border-orange-400 focus:ring-orange-400 bg-orange-50" : "border-slate-300 focus:ring-blue-400"}`}
                          />
                          {dispatchItems.length > 1 && (
                            <button onClick={() => removeDispatchItem(i)} className="text-red-400 hover:text-red-600">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {item.product_reference && stock !== null && (
                          <div className={`text-xs px-1 ${overStock ? "text-orange-600 font-semibold" : "text-slate-400"}`}>
                            {overStock
                              ? `⚠️ Stock disponible: ${stock} — estás despachando ${qty - stock} más de lo disponible`
                              : `✓ Stock disponible: ${stock}`}
                          </div>
                        )}
                        {item.product_reference && stock === null && (
                          <div className="text-xs text-slate-400 px-1">Sin registro de inventario para este producto</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={addDispatchItem} className="text-xs text-blue-600 hover:underline mb-4 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Agregar otro producto
                </button>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={closeDispatchModal}>Cancelar</Button>
                  <Button
                    onClick={handleDispatchSave}
                    disabled={dispatchSaving || dispatchItems.every(i => !i.product_reference || !i.quantity)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {dispatchSaving ? "Guardando..." : "Confirmar despacho"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}