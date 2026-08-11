import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { mockHelpdeskProvider } from "@/integrations/mocks/device-care";
import { validateClaimReview } from "@/domain/support-review";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("verify"),
    csVerifiedFault: z.string().trim().min(3).max(1000),
    confirmedCoverage: z.enum(["warranty", "accident"]),
    freeOutcomeReason: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("clarify"), message: z.string().trim().min(5).max(2000) }),
]);

export async function POST(request: Request, { params }: RouteContext<"/api/staff/support/orders/[id]/review">) {
  const staff = await getAuthorizedStaff("order:verify");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid review." }, { status: 400 });
  const { id } = await params;
  const order = await prisma.replacementOrder.findUnique({ where: { id }, include: { processType: true } });
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  if (parsed.data.action === "clarify") {
    if (order.communicationTicketId) {
      await mockHelpdeskProvider.reply({ ticketId: order.communicationTicketId, body: parsed.data.message });
    }
    await prisma.$transaction([
      prisma.replacementOrder.update({ where: { id }, data: { reviewState: "needs_clarification" } }),
      prisma.conversationMessage.create({
        data: { replacementOrderId: id, senderKind: "staff", body: parsed.data.message },
      }),
      prisma.workItem.updateMany({ where: { replacementOrderId: id, status: { not: "completed" } }, data: { lastActivityAt: new Date() } }),
      prisma.auditEvent.create({
        data: {
          actorStaffId: staff.id,
          actorKind: "staff",
          action: "replacement_order.clarification_requested",
          entityType: "replacement_order",
          entityId: id,
          metadata: {
            ticketId: order.communicationTicketId,
            message: parsed.data.message,
            messageLength: parsed.data.message.length,
          },
        },
      }),
    ]);
    return Response.json({ ok: true, reviewState: "needs_clarification" });
  }

  if (!order.processType) return Response.json({ error: "Identify the device and replacement process before verification." }, { status: 409 });
  const configuredCoverage = order.processType.slug.startsWith("warranty-") ? "warranty" : "accident";
  const validationError = validateClaimReview({
    configuredCoverage,
    confirmedCoverage: parsed.data.confirmedCoverage,
    feeInCents: order.processType.feeInCents,
    freeOutcomeReason: parsed.data.freeOutcomeReason,
  });
  if (validationError) return Response.json({ error: validationError }, { status: 409 });

  await prisma.$transaction([
    prisma.replacementOrder.update({
      where: { id },
      data: {
        reviewState: "reviewed",
        csVerifiedFault: parsed.data.csVerifiedFault,
        freeOutcomeReason: parsed.data.freeOutcomeReason || null,
      },
    }),
    prisma.workItem.updateMany({
      where: { replacementOrderId: id, kind: "claim_verification", status: { not: "completed" } },
      data: { status: "completed", lastActivityAt: new Date(), snoozedUntil: null },
    }),
    prisma.auditEvent.create({
      data: {
        actorStaffId: staff.id,
        actorKind: "staff",
        action: "replacement_order.claim_reviewed",
        entityType: "replacement_order",
        entityId: id,
        metadata: { confirmedCoverage: parsed.data.confirmedCoverage, freeOutcomeReasonRecorded: Boolean(parsed.data.freeOutcomeReason) },
      },
    }),
  ]);
  return Response.json({ ok: true, reviewState: "reviewed" });
}
