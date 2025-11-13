import { supabase } from '@/lib/supabaseClient';
import { AuditLog, AuditModule } from '@/lib/types';

interface AuditLogPayload {
  userId?: string;
  userName?: string;
  module: string;
  action: string;
  details?: string;
  resourceId?: string;
  resourceType?: string;
  ipAddress?: string;
  userAgent?: string;
}

const mapSupabaseAuditLogToApp = (record: any): AuditLog => ({
  id: record.id,
  userId: record.user_id ?? undefined,
  userName: record.user_name ?? 'System',
  module: record.module as AuditModule,
  action: record.action,
  details: record.details ?? undefined,
  resourceId: record.resource_id ?? undefined,
  resourceType: record.resource_type ?? undefined,
  ipAddress: record.ip_address ?? undefined,
  userAgent: record.user_agent ?? undefined,
  createdAt: record.created_at ?? new Date().toISOString(),
});

export async function recordAuditLog(payload: AuditLogPayload): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: payload.userId ?? null,
    user_name: payload.userName ?? null,
    module: payload.module,
    action: payload.action,
    details: payload.details ?? null,
    resource_id: payload.resourceId ?? null,
    resource_type: payload.resourceType ?? null,
    ip_address: payload.ipAddress ?? null,
    user_agent: payload.userAgent ?? null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to record audit log: ${error.message}`);
  }
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load audit logs: ${error.message}`);
  }

  return (data ?? []).map(mapSupabaseAuditLogToApp);
}
