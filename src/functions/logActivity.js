import { ActivityLog } from '@/entities/all';

export async function logActivity(params) {
  try {
    await ActivityLog.create({
      entity_type: params.entity_type || null,
      entity_id: params.entity_id || null,
      action: params.action || 'info',
      description: params.description || '',
      employee_id: params.employee_id || null,
      employee_name: params.employee_name || null,
      amount: params.amount || null,
      old_data: params.old_data || null,
      new_data: params.new_data || null,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[logActivity] Error saving activity log:', e);
  }
}
