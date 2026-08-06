import { randomUUID } from "node:crypto";

export type AuditActorKind = "staff" | "customer" | "system";

export type AuditEventRecord = {
  id: string;
  actorStaffId?: string;
  actorKind: AuditActorKind;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
  ipAddress?: string;
  occurredAt: Date;
};

export interface AuditRepository {
  append(event: AuditEventRecord): Promise<void>;
}

export class AuditService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(event: Omit<AuditEventRecord, "id" | "occurredAt">): Promise<void> {
    await this.repository.append({ ...event, id: randomUUID(), occurredAt: this.now() });
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  readonly events: AuditEventRecord[] = [];

  async append(event: AuditEventRecord): Promise<void> {
    this.events.push(structuredClone(event));
  }
}
