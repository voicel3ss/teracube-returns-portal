import type { ReplacementOrderStatus, ReviewState } from "./model";

type WorkItemLike = { kind: string };

export function selectSupportWorkItem<T extends WorkItemLike>(
  items: T[],
  input: { status: ReplacementOrderStatus; reviewState: ReviewState },
) {
  const priorities = input.status === "unidentified" ? ["unidentified_device"]
    : input.status === "return_discrepancy" ? ["return_discrepancy"]
    : input.status === "fulfillment_blocked" ? ["fulfillment_blocked"]
    : input.reviewState === "needs_clarification" ? ["needs_clarification"]
    : input.reviewState === "unreviewed" ? ["needs_clarification", "claim_verification"]
    : ["customer_message", "deposit_refund", "claim_verification"];
  for (const kind of priorities) {
    const match = items.find((item) => item.kind === kind);
    if (match) return match;
  }
  return items[0] ?? null;
}
