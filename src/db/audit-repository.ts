import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { AuditEventRecord, AuditRepository } from "@/security/audit";

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly client: PrismaClient) {}

  async append(event: AuditEventRecord): Promise<void> {
    await this.client.auditEvent.create({
      data: {
        id: event.id,
        actorStaffId: event.actorStaffId,
        actorKind: event.actorKind,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
        ipAddress: event.ipAddress,
        occurredAt: event.occurredAt,
      },
    });
  }
}
