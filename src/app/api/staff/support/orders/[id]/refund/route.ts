import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { validateDepositRefund } from "@/domain/support-review";
import { mockCommerceProvider } from "@/integrations/mocks/device-care";
import { refundIssuedMessage } from "@/domain/customer-notifications";
import { staffOwnsActiveSupportWork } from "@/auth/support-work";

const schema = z.object({ amountInCents: z.number().int().positive() });

class RefundConflictError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("order:refund");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid refund amount." }, { status: 400 });
  const { id } = await params;
  const [order, config] = await Promise.all([prisma.replacementOrder.findUnique({ where: { id }, include: { processType: true, shipments: { where: { type: "inbound" }, select: { status: true } } } }), prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } })]);
  if (!order?.processType) return Response.json({ error: "Order not found." }, { status: 404 });
  if (!order.paymentReference) return Response.json({ error: "This order has no captured payment to refund." }, { status: 409 });
  if (!await staffOwnsActiveSupportWork(id, staff.id, ["deposit_refund"])) return Response.json({ error: "Claim the deposit-refund item before issuing a refund." }, { status: 403 });

  const validation = validateDepositRefund({
    status: order.status,
    inboundShipmentStatuses: order.shipments.map((shipment) => shipment.status),
    amountInCents: parsed.data.amountInCents,
    depositInCents: order.quotedDepositInCents,
    alreadyRefundedInCents: order.depositRefundedInCents,
    amountPaidInCents: order.amountPaidInCents,
    refundGate: config.depositRefundGate === "return_received" ? "return_received" : "return_in_transit",
  });
  if (validation.error) return Response.json({ error: validation.error, refundableInCents: validation.refundableInCents }, { status: 409 });

  let refund;
  try {
    refund = await prisma.$transaction(async (tx) => {
      const reserved = await tx.replacementOrder.updateMany({
        where: { id, depositRefundedInCents: order.depositRefundedInCents },
        data: { depositRefundedInCents: { increment: parsed.data.amountInCents } },
      });
      if (reserved.count !== 1) throw new RefundConflictError();
      const providerRefund = await mockCommerceProvider.refund({
        paymentReference: order.paymentReference!,
        amount: { amountInCents: parsed.data.amountInCents, currency: "USD" },
      });
      await tx.workItem.updateMany({ where: { replacementOrderId: id, kind: "deposit_refund", status: { not: "completed" } }, data: { status: "completed", lastActivityAt: new Date() } });
      await tx.conversationMessage.create({
        data: { replacementOrderId: id, senderKind: "system", body: refundIssuedMessage(parsed.data.amountInCents) },
      });
      await tx.auditEvent.create({ data: {
        actorStaffId: staff.id,
        actorKind: "staff",
        action: "replacement_order.deposit_refunded",
        entityType: "replacement_order",
        entityId: id,
        metadata: { amountInCents: parsed.data.amountInCents, refundReference: providerRefund.refundReference },
      } });
      return providerRefund;
    });
  } catch (error) {
    if (error instanceof RefundConflictError) return Response.json({ error: "The refund total changed in another session. Refresh before refunding again." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true, refundReference: refund.refundReference });
}
