import React, { useState } from "react";
import { Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * PaymentVoucher
 * Props:
 *   payment    – objeto Payment
 *   deliveries – lista completa de Delivery del sistema
 *   products   – lista completa de Product del sistema
 *   employeeName – string con el nombre del empleado
 */
export default function PaymentVoucher({ payment, deliveries, products, employeeName }) {
  const [generating, setGenerating] = useState(false);

  // ─── Resolver las entregas cubiertas por este pago ───────────────────
  const getCoveredDeliveries = () => {
    if (payment.delivery_payments && payment.delivery_payments.length > 0) {
      return deliveries.filter(d =>
        payment.delivery_payments.some(dp => dp.delivery_id === d.id)
      );
    }
    if (payment.delivery_ids && payment.delivery_ids.length > 0) {
      return deliveries.filter(d => payment.delivery_ids.includes(d.id));
    }
    return [];
  };

  // ─── Filas por fecha de entrega ──────────────────────────────────────
  const buildRowsByDate = (coveredDeliveries) => {
    // Ordenar entregas por fecha
    const sorted = [...coveredDeliveries].sort((a, b) =>
      new Date(a.delivery_date) - new Date(b.delivery_date)
    );
    const rows = [];
    sorted.forEach(delivery => {
      const items = delivery.items && delivery.items.length > 0
        ? delivery.items
        : delivery.product_reference
          ? [{ product_reference: delivery.product_reference, quantity: delivery.quantity, unit_price: delivery.unit_price, total_amount: delivery.total_amount }]
          : [];
      items.forEach(item => {
        const product = products.find(p => p.reference === item.product_reference);
        rows.push({
          date: delivery.delivery_date,
          name: product ? product.name : item.product_reference,
          reference: item.product_reference,
          quantity: item.quantity || 0,
          unit_price: item.unit_price || 0,
          total: item.total_amount || (item.quantity * item.unit_price) || 0,
        });
      });
    });
    return rows;
  };

  // ─── Totales por producto ─────────────────────────────────────────────
  const buildTotals = (rows) => {
    const map = {};
    rows.forEach(row => {
      if (!map[row.reference]) map[row.reference] = { name: row.name, quantity: 0, total: 0 };
      map[row.reference].quantity += row.quantity;
      map[row.reference].total += row.total;
    });
    return Object.values(map);
  };

  // ─── Generar JPG ─────────────────────────────────────────────────────
  const generateJPG = async () => {
    setGenerating(true);

    const coveredDeliveries = getCoveredDeliveries();
    const detailRows = buildRowsByDate(coveredDeliveries);
    const totals = buildTotals(detailRows);

    const fmtMoney = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;
    const fmtDate = (d) => {
      try { return format(new Date(d + "T12:00:00"), "d 'de' MMMM", { locale: es }); }
      catch { return d; }
    };
    const fmtDateFull = (d) => {
      try { return format(new Date(d + "T12:00:00"), "d 'de' MMMM 'de' yyyy", { locale: es }); }
      catch { return d; }
    };

    const detailRowsHtml = detailRows.length > 0
      ? detailRows.map((row, i) => `
          <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"}">
            <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;white-space:nowrap">${fmtDate(row.date)}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b">${row.name}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#1e293b;text-align:center">${row.quantity}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;text-align:right">${fmtMoney(row.unit_price)}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#1d4ed8;text-align:right">${fmtMoney(row.total)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="5" style="padding:16px;text-align:center;color:#94a3b8;font-size:13px">Sin detalle de entregas disponible</td></tr>`;

    const totalsRowsHtml = totals.map(t => `
      <tr style="background:#eff6ff">
        <td colspan="2" style="padding:9px 12px;border-bottom:1px solid #dbeafe;font-size:13px;font-weight:700;color:#1e3a8a">Total ${t.name}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #dbeafe;font-size:14px;font-weight:800;color:#1e3a8a;text-align:center">${t.quantity}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #dbeafe;font-size:12px;color:#475569;text-align:right"></td>
        <td style="padding:9px 12px;border-bottom:1px solid #dbeafe;font-size:14px;font-weight:800;color:#1d4ed8;text-align:right">${fmtMoney(t.total)}</td>
      </tr>
    `).join("");

    const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12)">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:28px 32px;color:white">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.8;margin-bottom:4px">Comprobante de Pago</div>
              <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px">Producción eQuis-T</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;opacity:0.75;margin-bottom:2px">N° comprobante</div>
              <div style="font-size:13px;font-weight:700;font-family:monospace;background:rgba(255,255,255,0.15);padding:4px 10px;border-radius:6px">${payment.id.slice(-8).toUpperCase()}</div>
            </div>
          </div>
        </div>

        <!-- Empleado + Fecha -->
        <div style="padding:20px 32px;background:#f1f5f9;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0">
          <div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Beneficiario</div>
            <div style="font-size:18px;font-weight:700;color:#0f172a">${employeeName}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Fecha de pago</div>
            <div style="font-size:14px;font-weight:600;color:#1e293b">${fmtDateFull(payment.payment_date)}</div>
            <div style="margin-top:4px">
              <span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">
                ${payment.status === 'ejecutado' ? '✓ TRANSFERENCIA EJECUTADA' : '⏳ PENDIENTE DE TRANSFERENCIA'}
              </span>
            </div>
          </div>
        </div>

        <!-- Tabla de entregas por fecha -->
        <div style="padding:24px 32px">
          <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Detalle de entregas cubiertas</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#1e3a8a;color:white">
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap">Fecha</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Producto</th>
                <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Cant.</th>
                <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Vlr. Unit.</th>
                <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Total</th>
              </tr>
            </thead>
            <tbody>
              ${detailRowsHtml}
              ${totals.length > 0 ? totalsRowsHtml : ""}
            </tbody>
          </table>
        </div>

        <!-- Total -->
        <div style="margin:0 32px 24px;background:linear-gradient(135deg,#1e3a8a,#2563eb);border-radius:12px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center">
          <div style="color:rgba(255,255,255,0.85);font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px">TOTAL PAGADO</div>
          <div style="color:white;font-size:28px;font-weight:800;letter-spacing:-1px">${fmtMoney(payment.amount)}</div>
        </div>

        <!-- Medio de pago -->
        <div style="margin:0 32px 28px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Medio de pago</div>
            <div style="font-size:14px;font-weight:700;color:#1e293b">🏦 Transferencia</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f1f5f9;padding:14px 32px;border-top:1px solid #e2e8f0;text-align:center">
          <p style="margin:0;font-size:11px;color:#94a3b8">Comprobante generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })} · Producción eQuis-T</p>
        </div>
      </div>
    `;

    // Renderizar en DOM oculto y capturar
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;padding:20px;background:#e2e8f0;";
    container.innerHTML = html;
    document.body.appendChild(container);

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#e2e8f0",
      useCORS: true,
      logging: false,
    });
    document.body.removeChild(container);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`
          <html><body style="margin:0;background:#111;text-align:center">
            <img src="${dataUrl}" style="max-width:100%;display:block"/>
            <p style="color:white;font-family:sans-serif;padding:12px;font-size:14px">
              📥 Mantén presionada la imagen para guardarla o compartir por WhatsApp
            </p>
          </body></html>
        `);
        win.document.close();
      }
    } else {
      const link = document.createElement("a");
      link.download = `comprobante_${employeeName.replace(/\s+/g, "_")}_${payment.id.slice(-8)}.jpg`;
      link.href = dataUrl;
      link.click();
    }

    setGenerating(false);
  };

  return (
    <Button
      onClick={generateJPG}
      disabled={generating}
      variant="outline"
      size="sm"
      className="w-full text-blue-700 border-blue-300 hover:bg-blue-50 gap-1.5"
    >
      <Image className="w-4 h-4" />
      {generating ? "Generando..." : "Comprobante JPG"}
    </Button>
  );
}