import type { WorkItemPauseReason } from "@/generated/prisma/enums";

export const customerReplyResumablePauseReasons: WorkItemPauseReason[] = ["customer_approval"];

export function resumesWhenCustomerReplies(reason: WorkItemPauseReason | null): boolean {
  return reason !== null && customerReplyResumablePauseReasons.includes(reason);
}
