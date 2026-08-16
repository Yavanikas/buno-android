import { prisma } from '../lib/prisma';

export interface AuditLogParams {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: params.metadata ?? {},
      },
    });
  } catch (err) {
    // Audit logging should not break the main transaction flow but should log warnings
    console.warn(`[AuditLog] Failed to record audit log for action: ${params.action}`, err);
  }
}
