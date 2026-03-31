import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function generatePrintableHTML(sale, enrichedItems, companyInfo, paymentMethodLabels, printFormat = '80mm') {
  const itemsHTML = (enrichedItems || []).map(item => `
      <tr>
        <td>
          ${item.product?.name || 'Producto desconocido'}
          <br><small>SKU: ${item.product_id}</small>
        </td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">$${(item.unit_price || 0).toLocaleString()}</td>
        <td style="text-align: right;">$${(item.line_total || 0).toLocaleString()}</td>
      </tr>
    `).join('');

  const paymentsHTML = (sale.payment_methods || []).map(p => `
      <tr>
        <td style="padding: 5px 8px; border: 0;">${(paymentMethodLabels && paymentMethodLabels[p.method]) || p.method}:</td>
        <td style="padding: 5px 8px; border: 0; text-align: right;">$${(p.amount || 0).toLocaleString()}</td>
      </tr>
    `).join('') || `
      <tr>
        <td colspan="2" style="padding: 5px 8px; border: 0; text-align: center; color: #777;">No se registraron pagos</td>
      </tr>
    `;

  const isThermal = printFormat === '58mm' || printFormat === '80mm';
  const containerMax = isThermal ? '100%' : '800px';
  const padding = isThermal ? '6mm' : '30px';
  const border = isThermal ? '0' : '1px solid #eee';
  const fontSize = isThermal ? '12px' : '16px';
  const headerSize = isThermal ? '16px' : '24px';

  return `
    <div style="max-width: ${containerMax}; margin: auto; padding: ${padding}; border: ${border}; font-size: ${fontSize}; font-family: Arial, sans-serif;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: ${headerSize}; color: #1f2937;">${companyInfo.name || 'JacketMaster POS'}</h1>
        ${companyInfo.receiptHeader ? `<p style="margin: 4px 0; font-size: 14px; font-style: italic; color: #666;">${companyInfo.receiptHeader}</p>` : ''}
        <div>
          <p style="margin: 2px 0; font-size: 14px;">${companyInfo.address || 'Dirección no configurada'}</p>
          <p style="margin: 2px 0; font-size: 14px;">NIT: ${companyInfo.document || 'NIT no configurado'}</p>
          <p style="margin: 2px 0; font-size: 14px;">Tel: ${companyInfo.phone || 'Teléfono no configurado'}</p>
          ${companyInfo.email ? `<p style=\"margin: 2px 0; font-size: 14px;\">Email: ${companyInfo.email}</p>` : ''}
        </div>
      </div>

      <!-- Invoice Details -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px;">
        <div>
          <strong>Facturar a:</strong>
          <p style="margin: 2px 0;">${sale.customer_name || 'Cliente General'}</p>
          <p style="margin: 2px 0;">${sale.customer_document || ''}</p>
          <p style="margin: 2px 0;">${sale.customer_phone || ''}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 2px 0;"><strong>Factura #:</strong> ${sale.invoice_number || (sale.id ? sale.id.slice(-8) : '')}</p>
          <p style="margin: 2px 0;"><strong>Fecha:</strong> ${new Date(sale.created_date || sale.sale_date || Date.now()).toLocaleString('es-CO')}</p>
          <p style="margin: 2px 0;"><strong>Estado:</strong> ${sale.status || 'completada'}</p>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f8f8f8;">
            <th style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Producto</th>
            <th style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; text-align: center;">Cant.</th>
            <th style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">Precio Unit.</th>
            <th style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <!-- Totals & Payments Section -->
      <div style="margin-top: 20px; display: flex; justify-content: space-between; flex-wrap: wrap;">
        <!-- Payment Methods -->
        <div style="width: 55%;">
          <h4 style="margin-bottom: 10px; font-size: 16px; font-weight: bold;">Métodos de Pago</h4>
          <table style="width: 100%;">
            <tbody>
              ${paymentsHTML}
            </tbody>
          </table>
        </div>

        <!-- Totals Section -->
        <div style="width: 40%;">
          <table style="width: 100%;">
            <tbody>
              <tr>
                <td style="padding: 5px 8px; border: 0;">Subtotal:</td>
                <td style="padding: 5px 8px; border: 0; text-align: right;">$${(sale.subtotal || 0).toLocaleString()}</td>
              </tr>
              ${sale.discount_amount > 0 ? `
                <tr>
                  <td style="padding: 5px 8px; border: 0;">Descuento:</td>
                  <td style="padding: 5px 8px; border: 0; text-align: right;">-$${(sale.discount_amount || 0).toLocaleString()}</td>
                </tr>
              ` : ''}
              <tr>
                <td style="padding: 5px 8px; border: 0;">Impuestos:</td>
                <td style="padding: 5px 8px; border: 0; text-align: right;">$${(sale.tax_amount || 0).toLocaleString()}</td>
              </tr>
              <tr style="font-weight: bold; font-size: 1.1em; border-top: 2px solid #333;">
                <td style="padding: 5px 8px;">Total:</td>
                <td style="padding: 5px 8px; text-align: right;">$${(sale.total_amount || 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="clear: both;"></div>

      <!-- Footer -->
      <div style="margin-top: 80px; text-align: center; font-size: 12px; color: #777;">
        <p>${companyInfo.receiptFooter || '¡Gracias por su compra!'}</p>
      </div>
    </div>
  `;
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