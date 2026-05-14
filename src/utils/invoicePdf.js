import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function generatePrintableHTML(sale, enrichedItems, companyInfo, paymentMethodLabels, printFormat = '58mm') {
  const isThermal = printFormat === '58mm' || printFormat === '80mm';
  const fecha = new Date(sale.created_date || sale.sale_date || Date.now()).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  const labels = paymentMethodLabels || { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR', credit: 'Crédito', courtesy: 'Cortesía' };

  if (isThermal) {
    const is58 = printFormat === '58mm';
    const fs      = is58 ? '9pt'  : '10pt';
    const fsSm    = is58 ? '8pt'  : '9pt';
    const fsLg    = is58 ? '12pt' : '14pt';
    const fsMed   = is58 ? '9.5pt': '11pt';
    const pad     = is58 ? '3mm'  : '4mm';
    const lh      = '1.5';
    const rowPad  = is58 ? '2pt 0' : '3pt 0';

    const sepSolid  = `<tr><td colspan="2" style="padding:3pt 0 2pt;"><div style="border-top:1.5px solid #000;"></div></td></tr>`;
    const sepDashed = `<tr><td colspan="2" style="padding:2pt 0 1pt;"><div style="border-top:1px dashed #555;"></div></td></tr>`;

    const row = (left, right, bold = false, size = fs) =>
      `<tr>
        <td style="padding:${rowPad};font-size:${size};font-weight:${bold ? 'bold' : 'normal'};vertical-align:top;">${left}</td>
        <td style="padding:${rowPad};font-size:${size};font-weight:${bold ? 'bold' : 'normal'};text-align:right;white-space:nowrap;vertical-align:top;">${right}</td>
      </tr>`;

    const itemsRows = (enrichedItems || []).map(item => `
      <tr>
        <td colspan="2" style="padding:3pt 0 0;font-size:${fsMed};font-weight:bold;">${item.product?.name || item.product_id}</td>
      </tr>
      <tr>
        <td style="padding:0 0 4pt;font-size:${fs};">${item.quantity} × $${(item.unit_price || 0).toLocaleString()}</td>
        <td style="padding:0 0 4pt;font-size:${fs};font-weight:bold;text-align:right;">$${(item.line_total || 0).toLocaleString()}</td>
      </tr>`).join('');

    const paymentRows = (sale.payment_methods || []).map(p =>
      row(labels[p.method] || p.method, `$${(p.amount || 0).toLocaleString()}`)
    ).join('');

    const totalsRows = [
      sale.discount_amount > 0 ? row('Descuento:', `-$${(sale.discount_amount || 0).toLocaleString()}`) : '',
      sale.tax_amount > 0 ? row('Impuestos:', `$${(sale.tax_amount || 0).toLocaleString()}`) : '',
    ].join('');

    return `
      <div style="width:100%;font-family:Arial,Helvetica,sans-serif;font-size:${fs};line-height:${lh};padding:${pad};box-sizing:border-box;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td colspan="2" style="text-align:center;padding-bottom:4pt;">
            <div style="font-size:${fsLg};font-weight:900;letter-spacing:0.5pt;">${companyInfo.name || 'eQuis-T'}</div>
            ${companyInfo.receiptHeader ? `<div style="font-size:${fsSm};font-style:italic;margin-top:1pt;">${companyInfo.receiptHeader}</div>` : ''}
            <div style="font-size:${fsSm};margin-top:2pt;">${companyInfo.address || ''}</div>
            <div style="font-size:${fsSm};">NIT: ${companyInfo.document || ''}</div>
            <div style="font-size:${fsSm};">Tel: ${companyInfo.phone || ''}</div>
          </td></tr>
          ${sepSolid}
          ${row('<b>Factura #' + (sale.invoice_number || (sale.id || '').slice(-8)) + '</b>', fecha, false, fsSm)}
          <tr><td colspan="2" style="padding:${rowPad};font-size:${fs};">
            Cliente: <b>${sale.customer_name || 'General'}</b>
            ${sale.customer_document ? `<br><span style="font-size:${fsSm};">Doc: ${sale.customer_document}</span>` : ''}
          </td></tr>
          ${sepDashed}
          ${itemsRows}
          ${sepSolid}
          ${totalsRows}
          <tr>
            <td style="padding:2pt 0;font-size:${fsLg};font-weight:900;border-top:1px solid #000;">TOTAL</td>
            <td style="padding:2pt 0;font-size:${fsLg};font-weight:900;text-align:right;border-top:1px solid #000;">$${(sale.total_amount || 0).toLocaleString()}</td>
          </tr>
          ${sepDashed}
          ${paymentRows}
          ${sepSolid}
          <tr><td colspan="2" style="text-align:center;padding-top:5pt;font-size:${fs};">
            ${companyInfo.receiptFooter || '¡Gracias por su compra!'}
          </td></tr>
        </table>
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