import { AdminAuditLog, IAdminAuditLog } from '../models/AdminAuditLog';
import { logger } from '../utils/logger';

/** Records an admin action. Never throws: a failed log must not undo the action. */
export async function audit(
  actorId: string,
  action: string,
  targetType: IAdminAuditLog['targetType'],
  targetId: string | undefined,
  reason?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await AdminAuditLog.create({ actor: actorId, action, targetType, targetId, reason, details });
  } catch (error) {
    logger.error('Failed to write admin audit log', { action, targetId, error: (error as Error).message });
  }
}
