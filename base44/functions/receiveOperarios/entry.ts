import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getHeaderSignature(req) {
  let sig = req.headers.get('x-sync-signature')
    || req.headers.get('x-finance-signature')
    || req.headers.get('x-hub-signature-256')
    || req.headers.get('x-signature');
  if (!sig) return null;
  const idx = sig.indexOf('=');
  if (idx > -1) sig = sig.slice(idx + 1);
  return sig.trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const rawBody = await req.text();
    const providedSig = getHeaderSignature(req);
    const secret = Deno.env.get('WORKER_SYNC_SECRET');
    if (!secret) {
      return Response.json({ error: 'Missing WORKER_SYNC_SECRET' }, { status: 500 });
    }

    const expected = await hmacHex(secret, rawBody);
    if (!providedSig || providedSig !== expected) {
      console.error('receiveOperarios: invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (e) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const eventType = payload?.event_type || payload?.type || 'unknown';
    const source = payload?.source_app || 'operarios';
    console.info('receiveOperarios: accepted', { source, eventType });

    // Store in an inbox for later processing without affecting existing flows
    const record = await base44.asServiceRole.entities.SyncInbox.create({
      source,
      event_type: eventType,
      payload,
      received_at: new Date().toISOString(),
      processed: false,
    });

    return Response.json({ ok: true, stored_id: record.id });
  } catch (error) {
    console.error('receiveOperarios error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});