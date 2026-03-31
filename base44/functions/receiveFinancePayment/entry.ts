import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Compute HMAC-SHA256 (hex) using Web Crypto
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
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getHeaderSignature(req) {
  // Accept a few common header names
  const headers = req.headers;
  let sig = headers.get('x-sync-signature')
    || headers.get('x-finance-signature')
    || headers.get('x-hub-signature-256')
    || headers.get('x-signature');
  if (!sig) return null;
  // Normalize: allow formats like "sha256=..."
  const idx = sig.indexOf('=');
  if (idx > -1) sig = sig.slice(idx + 1);
  return sig.trim();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    const secret = Deno.env.get('WORKER_SYNC_SECRET');
    if (!secret) {
      return new Response(JSON.stringify({ error: 'Missing WORKER_SYNC_SECRET' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Read raw body first for signature verification
    const rawBody = await req.text();
    const provided = getHeaderSignature(req);
    if (!provided) {
      return new Response(JSON.stringify({ error: 'Missing signature header' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const computed = await hmacSha256Hex(secret, rawBody);
    if (computed !== provided) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Parse JSON after verifying signature
    let payload;
    try {
      payload = JSON.parse(rawBody || '{}');
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const base44 = createClientFromRequest(req);

    // Persist to inbox for async processing
    const eventType = payload?.event_type || 'payment_update';
    const record = await base44.asServiceRole.entities.SyncInbox.create({
      source: 'finance',
      event_type: eventType,
      payload,
      received_at: new Date().toISOString(),
      processed: false,
    });

    return new Response(JSON.stringify({ ok: true, inbox_id: record.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('receiveFinancePayment error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});