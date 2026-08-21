export const staffTeams = ["support", "ops_lead", "repair", "logistics", "admin"] as const;
export type StaffTeam = (typeof staffTeams)[number];

export const permissions = [
  "order:create",
  "order:verify",
  "order:view_all",
  "order:refund",
  "repair:record",
  "repair:batch_ready",
  "shipment:receive",
  "shipment:dispatch",
  "shipment:upload_transfer_label",
  "queue:claim",
  "queue:assign",
  "config:manage",
  "oversight:view",
] as const;
export type Permission = (typeof permissions)[number];

const teamPermissions: Record<StaffTeam, readonly Permission[]> = {
  support: ["order:create", "order:verify", "order:view_all", "order:refund", "queue:claim"],
  ops_lead: [
    "order:create",
    "order:verify",
    "order:view_all",
    "order:refund",
    "queue:claim",
    "queue:assign",
    "oversight:view",
  ],
  repair: ["repair:record", "repair:batch_ready"],
  logistics: ["shipment:receive", "shipment:dispatch", "shipment:upload_transfer_label"],
  admin: permissions,
};

export function hasPermission(teams: readonly StaffTeam[], permission: Permission): boolean {
  return teams.some((team) => teamPermissions[team].includes(permission));
}

export const piiFields = ["child_phone", "iccid", "parent_email", "parent_address", "payment_reference"] as const;
export type PiiField = (typeof piiFields)[number];
export type FieldAccess = "masked_reveal_with_audit" | "blocked";

const blockedForRepair = new Set<PiiField>(piiFields);
const blockedForLogistics = new Set<PiiField>(["child_phone", "iccid", "parent_email", "payment_reference"]);

export function getPiiFieldAccess(team: StaffTeam, field: PiiField): FieldAccess {
  if (team === "repair" && blockedForRepair.has(field)) return "blocked";
  if (team === "logistics" && blockedForLogistics.has(field)) return "blocked";
  return "masked_reveal_with_audit";
}
