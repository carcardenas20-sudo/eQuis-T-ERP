import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const { event, data, payload_too_large } = await req.json();

    let payment = data;
    if (!payment || payload_too_large) {
      const paymentId = event?.entity_id;
      if (!paymentId) {
        return Response.json({ error: 'Missing payment id' }, { status: 400 });
      }
      payment = await base44.asServiceRole.entities.PayablePayment.get(paymentId);
    }

    if (!payment?.payable_id) {
      return Response.json({ error: 'Payment missing payable_id' }, { status: 400 });
    }

    const payable = await base44.asServiceRole.entities.AccountPayable.get(payment.payable_id);
    if (!payable) {
      return Response.json({ error: 'Related payable not found' }, { status: 404 });
    }

    // If this payable didn't come from the external app, skip notifying
    const externalRef = payable.external_reference;
    if (!externalRef) {
      return Response.json({ status: 'skipped', reason: 'No external_reference on payable' });
    }

    const targetUrl = Deno.env.get('OPERARIOS_APP_SYNC_PAGOS_URL');
    if (!targetUrl) {
      return Response.json({ error: 'Missing OPERARIOS_APP_SYNC_PAGOS_URL' }, { status: 500 });
    }

    const outBody = {
      type: 'payment_executed',
      source_app: 'finanzas',
      event,
      payment
    };

    const bodyText = JSON.stringify(outBody);
    const secret = Deno.env.get('WORKER_SYNC_SECRET');
    if (!secret) {
      return Response.json({ error: 'Missing WORKER_SYNC_SECRET' }, { status: 500 });
    }

    const signature = await hmacSha256Hex(secret, bodyText);

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature
      },
      body: bodyText
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('notifyPaymentExecution error:', res.status, txt);
      return Response.json({ error: 'Upstream error', status: res.status, details: txt?.slice(0, 500) }, { status: 502 });
    }

    return Response.json({ status: 'ok' });
  } catch (error) {
    console.error('notifyPaymentExecution exception:', error);
    return Response.json({ error: error?.message || 'Internal Error' }, { status: 500 });
  }
});