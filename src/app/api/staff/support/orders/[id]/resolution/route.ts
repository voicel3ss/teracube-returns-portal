import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { statusAfterDiscrepancyResolution, statusAfterFulfillmentResolution } from "@/domain/support-resolution";
import { staffOwnsActiveSupportWork } from "@/auth/support-work";

const schema = z.object({ resolution: z.enum(["free_refurb", "paid_refurb", "upgrade", "no_replacement", "exception"]) });

class ResolutionConflictError extends Error {}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("order:verify");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid customer outcome." }, { status: 400 });
  const { id } = await params;
  const order = await prisma.replacementOrder.findUnique({
    where: { id },
    select: { id: true, status: true, shipments: { select: { type: true, status: true } } },
  });
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  const resolvingDiscrepancy = order.status === "return_discrepancy";
  const resolvingFulfillment = order.status === "fulfillment_blocked";
  if ((resolvingDiscrepancy || resolvingFulfillment) && !await staffOwnsActiveSupportWork(id, staff.id, [resolvingDiscrepancy ? "return_discrepancy" : "fulfillment_blocked"])) {
    return Response.json({ error: "Claim this exception item before resolving it." }, { status: 403 });
  }
  const nextStatus = resolvingDiscrepancy
    ? statusAfterDiscrepancyResolution(parsed.data.resolution, order.shipments.some((shipment) => shipment.type === "outbound" && shipment.status === "delivered"))
    : resolvingFulfillment ? statusAfterFulfillmentResolution(parsed.data.resolution, order.shipments) : order.status;
  const customerMessage = resolvingFulfillment
    ? parsed.data.resolution === "no_replacement" ? "Support resolved the fulfillment issue and closed this request without a replacement." : "Support resolved the fulfillment issue. Your replacement request is moving forward again."
    : parsed.data.resolution === "no_replacement" ? "Support finished reviewing your returned package. This request is now closed without a replacement." : "Support finished reviewing your returned package. Your replacement request is moving forward.";
  const resolvingException = resolvingDiscrepancy || resolvingFulfillment;
  try {
    await prisma.$transaction(async (tx) => {
      if (resolvingException) {
        const resolved = await tx.replacementOrder.updateMany({ where: { id, status: order.status }, data: { resolution: parsed.data.resolution, status: nextStatus } });
        if (resolved.count !== 1) throw new ResolutionConflictError();
        await tx.workItem.updateMany({ where: { replacementOrderId: id, kind: resolvingDiscrepancy ? "return_discrepancy" : "fulfillment_blocked", status: { not: "completed" } }, data: { status: "completed", lastActivityAt: new Date(), snoozedUntil: null } });
        await tx.conversationMessage.create({ data: { replacementOrderId: id, senderKind: "system", body: customerMessage } });
      } else {
        await tx.replacementOrder.update({ where: { id }, data: { resolution: parsed.data.resolution } });
      }
      await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: resolvingDiscrepancy ? "replacement_order.return_discrepancy_resolved" : resolvingFulfillment ? "replacement_order.fulfillment_block_resolved" : "replacement_order.resolution_updated", entityType: "replacement_order", entityId: id, metadata: { resolution: parsed.data.resolution, previousStatus: order.status, status: nextStatus } } });
    });
  } catch (error) {
    if (error instanceof ResolutionConflictError) return Response.json({ error: "Another agent already resolved this exception. Refresh to see the outcome." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true });
}
