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

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) {
    res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return res === 0;
}

function getSignatureFromHeaders(headers) {
  const candidates = [
    'x-signature',
    'x-webhook-signature',
    'x-signature-256',
    'x-hub-signature-256',
    'x-operarios-signature',
  ];
  for (const key of candidates) {
    const v = headers.get(key) || headers.get(key.toUpperCase());
    if (v) {
      // Allow formats like: 'sha256=abcdef...'
      const parts = v.split('=');
      return parts.length === 2 ? parts[1] : v;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
    }
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
    }

    const secret = Deno.env.get('WORKER_SYNC_SECRET');
    if (!secret) {
      return Response.json({ error: 'Missing WORKER_SYNC_SECRET' }, { status: 500 });
    }

    const bodyText = await req.text();
    const incomingSig = getSignatureFromHeaders(req.headers);
    if (!incomingSig) {
      return Response.json({ error: 'Missing signature' }, { status: 401 });
    }
    const computed = await hmacSha256Hex(secret, bodyText);
    if (!timingSafeEqual(incomingSig, computed)) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(bodyText || '{}');
    const base44 = createClientFromRequest(req);

    // Normalize fields from external payload
    const event = payload.event || 'payable.created';
    const externalId = payload.id || payload.external_id || payload.external_reference;
    if (!externalId) {
      return Response.json({ error: 'Missing external reference id' }, { status: 400 });
    }

    const supplier_name = payload.supplier_name || payload.supplier || 'Proveedor';
    const supplier_id = payload.supplier_id || null;
    const description = payload.description || payload.concept || 'Cuenta por pagar';
    const category = payload.category || 'otros';
    const total_amount = Number(payload.total_amount ?? payload.amount ?? 0);
    if (!total_amount || Number.isNaN(total_amount)) {
      return Response.json({ error: 'Invalid total_amount' }, { status: 400 });
    }

    // Dates
    const now = new Date();
    let due_date = payload.due_date || payload.dueDate;
    if (!due_date) {
      const d = new Date(now);
      d.setDate(d.getDate() + 30);
      due_date = d.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    // Resolve location
    let location_id = payload.location_id || payload.locationId || null;
    if (!location_id && payload.location_code) {
      const locs = await base44.asServiceRole.entities.Location.filter({ code: payload.location_code });
      if (locs && locs.length > 0) location_id = locs[0].id;
    }
    if (!location_id) {
      const mainLoc = await base44.asServiceRole.entities.Location.filter({ is_main: true });
      if (mainLoc && mainLoc.length > 0) location_id = mainLoc[0].id;
      else {
        const anyLoc = await base44.asServiceRole.entities.Location.list();
        if (anyLoc && anyLoc.length > 0) location_id = anyLoc[0].id;
      }
    }
    if (!location_id) {
      return Response.json({ error: 'No se pudo resolver location_id' }, { status: 400 });
    }

    // Idempotency check
    const existing = await base44.asServiceRole.entities.AccountPayable.filter({ external_reference: externalId });
    if (existing && existing.length > 0) {
      return Response.json({ status: 'ok', id: existing[0].id, message: 'Already exists' });
    }

    const payableData = {
      supplier_id,
      supplier_name,
      type: payload.type || 'purchase',
      description,
      category,
      total_amount,
      paid_amount: 0,
      pending_amount: total_amount,
      due_date,
      invoice_number: payload.invoice_number || payload.invoice || '',
      status: 'pending',
      location_id,
      purchase_id: payload.purchase_id || null,
      external_reference: externalId,
      notes: payload.notes || ''
    };

    const created = await base44.asServiceRole.entities.AccountPayable.create(payableData);

    // Log inbox for traceability (optional but useful)
    try {
      await base44.asServiceRole.entities.SyncInbox.create({
        source: 'external_app',
        event_type: event,
        payload,
        received_at: new Date().toISOString(),
        processed: true,
        process_error: ''
      });
    } catch (_) { /* non-blocking */ }

    return Response.json({ status: 'ok', id: created.id });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.SyncInbox.create({
        source: 'external_app',
        event_type: 'payable.error',
        payload: { message: error?.message },
        received_at: new Date().toISOString(),
        processed: false,
        process_error: String(error?.message || error)
      });
    } catch (_) { /* ignore */ }
    return Response.json({ error: error?.message || 'Internal Error' }, { status: 500 });
  }
});