import jsPDF from 'jspdf';

function normalizePhone(input) {
  return String(input || '').replace(/\D+/g, '');
}

// Renderiza el recibo en un jsPDF ya creado. Retorna la Y final para medir altura.
function renderReceipt(pdf, sale, items, companyInfo, printFormat, startY) {
  const is58 = printFormat === '58mm';
  const pageW = is58 ? 58 : 80;
  const margin = 3;
  const lh = 4;
  let y = startY;

  const labels = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR', credit: 'Crédito', courtesy: 'Cortesía' };
  const fecha = new Date(sale.created_date || sale.sale_date || Date.now())
    .toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

  const font = (size, bold = false) => {
    pdf.setFontSize(size);
    pdf.setFont('Helvetica', bold ? 'bold' : 'normal');
  };

  const centerText = (str, size, bold = false) => {
    font(size, bold);
    pdf.text(String(str || ''), pageW / 2, y, { align: 'center' });
    y += lh;
  };

  const rowText = (left, right, size = 7, bold = false) => {
    font(size, bold);
    pdf.text(String(left || ''), margin, y);
    pdf.text(String(right || ''), pageW - margin, y, { align: 'right' });
    y += lh;
  };

  const solidLine = () => {
    pdf.setLineWidth(0.3); pdf.setLineDashPattern([], 0);
    pdf.line(margin, y, pageW - margin, y); y += 2;
  };

  const dashedLine = () => {
    pdf.setLineWidth(0.2); pdf.setLineDashPattern([1, 1], 0);
    pdf.line(margin, y, pageW - margin, y);
    pdf.setLineDashPattern([], 0); y += 2;
  };

  // Encabezado
  centerText(companyInfo.name || 'eQuis-T', is58 ? 11 : 13, true);
  if (companyInfo.receiptHeader) centerText(companyInfo.receiptHeader, 6.5);
  if (companyInfo.address) centerText(companyInfo.address, 6.5);
  centerText(`NIT: ${companyInfo.document || ''}  Tel: ${companyInfo.phone || ''}`, 6.5);
  y += 1;
  solidLine();

  rowText(`Factura #${sale.invoice_number || (sale.id || '').slice(-8)}`, fecha, 7);
  font(7, true);
  const clienteStr = `Cliente: ${sale.customer_name || 'General'}${sale.customer_document ? `  Doc: ${sale.customer_document}` : ''}`;
  const clienteLines = pdf.splitTextToSize(clienteStr, pageW - margin * 2);
  pdf.text(clienteLines, margin, y); y += lh * clienteLines.length;
  dashedLine();

  // Productos
  for (const item of (items || [])) {
    const name = item.product?.name || item.product_id || 'Producto';
    font(is58 ? 8 : 9, true);
    const nameLines = pdf.splitTextToSize(name, pageW - margin * 2);
    pdf.text(nameLines, margin, y); y += lh * nameLines.length;
    rowText(`${item.quantity} x $${(item.unit_price || 0).toLocaleString()}`, `$${(item.line_total || 0).toLocaleString()}`, 7);
  }

  solidLine();

  if ((sale.discount_amount || 0) > 0)
    rowText('Descuento:', `-$${(sale.discount_amount || 0).toLocaleString()}`, 7);
  if ((sale.tax_amount || 0) > 0)
    rowText('Impuestos:', `$${(sale.tax_amount || 0).toLocaleString()}`, 7);

  // Total
  font(is58 ? 12 : 14, true);
  pdf.text('TOTAL', margin, y);
  pdf.text(`$${(sale.total_amount || 0).toLocaleString()}`, pageW - margin, y, { align: 'right' });
  y += lh + 1;

  dashedLine();

  // Pagos
  for (const p of (sale.payment_methods || []))
    rowText(labels[p.method] || p.method, `$${(p.amount || 0).toLocaleString()}`, 7, true);

  solidLine();
  centerText(companyInfo.receiptFooter || '¡Gracias por su compra!', 7, true);
  y += 3;

  return y;
}

// Genera el blob del PDF usando jsPDF text API (sin html2canvas — instantáneo en móvil)
function buildReceiptPdfBlob(sale, items, companyInfo, printFormat = '80mm') {
  const is58 = printFormat === '58mm';
  const pageW = is58 ? 58 : 80;
  const margin = 3;

  // Primera pasada para medir la altura real
  const tmp = new jsPDF({ orientation: 'p', unit: 'mm', format: [pageW, 500] });
  const finalY = renderReceipt(tmp, sale, items, companyInfo, printFormat, margin);

  // Segunda pasada con la altura correcta
  const height = Math.ceil(finalY) + margin;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [pageW, height] });
  renderReceipt(pdf, sale, items, companyInfo, printFormat, margin);

  return pdf.output('blob');
}

// Función sincrónica — llamar directamente desde onClick sin await previo
export function sendInvoiceWhatsApp({ sale, items = [], companyInfo = {}, printFormat = '80mm', defaultPhone = '' }) {
  const defaultNumber = defaultPhone || (sale?.customer_phone || '');

  // Genera PDF con jsPDF (sin canvas — <50ms en móvil)
  const pdfBlob = buildReceiptPdfBlob(sale, items, companyInfo, printFormat);
  const fileName = `Factura_${sale.invoice_number || (sale.id ? sale.id.slice(-8) : 'venta')}.pdf`;
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

  // Intenta compartir el archivo PDF directamente (Android/iOS abren WhatsApp en la hoja de compartir)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({
      files: [file],
      title: `Factura ${sale.invoice_number || ''}`,
      text: `Factura por $${(sale.total_amount || 0).toLocaleString()}`
    }).catch(e => {
      if (e.name !== 'AbortError') sendWhatsAppLink(sale, items, companyInfo, defaultNumber);
    });
    return;
  }

  // Fallback: link wa.me con mensaje de texto
  sendWhatsAppLink(sale, items, companyInfo, defaultNumber);
}

function sendWhatsAppLink(sale, items, companyInfo, defaultNumber) {
  const labels = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR', credit: 'Crédito', courtesy: 'Cortesía' };
  const fecha = new Date(sale.created_date || sale.sale_date || Date.now()).toLocaleDateString('es-CO', { dateStyle: 'short' });

  const lines = [
    `Hola! Te comparto tu factura:`, ``,
    `*${companyInfo.name || 'Factura'}*  |  #${sale.invoice_number || (sale.id || '').slice(-8)}`,
    `Fecha: ${fecha}`, ``, `*Productos:*`,
    ...(items || []).map(item => {
      const name = item.product?.name || item.product_id || 'Producto';
      return `• ${name} × ${item.quantity} = $${(item.line_total || 0).toLocaleString()}`;
    }),
    ``,
    ...(sale.discount_amount > 0 ? [`Descuento: -$${(sale.discount_amount || 0).toLocaleString()}`] : []),
    `*Total: $${(sale.total_amount || 0).toLocaleString()}*`,
    ...(sale.payment_methods || []).map(p => `${labels[p.method] || p.method}: $${(p.amount || 0).toLocaleString()}`),
    ...(companyInfo.receiptFooter ? [``, companyInfo.receiptFooter] : []),
  ];

  const message = lines.join('\n');
  const phoneInput = window.prompt('Número de WhatsApp (con indicativo si aplica):', defaultNumber);
  if (!phoneInput) return;
  const phone = normalizePhone(phoneInput);
  if (!phone) { alert('Número inválido'); return; }
  const dialPhone = phone.length === 10 ? '57' + phone : phone;
  window.open(`https://wa.me/${dialPhone}?text=${encodeURIComponent(message)}`, '_blank');
}
