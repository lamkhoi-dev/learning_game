import { prisma } from '../lib/prisma'

interface AuditParams {
  adminId: string
  action: string
  entityType?: string
  entityId?: string
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string
}

export async function writeAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: params.oldValue !== undefined ? (params.oldValue as object) : undefined,
        newValue: params.newValue !== undefined ? (params.newValue as object) : undefined,
        ipAddress: params.ipAddress,
      },
    })
  } catch (err) {
    console.error('Audit log failed:', err)
  }
}
