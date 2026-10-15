import { ActivityLog } from '../models/index.js';

/**
 * Records an audit entry. Failures are logged but never interrupt the
 * operation that triggered them.
 */
export async function logActivity(req, action, entityType, entityId, summary, transaction) {
  try {
    await ActivityLog.create(
      {
        actorId: req?.user?.userId || null,
        actorRole: req?.user?.role || 'System',
        action: String(action).slice(0, 60),
        entityType: String(entityType).slice(0, 40),
        entityId: entityId ?? null,
        summary: String(summary || action).slice(0, 500),
        ipAddress: req?.ip ? String(req.ip).slice(0, 45) : null
      },
      transaction ? { transaction } : undefined
    );
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[activity log]', error.message);
    }
  }
}
