import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { validateDepositRefund } from "@/domain/support-review";
import { mockCommerceProvider } from "@/integrations/mocks/device-care";

const schema = z.object({ amountInCents: z.number().int().positive() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("order:refund");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Enter a valid refund amount." }, { status: 400 });
  const { id } = await params;
  const [order, config] = await Promise.all([prisma.replacementOrder.findUnique({ where: { id }, include: { processType: true } }), prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } })]);
  if (!order?.processType) return Response.json({ error: "Order not found." }, { status: 404 });
  if (!order.paymentReference) return Response.json({ error: "This order has no captured payment to refund." }, { status: 409 });

  const validation = validateDepositRefund({
    status: order.status,
    amountInCents: parsed.data.amountInCents,
    depositInCents: order.processType.depositInCents,
    alreadyRefundedInCents: order.depositRefundedInCents,
    amountPaidInCents: order.amountPaidInCents,
    refundGate: config.depositRefundGate === "return_received" ? "return_received" : "return_in_transit",
  });
  if (validation.error) return Response.json({ error: validation.error, refundableInCents: validation.refundableInCents }, { status: 409 });

  const refund = await mockCommerceProvider.refund({
    paymentReference: order.paymentReference,
    amount: { amountInCents: parsed.data.amountInCents, currency: "USD" },
  });
  await prisma.$transaction([
    prisma.replacementOrder.update({ where: { id }, data: { depositRefundedInCents: { increment: parsed.data.amountInCents } } }),
    prisma.workItem.updateMany({ where: { replacementOrderId: id, kind: "deposit_refund", status: { not: "completed" } }, data: { status: "completed", lastActivityAt: new Date() } }),
    prisma.auditEvent.create({ data: {
      actorStaffId: staff.id,
      actorKind: "staff",
      action: "replacement_order.deposit_refunded",
      entityType: "replacement_order",
      entityId: id,
      metadata: { amountInCents: parsed.data.amountInCents, refundReference: refund.refundReference },
    } }),
  ]);
  return Response.json({ ok: true, refundReference: refund.refundReference });
}
