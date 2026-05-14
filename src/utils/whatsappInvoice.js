import { base44 } from "@/api/base44Client";
import { buildInvoicePdfBlob } from "@/utils/invoicePdf";

function normalizePhone(input) {
  const digits = String(input || '').replace(/\D+/g, '');
  return digits; // let the user include country code if desired
}

export async function sendInvoiceWhatsApp({ sale, items = [], companyInfo = {}, printFormat = '80mm', defaultPhone = '' }) {
  try {
    const defaultNumber = defaultPhone || (sale?.customer_phone || '');

    // Open a blank tab immediately on mobile to avoid popup blockers
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let waWindow = null;
    if (isMobile && !/Edg/i.test(navigator.userAgent)) {
      try {
        waWindow = window.open('about:blank', '_blank');
        if (waWindow) {
          try {
            waWindow.document.open();
            waWindow.document.write('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preparando factura…</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:20px;text-align:center;color:#334} .spinner{width:32px;height:32px;border:3px solid #ddd;border-top-color:#09f;border-radius:50%;margin:16px auto;animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="spinner"></div><p>Preparando tu factura…</p><p>No cierres esta ventana.</p></body></html>');
            waWindow.document.close();
          } catch (_) {}
        }
      } catch (_) { waWindow = null; }
    }

    // Build PDF
    const pdfBlob = await buildInvoicePdfBlob(sale, items, companyInfo, printFormat);
    const fileName = `Factura_${sale.invoice_number || (sale.id ? sale.id.slice(-8) : 'venta')}.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Try native share with the PDF file (mobile)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      if (waWindow && !waWindow.closed) { try { waWindow.close(); } catch (_) {} }
      try {
        await navigator.share({
          files: [file],
          title: `Factura ${sale.invoice_number || ''}`,
          text: `Factura por $${(sale.total_amount || 0).toLocaleString()}`
        });
        return;
      } catch (e) {
        // User cancelled or target unavailable; continue with WhatsApp link fallback
      }
    }

    // Ask phone only for WhatsApp fallback
    const phoneInput = window.prompt("Número de WhatsApp (con indicativo si aplica):", defaultNumber);
    if (!phoneInput) return; // cancelled
    const phone = normalizePhone(phoneInput);
    if (!phone) {
      alert('Número inválido');
      return;
    }
    const dialPhone = phone.length === 10 ? '57' + phone : phone;

    // Upload privately and get a signed link
    const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 60 * 60 }); // 1h

    // Compose WhatsApp message
    const message = `Hola! Te comparto tu factura ${sale.invoice_number || ''} por $${(sale.total_amount || 0).toLocaleString()}\n\nDescárgala aquí: ${signed_url}`;
    const deepLink = `whatsapp://send?phone=${dialPhone}&text=${encodeURIComponent(message)}`;
    const webLink = `https://api.whatsapp.com/send?phone=${dialPhone}&text=${encodeURIComponent(message)}`;
    const waMeLink = `https://wa.me/${dialPhone}?text=${encodeURIComponent(message)}`;
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isEdge = /Edg/i.test(ua);

    const openWhatsApp = (target) => {
      const intentLink = isAndroid ? `intent://send/?text=${encodeURIComponent(message)}#Intent;scheme=whatsapp;package=com.whatsapp;end` : null;

      if (isAndroid && isEdge && intentLink) {
        try { target.location.href = intentLink; } catch (_) {}
        setTimeout(() => { try { target.location.href = deepLink; } catch (_) {} }, 500);
        setTimeout(() => { try { target.location.href = waMeLink; } catch (_) {} }, 1000);
        setTimeout(() => { try { target.location.href = webLink; } catch (_) {} }, 1500);
        return;
      }

      try { target.location.href = deepLink; } catch (_) {}
      setTimeout(() => { try { target.location.href = webLink; } catch (_) {} }, 800);
      setTimeout(() => { try { target.location.href = waMeLink; } catch (_) {} }, 1400);
    };

    if (waWindow && !waWindow.closed && !isEdge) {
      try {
        waWindow.document.open();
        waWindow.document.write('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Abriendo WhatsApp…</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:20px;text-align:center;color:#334} .spinner{width:32px;height:32px;border:3px solid #ddd;border-top-color:#09f;border-radius:50%;margin:16px auto;animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="spinner"></div><p>Preparando tu factura y abriendo WhatsApp…</p><p>No cierres esta ventana.</p></body></html>');
        waWindow.document.close();
      } catch (_) {}
      openWhatsApp(waWindow);
      try { waWindow.focus(); } catch (_) {}
    } else {
      // En Edge móvil y en general, usamos la ventana actual para evitar bloqueos
      if (waWindow && !waWindow.closed) { try { waWindow.close(); } catch (_) {} }
      // Mostrar overlay sin destruir el DOM de React
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff;font-family:system-ui,Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;';
      overlay.innerHTML = `<p style="font-size:16px;color:#333;margin-bottom:16px;">Abriendo WhatsApp…</p><p style="font-size:14px;color:#555;">Si no abre automáticamente:<br><a href="${waMeLink}" style="color:#25D366;font-weight:bold;">Toca aquí para abrir WhatsApp</a></p>`;
      document.body.appendChild(overlay);
      setTimeout(() => { try { overlay.remove(); } catch(_){} }, 5000);
      openWhatsApp(window);
    }
  } catch (err) {
    console.error('sendInvoiceWhatsApp error:', err);
    alert('No se pudo preparar el envío por WhatsApp.');
  }
}