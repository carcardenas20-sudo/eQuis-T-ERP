function normalizePhone(input) {
  return String(input || '').replace(/\D+/g, '');
}

function buildWhatsAppText(sale, items, companyInfo) {
  const fecha = new Date(sale.created_date || sale.sale_date || Date.now())
    .toLocaleDateString('es-CO', { dateStyle: 'short' });
  const labels = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR', credit: 'Crédito', courtesy: 'Cortesía' };

  const lines = [
    `Hola! Te comparto tu factura:`,
    ``,
    `*${companyInfo.name || 'Factura'}*  |  #${sale.invoice_number || (sale.id || '').slice(-8)}`,
    `Fecha: ${fecha}`,
  ];

  if (items && items.length > 0) {
    lines.push(``);
    lines.push(`*Productos:*`);
    for (const item of items) {
      const name = item.product?.name || item.product_id || 'Producto';
      lines.push(`• ${name} × ${item.quantity} = $${(item.line_total || 0).toLocaleString()}`);
    }
  }

  lines.push(``);
  if (sale.discount_amount > 0) {
    lines.push(`Descuento: -$${(sale.discount_amount || 0).toLocaleString()}`);
  }
  lines.push(`*Total: $${(sale.total_amount || 0).toLocaleString()}*`);

  if (sale.payment_methods && sale.payment_methods.length > 0) {
    for (const p of sale.payment_methods) {
      lines.push(`${labels[p.method] || p.method}: $${(p.amount || 0).toLocaleString()}`);
    }
  }

  if (companyInfo.receiptFooter) {
    lines.push(``);
    lines.push(companyInfo.receiptFooter);
  }

  return lines.join('\n');
}

// Función sincrónica — NO usar async/await antes de llamarla para mantener el gesto del usuario
export function sendInvoiceWhatsApp({ sale, items = [], companyInfo = {}, defaultPhone = '' }) {
  const defaultNumber = defaultPhone || (sale?.customer_phone || '');
  const message = buildWhatsAppText(sale, items, companyInfo);

  // Intenta native share (hoja de compartir del sistema — funciona sin abrir ventanas)
  if (navigator.share) {
    navigator.share({
      title: `Factura ${sale.invoice_number || ''}`,
      text: message
    }).catch(() => {});
    return;
  }

  // Fallback: preguntar número y abrir WhatsApp
  const phoneInput = window.prompt('Número de WhatsApp (con indicativo si aplica):', defaultNumber);
  if (!phoneInput) return;
  const phone = normalizePhone(phoneInput);
  if (!phone) { alert('Número inválido'); return; }
  const dialPhone = phone.length === 10 ? '57' + phone : phone;
  const waMeLink = `https://wa.me/${dialPhone}?text=${encodeURIComponent(message)}`;
  window.open(waMeLink, '_blank');
}
