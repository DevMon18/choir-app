import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logging';

export interface AuditLogEntry {
  actorId: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase.from('audit_logs').insert({
      actor_id: entry.actorId,
      actor_email: entry.actorEmail,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      metadata: entry.metadata ?? {},
    });

    if (error) {
      logger.warn('Failed to insert audit log entry:', { error: error.message, action: entry.action });
    } else {
      logger.info(`Audit Log: ${entry.action} on ${entry.entityType}`, {
        actorId: entry.actorId,
        entityId: entry.entityId,
      });
    }
  } catch (err: unknown) {
    logger.error('Error in recordAuditLog execution:', { error: (err as Error).message });
  }
}
