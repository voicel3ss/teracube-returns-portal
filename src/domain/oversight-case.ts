import type { ReplacementOrderStatus, StaffTeam, WorkItemKind, WorkItemStatus } from "@/generated/prisma/enums";

export type OversightWork = {
  kind: WorkItemKind;
  status: WorkItemStatus;
  team: StaffTeam;
  assignedToStaff: { id: string; displayName: string } | null;
};

const statusLabels: Record<ReplacementOrderStatus, string> = {
  submitted: "Submitted",
  paid: "Payment received",
  awaiting_verification: "Awaiting verification",
  refurb_dispatched: "Replacement dispatched",
  refurb_delivered: "Replacement delivered",
  return_in_transit: "Return in transit",
  return_received: "Return received",
  closed: "Closed",
  unidentified: "Device identification needed",
  return_discrepancy: "Return discrepancy",
  fulfillment_blocked: "Fulfillment blocked",
};

const workKindLabels: Record<WorkItemKind, string> = {
  claim_verification: "Claim verification",
  unidentified_device: "Device identification",
  return_discrepancy: "Return discrepancy",
  fulfillment_blocked: "Fulfillment block",
  deposit_refund: "Deposit refund",
  needs_clarification: "Customer clarification",
  customer_message: "Customer message",
};

export function oversightStatusLabel(status: ReplacementOrderStatus): string {
  return statusLabels[status];
}

export function oversightWorkLabel(kind: WorkItemKind): string {
  return workKindLabels[kind];
}

export function oversightStage(status: ReplacementOrderStatus, work: OversightWork[], hasActiveRepair: boolean): StaffTeam | "complete" {
  const claimed = work.find((item) => item.status === "claimed" || item.status === "snoozed");
  if (claimed) return claimed.team;
  const open = work.find((item) => item.status === "open");
  if (open) return open.team;
  if (hasActiveRepair) return "repair";

  switch (status) {
    case "submitted":
    case "awaiting_verification":
    case "unidentified":
    case "return_discrepancy":
    case "fulfillment_blocked":
      return "support";
    case "paid":
    case "refurb_dispatched":
    case "refurb_delivered":
    case "return_in_transit":
      return "logistics";
    case "return_received":
      return "repair";
    case "closed":
      return "complete";
  }
}

export function oversightNeedsAttention(status: ReplacementOrderStatus, work: OversightWork[], updatedAt: Date, staleBefore: Date): boolean {
  if (["unidentified", "return_discrepancy", "fulfillment_blocked"].includes(status)) return true;
  return work.some((item) => item.status === "claimed") && updatedAt <= staleBefore;
}
