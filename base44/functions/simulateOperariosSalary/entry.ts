import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function startOfWeekMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0 Sun ... 6 Sat
  const diff = (day + 6) % 7; // distance to Monday
  dt.setDate(dt.getDate() - diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function endOfWeekSunday(d) {
  const mon = startOfWeekMonday(d);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    // Resolve a location_id (user's location or first active)
    let locationId = user.location_id || null;
    if (!locationId) {
      const locs = await base44.asServiceRole.entities.Location.filter({ is_active: true });
      if (Array.isArray(locs) && locs.length > 0) locationId = locs[0].id;
    }

    const now = new Date();
    const start = startOfWeekMonday(now);
    const end = endOfWeekSunday(now);

    const period_start = start.toISOString().split('T')[0];
    const period_end = end.toISOString().split('T')[0];

    const payload = {
      worker_id: 'demo-worker-1',
      worker_name: 'Operario Prueba',
      amount: 120000,
      period_start,
      period_end,
      location_id: locationId || null,
      notes: 'Evento de prueba generado desde Finanzas para validar integración.'
    };

    const inbox = await base44.asServiceRole.entities.SyncInbox.create({
      source: 'operarios',
      event_type: 'salary_week',
      payload,
      received_at: new Date().toISOString(),
      processed: false
    });

    return Response.json({ success: true, inbox_id: inbox.id, payload });
  } catch (error) {
    return Response.json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
});