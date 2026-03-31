import { base44 } from "@/api/base44Client";

function normalizePhone(input) {
  const digits = String(input || '').replace(/\D+/g, '');
  return digits;
}

export async function sendImageWhatsApp({ imageBlob, defaultPhone = '', message = 'Comparto el detalle' }) {
  // Prepare window for mobile popup blockers (optional best-effort)
  let waWindow = null;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile && !/Edg/i.test(navigator.userAgent)) {
    try { waWindow = window.open('about:blank', '_blank'); } catch (_) { waWindow = null; }
  }

  // Ask phone number
  const phoneInput = window.prompt("Número de WhatsApp (con indicativo si aplica):", defaultPhone);
  if (!phoneInput) return; // cancelled
  const phone = normalizePhone(phoneInput);
  if (!phone) { alert('Número inválido'); return; }
  const dialPhone = phone.length === 10 ? '57' + phone : phone;

  // Wrap blob into File for upload
  const file = new File([imageBlob], `traslados_${Date.now()}.jpg`, { type: 'image/jpeg' });

  // Upload privately and get a signed URL (1h)
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 60 * 60 });

  const fullMessage = `${message}\n\nDescarga la imagen: ${signed_url}`;

  // Open WhatsApp links fallback chain
  const deepLink = `whatsapp://send?phone=${dialPhone}&text=${encodeURIComponent(fullMessage)}`;
  const webLink = `https://api.whatsapp.com/send?phone=${dialPhone}&text=${encodeURIComponent(fullMessage)}`;
  const waMeLink = `https://wa.me/${dialPhone}?text=${encodeURIComponent(fullMessage)}`;

  const openWhatsApp = (target) => {
    try { target.location.href = deepLink; } catch (_) {}
    setTimeout(() => { try { target.location.href = webLink; } catch (_) {} }, 800);
    setTimeout(() => { try { target.location.href = waMeLink; } catch (_) {} }, 1400);
  };

  if (waWindow && !waWindow.closed) {
    openWhatsApp(waWindow);
    try { waWindow.focus(); } catch (_) {}
  } else {
    openWhatsApp(window);
  }
}