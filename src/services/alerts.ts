import { supabase } from '@/lib/supabaseClient';
import { Alert } from '@/lib/types';

const mapAlert = (record: any): Alert => ({
  id: record.id,
  productId: record.product_id ?? '',
  productName: record.product_name,
  type: record.alert_type,
  severity: record.severity,
  message: record.message,
  batchId: record.batch_id ?? undefined,
  expiryDate: record.expiry_date ?? undefined,
  read: record.read ?? false,
  createdAt: record.created_at ?? new Date().toISOString(),
});

export async function insertAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'read'> & { read?: boolean }): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      product_id: alert.productId,
      product_name: alert.productName,
      alert_type: alert.type,
      severity: alert.severity,
      message: alert.message,
      batch_id: alert.batchId ?? null,
      expiry_date: alert.expiryDate ?? null,
      read: alert.read ?? false,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create alert: ${error.message}`);
  }

  return mapAlert(data);
}

export async function markAlertAsRead(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ read: true })
    .eq('id', alertId);

  if (error) {
    throw new Error(`Failed to update alert: ${error.message}`);
  }
}

export async function markAllAlertsAsRead(): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ read: true })
    .eq('read', false);

  if (error) {
    throw new Error(`Failed to mark alerts as read: ${error.message}`);
  }
}

export async function fetchAlerts(): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load alerts: ${error.message}`);
  }

  return (data ?? []).map(mapAlert);
}


