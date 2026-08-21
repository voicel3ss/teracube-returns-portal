import type { WorkItemKind } from "@/generated/prisma/enums";
import { prisma } from "@/db/prisma";

export async function staffOwnsActiveSupportWork(
  replacementOrderId: string,
  staffUserId: string,
  kinds: WorkItemKind[],
) {
  const item = await prisma.workItem.findFirst({
    where: {
      replacementOrderId,
      team: "support",
      kind: { in: kinds },
      status: { not: "completed" },
    },
    select: { assignedToStaffId: true },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
  });
  return Boolean(item && item.assignedToStaffId === staffUserId);
}
