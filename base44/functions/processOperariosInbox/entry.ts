import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Helper to parse safe number
function toNumber(val, def = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
}

function toDateOnlyISO(input) {
  if (!input) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    return d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Entity automation payload format
    const body = await req.json().catch(() => ({}));

    // If invoked by entity automation on SyncInbox creation
    const isEntityAutomation = body?.event?.entity_name === 'SyncInbox' && body?.event?.type === 'create';

    let inboxRecord = null;

    if (isEntityAutomation) {
      // Prefer data directly when available
      inboxRecord = body?.data || null;
      if (!inboxRecord || body?.payload_too_large) {
        // Fallback: fetch full record
        const full = await base44.asServiceRole.entities.get('SyncInbox', body.event.entity_id);
        inboxRecord = full || null;
      }
    } else if (body?.record) {
      // Manual invocation support: { record: { ...SyncInbox } }
      inboxRecord = body.record;
    }

    if (!inboxRecord) {
      return Response.json({ success: false, message: 'No SyncInbox record provided' }, { status: 400 });
    }

    // Validate source/event
    const source = inboxRecord.source || '';
    const eventType = String(inboxRecord.event_type || '').toLowerCase();
    const payload = inboxRecord.payload || {};

    // Handle non-operarios sources
    if (source !== 'operarios') {
      // Finance: try auto-apply payments with exact match; leave unprocessed if no exact match
      if (source === 'finance') {
        const pay = payload.payment || payload;
        const amount = toNumber(pay.amount ?? payload.amount ?? 0, 0);
        const paidAt = pay.paid_at || pay.payment_date || payload.paid_at || new Date().toISOString();
        const reference = pay.reference || payload.reference || pay.payment_id || payload.payment_id || '';
        const invoiceNumber = pay.invoice_number || payload.invoice_number || null;
        const payableId = pay.payable_id || payload.payable_id || null;
        const locationCode = pay.location_code || payload.location_code || null;
        let locationId = pay.location_id || payload.location_id || null;

        const methodRaw = String(pay.method || payload.method || 'transfer').toLowerCase();
        const method = ['cash','efectivo'].includes(methodRaw) ? 'cash'
          : ['card','tarjeta'].includes(methodRaw) ? 'card'
          : ['transfer','transferencia','bank','nequi','daviplata'].includes(methodRaw) ? 'transfer'
          : ['qr'].includes(methodRaw) ? 'qr'
          : 'other';

        if (!amount || amount <= 0) {
          await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, { processed: false, process_error: 'Monto inválido en pago (finance)' });
          return Response.json({ success: false, message: 'Invalid amount' }, { status: 400 });
        }

        // Resolve AP by payable_id, external_reference, or invoice_number
        let target = null;
        if (payableId) {
          try { target = await base44.asServiceRole.entities.get('AccountPayable', payableId); } catch (_) {}
        }
        if (!target && (payload.external_reference || pay.external_reference)) {
          const ext = payload.external_reference || pay.external_reference;
          const list = await base44.asServiceRole.entities.AccountPayable.filter({ external_reference: ext });
          if (Array.isArray(list) && list.length === 1) target = list[0];
        }
        if (!target && invoiceNumber) {
          const list = await base44.asServiceRole.entities.AccountPayable.filter({ invoice_number: invoiceNumber });
          if (Array.isArray(list) && list.length === 1) target = list[0];
        }

        // Resolve location
        if (!locationId && locationCode) {
          const locs = await base44.asServiceRole.entities.Location.filter({ code: locationCode });
          if (Array.isArray(locs) && locs.length > 0) locationId = locs[0].id;
        }

        // Exact match rule: must have target and amount == pending_amount (tolerance < 1)
        if (target && Math.abs(toNumber(target.pending_amount, 0) - amount) < 1) {
          if (reference) {
            const dup = await base44.asServiceRole.entities.PayablePayment.filter({ payable_id: target.id, reference });
            const exists = Array.isArray(dup) && dup.some(p => toNumber(p.amount, 0) === amount);
            if (exists) {
              await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, { processed: true, process_error: null });
              return Response.json({ success: true, skipped: true, reason: 'duplicate_payment' });
            }
          }

          if (!locationId) locationId = target.location_id;

          const payment = await base44.asServiceRole.entities.PayablePayment.create({
            payable_id: target.id,
            payment_date: new Date(paidAt).toISOString(),
            amount,
            method,
            reference: reference || '',
            bank_account_id: null,
            location_id: locationId,
            notes: `Importado desde Finanzas • ref=${reference || 'n/a'}`
          });

          const newPaid = toNumber(target.paid_amount, 0) + amount;
          const total = toNumber(target.total_amount, 0);
          const newPending = Math.max(0, total - newPaid);
          const newStatus = newPending <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending');

          await base44.asServiceRole.entities.AccountPayable.update(target.id, {
            paid_amount: newPaid,
            pending_amount: newPending,
            status: newStatus
          });

          await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, { processed: true, process_error: null });
          return Response.json({ success: true, payable_payment_id: payment.id, account_payable_id: target.id });
        }

        // No exact match: leave unprocessed so it appears in Conciliación
        await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, { processed: false, process_error: null });
        return Response.json({ success: true, skipped: true, reason: 'no_exact_match' });
      }

      // Other sources: do nothing (stay unprocessed for manual handling)
      return Response.json({ success: true, skipped: true, reason: 'ignored_source' });
    }

    // Handle payments from Operarios (create PayablePayment) or salary events
    const isPaymentEvent = /(payment|pago)/.test(eventType) || /(payment|pago)/.test(String(payload?.type || ''));
    if (isPaymentEvent) {
      // Extract payment fields
      const amount = toNumber(payload.amount ?? payload.total ?? payload.paid_amount ?? 0, 0);
      const paidAt = payload.paid_at || payload.payment_date || payload.date || new Date().toISOString();
      const methodRaw = String(payload.method || payload.payment_method || 'transfer').toLowerCase();
      const method = ['cash','efectivo'].includes(methodRaw) ? 'cash'
        : ['card','tarjeta'].includes(methodRaw) ? 'card'
        : ['transfer','transferencia','bank','nequi','daviplata'].includes(methodRaw) ? 'transfer'
        : ['qr'].includes(methodRaw) ? 'qr'
        : 'other';
      const reference = payload.reference || payload.payment_reference || payload.payment_id || payload.id || '';
      const payableId = payload.payable_id || null;
      const externalReference = payload.external_reference || null;
      const invoiceNumber = payload.invoice_number || null;
      const locationCode = payload.location_code || payload.sucursal_code || null;
      let locationId = payload.location_id || null;

      if (!amount || amount <= 0) {
        await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, {
          processed: false,
          process_error: 'Monto inválido en pago (amount)'
        });
        return Response.json({ success: false, message: 'Invalid amount' }, { status: 400 });
      }

      // Resolve target AccountPayable
      let target = null;
      if (payableId) {
        try { target = await base44.asServiceRole.entities.get('AccountPayable', payableId); } catch (_) {}
      }
      if (!target && externalReference) {
        const list = await base44.asServiceRole.entities.AccountPayable.filter({ external_reference: externalReference });
        if (Array.isArray(list) && list.length > 0) target = list[0];
      }
      if (!target && invoiceNumber) {
        const list = await base44.asServiceRole.entities.AccountPayable.filter({ invoice_number: invoiceNumber });
        if (Array.isArray(list) && list.length > 0) target = list[0];
      }
      if (!target) {
        await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, {
          processed: false,
          process_error: 'No se encontró AccountPayable (use payable_id / external_reference / invoice_number)'
        });
        return Response.json({ success: false, message: 'AccountPayable not found' }, { status: 400 });
      }

      // Resolve location
      if (!locationId && locationCode) {
        const locs = await base44.asServiceRole.entities.Location.filter({ code: locationCode });
        if (Array.isArray(locs) && locs.length > 0) locationId = locs[0].id;
      }
      if (!locationId) locationId = target.location_id;

      // Idempotency: avoid duplicates by payable_id + reference + amount
      if (reference) {
        const dup = await base44.asServiceRole.entities.PayablePayment.filter({ payable_id: target.id, reference });
        const exists = Array.isArray(dup) && dup.some(p => toNumber(p.amount, 0) === amount);
        if (exists) {
          await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, { processed: true, process_error: null });
          return Response.json({ success: true, skipped: true, reason: 'duplicate_payment' });
        }
      }

      // Create payment
      const payment = await base44.asServiceRole.entities.PayablePayment.create({
        payable_id: target.id,
        payment_date: new Date(paidAt).toISOString(),
        amount: amount,
        method,
        reference: reference || '',
        bank_account_id: null,
        location_id: locationId,
        notes: `Importado desde Operarios • ext_ref=${externalReference || reference || 'n/a'}`,
      });

      // Update AccountPayable totals
      const newPaid = toNumber(target.paid_amount, 0) + amount;
      const total = toNumber(target.total_amount, 0);
      const newPending = Math.max(0, total - newPaid);
      const newStatus = newPending <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending');
      await base44.asServiceRole.entities.AccountPayable.update(target.id, {
        paid_amount: newPaid,
        pending_amount: newPending,
        status: newStatus,
      });

      // Mark processed
      await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, { processed: true, process_error: null });
      return Response.json({ success: true, payable_payment_id: payment.id, account_payable_id: target.id });
    }

    // Only handle salary/nomina pending events here
    const isSalaryEvent = /salary|nomina/.test(eventType);
    if (!isSalaryEvent) {
      await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, {
        processed: true,
        process_error: null,
      });
      return Response.json({ success: true, skipped: true, reason: 'non_salary_event' });
    }

    // Extract fields from flexible payload
    const workerId = payload.worker_id || payload.operario_id || payload.worker?.id || payload.id || null;
    const workerName = payload.worker_name || payload.operario_nombre || payload.worker?.name || 'Operario';
    const amount = toNumber(payload.amount ?? payload.total ?? payload.total_amount ?? 0, 0);
    const periodStart = payload.period_start || payload.period?.start || payload.week_start || null;
    const periodEnd = payload.period_end || payload.period?.end || payload.week_end || null;
    const locationIdRaw = payload.location_id || null;
    const locationCode = payload.location_code || payload.sucursal_code || null;

    if (!amount || amount <= 0) {
      await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, {
        processed: false,
        process_error: 'Monto inválido o ausente en payload',
      });
      return Response.json({ success: false, message: 'Invalid amount' }, { status: 400 });
    }

    // Resolve location id (required by AccountPayable)
    let locationId = locationIdRaw || null;
    if (!locationId && locationCode) {
      const locs = await base44.asServiceRole.entities.Location.filter({ code: locationCode });
      if (Array.isArray(locs) && locs.length > 0) locationId = locs[0].id;
    }
    if (!locationId) {
      // fallback: first active location
      const allLocs = await base44.asServiceRole.entities.Location.filter({ is_active: true });
      if (Array.isArray(allLocs) && allLocs.length > 0) locationId = allLocs[0].id;
    }
    if (!locationId) {
      await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, {
        processed: false,
        process_error: 'No se pudo resolver location_id',
      });
      return Response.json({ success: false, message: 'Missing location_id' }, { status: 400 });
    }

    // Build external reference to ensure idempotency per worker+period
    const periodStartISO = toDateOnlyISO(periodStart);
    const periodEndISO = toDateOnlyISO(periodEnd);
    const extRef = `operarios:${workerId || workerName}:${periodStartISO}:${periodEndISO}`;

    // Try to find existing AP by external_reference
    const existing = await base44.asServiceRole.entities.AccountPayable.filter({ external_reference: extRef });
    const description = `Nómina operarios ${periodStartISO} a ${periodEndISO} - ${workerName}`;

    let apRecord = null;
    if (Array.isArray(existing) && existing.length > 0) {
      const prev = existing[0];
      const newTotal = amount; // Authoritative from Operarios
      const newPending = Math.max(0, newTotal - toNumber(prev.paid_amount, 0));
      const newStatus = newPending <= 0 ? 'paid' : (prev.paid_amount > 0 ? 'partial' : 'pending');

      apRecord = await base44.asServiceRole.entities.AccountPayable.update(prev.id, {
        supplier_name: workerName,
        type: 'manufacturing_salary',
        category: 'salarios_manufactura',
        description,
        total_amount: newTotal,
        pending_amount: newPending,
        due_date: periodEndISO,
        location_id: locationId,
        status: newStatus,
        notes: payload.notes || prev.notes || '',
      });
    } else {
      apRecord = await base44.asServiceRole.entities.AccountPayable.create({
        supplier_name: workerName,
        type: 'manufacturing_salary',
        category: 'salarios_manufactura',
        description,
        total_amount: amount,
        paid_amount: 0,
        pending_amount: amount,
        due_date: periodEndISO,
        location_id: locationId,
        status: 'pending',
        external_reference: extRef,
        notes: payload.notes || '',
      });
    }

    // Mark inbox processed
    await base44.asServiceRole.entities.SyncInbox.update(inboxRecord.id, {
      processed: true,
      process_error: null,
    });

    return Response.json({ success: true, account_payable_id: apRecord.id, external_reference: extRef });
  } catch (error) {
    // Best effort: try to mark the record as failed when possible
    try {
      const body = await req.json().catch(() => ({}));
      const base44 = createClientFromRequest(req);
      if (body?.event?.entity_name === 'SyncInbox' && body?.event?.entity_id) {
        await base44.asServiceRole.entities.SyncInbox.update(body.event.entity_id, {
          processed: false,
          process_error: String(error?.message || error),
        });
      } else if (body?.record?.id) {
        await base44.asServiceRole.entities.SyncInbox.update(body.record.id, {
          processed: false,
          process_error: String(error?.message || error),
        });
      }
    } catch (_) {
      // ignore secondary errors
    }
    return Response.json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
});