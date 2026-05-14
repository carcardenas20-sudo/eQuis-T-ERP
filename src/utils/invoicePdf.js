import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function generatePrintableHTML(sale, enrichedItems, companyInfo, paymentMethodLabels, printFormat = '58mm') {
  const isThermal = printFormat === '58mm' || printFormat === '80mm';
  const fecha = new Date(sale.created_date || sale.sale_date || Date.now()).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  const labels = paymentMethodLabels || { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR', credit: 'Crédito', courtesy: 'Cortesía' };

  if (isThermal) {
    const fs = printFormat === '58mm' ? '7pt' : '9pt';
    const fsH = printFormat === '58mm' ? '9pt' : '11pt';
    const pad = printFormat === '58mm' ? '2mm' : '3mm';
    const sep = `<div style="border-top:1px dashed #000;margin:3pt 0;"></div>`;

    const itemsHTML = (enrichedItems || []).map(item => `
      <div style="margin-bottom:3px;">
        <div style="font-weight:bold;">${item.product?.name || item.product_id}</div>
        <div style="display:flex;justify-content:space-between;">
          <span>${item.quantity} × $${(item.unit_price || 0).toLocaleString()}</span>
          <span style="font-weight:bold;">$${(item.line_total || 0).toLocaleString()}</span>
        </div>
      </div>`).join('');

    const paymentsHTML = (sale.payment_methods || []).map(p => `
      <div style="display:flex;justify-content:space-between;">
        <span>${labels[p.method] || p.method}</span>
        <span>$${(p.amount || 0).toLocaleString()}</span>
      </div>`).join('');

    return `
      <div style="width:100%;font-family:'Courier New',Courier,monospace;font-size:${fs};padding:${pad};box-sizing:border-box;">
        <div style="text-align:center;margin-bottom:4px;">
          <div style="font-size:${fsH};font-weight:bold;">${companyInfo.name || 'eQuis-T'}</div>
          ${companyInfo.receiptHeader ? `<div style="font-style:italic;">${companyInfo.receiptHeader}</div>` : ''}
          <div>${companyInfo.address || ''}</div>
          <div>NIT: ${companyInfo.document || ''}</div>
          <div>Tel: ${companyInfo.phone || ''}</div>
        </div>
        ${sep}
        <div style="margin-bottom:3px;">
          <div><b>Fact. #${sale.invoice_number || (sale.id || '').slice(-8)}</b></div>
          <div>${fecha}</div>
          <div>Cliente: ${sale.customer_name || 'General'}</div>
          ${sale.customer_document ? `<div>Doc: ${sale.customer_document}</div>` : ''}
        </div>
        ${sep}
        ${itemsHTML}
        ${sep}
        ${sale.discount_amount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Descuento</span><span>-$${(sale.discount_amount || 0).toLocaleString()}</span></div>` : ''}
        ${sale.tax_amount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Impuestos</span><span>$${(sale.tax_amount || 0).toLocaleString()}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:${fsH};font-weight:bold;margin-top:2px;">
          <span>TOTAL</span>
          <span>$${(sale.total_amount || 0).toLocaleString()}</span>
        </div>
        ${sep}
        ${paymentsHTML}
        ${sep}
        <div style="text-align:center;margin-top:6px;">${companyInfo.receiptFooter || '¡Gracias por su compra!'}</div>
      </div>`;
  }

  // ─── Formato A4 / media carta ─────────────────────────────────────────────
  const itemsHTML = (enrichedItems || []).map(item => `
    <tr>
      <td>${item.product?.name || item.product_id}<br><small style="color:#888;">SKU: ${item.product_id}</small></td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:right;">$${(item.unit_price || 0).toLocaleString()}</td>
      <td style="text-align:right;">$${(item.line_total || 0).toLocaleString()}</td>
    </tr>`).join('');

  const paymentsHTML = (sale.payment_methods || []).map(p => `
    <tr>
      <td style="padding:5px 8px;border:0;">${labels[p.method] || p.method}:</td>
      <td style="padding:5px 8px;border:0;text-align:right;">$${(p.amount || 0).toLocaleString()}</td>
    </tr>`).join('') || `<tr><td colspan="2" style="padding:5px 8px;border:0;text-align:center;color:#777;">Sin pagos</td></tr>`;

  return `
    <div style="max-width:800px;margin:auto;padding:30px;font-size:16px;font-family:Arial,sans-serif;">
      <div style="text-align:center;margin-bottom:20px;">
        <h1 style="margin:0;font-size:24px;">${companyInfo.name || 'eQuis-T'}</h1>
        ${companyInfo.receiptHeader ? `<p style="margin:4px 0;font-style:italic;color:#666;">${companyInfo.receiptHeader}</p>` : ''}
        <p style="margin:2px 0;">${companyInfo.address || ''}</p>
        <p style="margin:2px 0;">NIT: ${companyInfo.document || ''} · Tel: ${companyInfo.phone || ''}</p>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:14px;">
        <div>
          <strong>Cliente:</strong>
          <p style="margin:2px 0;">${sale.customer_name || 'General'}</p>
          ${sale.customer_document ? `<p style="margin:2px 0;">${sale.customer_document}</p>` : ''}
        </div>
        <div style="text-align:right;">
          <p style="margin:2px 0;"><strong>Factura #:</strong> ${sale.invoice_number || (sale.id || '').slice(-8)}</p>
          <p style="margin:2px 0;"><strong>Fecha:</strong> ${fecha}</p>
          <p style="margin:2px 0;"><strong>Estado:</strong> ${sale.status || 'completada'}</p>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="background:#f8f8f8;">
            <th style="padding:8px;border-bottom:1px solid #eee;">Producto</th>
            <th style="padding:8px;border-bottom:1px solid #eee;text-align:center;">Cant.</th>
            <th style="padding:8px;border-bottom:1px solid #eee;text-align:right;">Precio Unit.</th>
            <th style="padding:8px;border-bottom:1px solid #eee;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
      </table>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin-top:20px;">
        <div style="min-width:45%;">
          <h4 style="margin-bottom:8px;">Métodos de Pago</h4>
          <table style="width:100%;"><tbody>${paymentsHTML}</tbody></table>
        </div>
        <div style="min-width:40%;">
          <table style="width:100%;"><tbody>
            <tr><td style="padding:5px 8px;border:0;">Subtotal:</td><td style="padding:5px 8px;border:0;text-align:right;">$${(sale.subtotal || 0).toLocaleString()}</td></tr>
            ${sale.discount_amount > 0 ? `<tr><td style="padding:5px 8px;border:0;">Descuento:</td><td style="padding:5px 8px;border:0;text-align:right;">-$${(sale.discount_amount || 0).toLocaleString()}</td></tr>` : ''}
            ${sale.tax_amount > 0 ? `<tr><td style="padding:5px 8px;border:0;">Impuestos:</td><td style="padding:5px 8px;border:0;text-align:right;">$${(sale.tax_amount || 0).toLocaleString()}</td></tr>` : ''}
            <tr style="font-weight:bold;border-top:2px solid #333;"><td style="padding:5px 8px;">Total:</td><td style="padding:5px 8px;text-align:right;">$${(sale.total_amount || 0).toLocaleString()}</td></tr>
          </tbody></table>
        </div>
      </div>
      <div style="margin-top:30px;text-align:center;font-size:12px;color:#777;">
        <p>${companyInfo.receiptFooter || '¡Gracias por su compra!'}</p>
      </div>
    </div>`;
}

export async function buildInvoicePdfBlob(sale, enrichedItems, companyInfo, printFormat = '80mm') {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  const widthMM = printFormat === '58mm' ? 58 : (printFormat === '80mm' ? 80 : (printFormat === 'half-letter' ? 140 : 216));
  container.style.width = `${widthMM}mm`;
  container.style.background = '#ffffff';

  const paymentMethodLabels = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    qr: 'QR',
    credit: 'Crédito',
    courtesy: 'Cortesía'
  };

  container.innerHTML = `<div class="print-container">${generatePrintableHTML(sale, enrichedItems, companyInfo, paymentMethodLabels, printFormat)}</div>`;
  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 0));
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');

    const pageWidth = widthMM;
    const pageHeight = (canvas.height * pageWidth) / canvas.width;

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [pageWidth, pageHeight] });
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    const blob = pdf.output('blob');
    return blob;
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}