import { getPiiFieldAccess, type PiiField, type StaffTeam } from "../auth/permissions";
import { AuditService } from "./audit";

export class PiiAccessDeniedError extends Error {
  constructor(field: PiiField, team: StaffTeam) {
    super(`${team} cannot access ${field}.`);
    this.name = "PiiAccessDeniedError";
  }
}

export function maskPii(field: PiiField, value: string): string {
  if (!value) return "";

  if (field === "parent_email") {
    const [local, domain] = value.split("@");
    if (!domain) return "••••";
    return `${local.slice(0, 1)}•••@${domain}`;
  }

  if (field === "child_phone" || field === "iccid" || field === "imei" || field === "payment_reference") {
    return `••••${value.slice(-4)}`;
  }

  return "••••••••";
}

export class PiiRevealService {
  constructor(private readonly audit: AuditService) {}

  async reveal(input: {
    activeTeam: StaffTeam;
    actorStaffId: string;
    field: PiiField;
    entityType: string;
    entityId: string;
    ipAddress?: string;
    loadValue: () => Promise<string>;
  }): Promise<string> {
    if (getPiiFieldAccess(input.activeTeam, input.field) === "blocked") {
      throw new PiiAccessDeniedError(input.field, input.activeTeam);
    }

    const value = await input.loadValue();

    // The reveal fails closed if the audit event cannot be persisted.
    await this.audit.record({
      actorKind: "staff",
      actorStaffId: input.actorStaffId,
      action: "pii.revealed",
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: { field: input.field, activeTeam: input.activeTeam },
      ipAddress: input.ipAddress,
    });

    return value;
  }
}
