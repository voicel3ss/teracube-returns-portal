import { z } from "zod";
import { CustomerTokenService } from "@/auth/customer-token";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { canPayOutstandingBalance } from "@/domain/customer-payment";
import { outstandingBalanceInCents, quotedTotalInCents } from "@/domain/order-pricing";

class PaymentStateConflictError extends Error {}

const schema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "A valid secure link is required." }, { status: 400 });
  const access = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).authenticate(parsed.data.token);
  if (!access) return Response.json({ error: "This secure link is invalid or expired." }, { status: 401 });
  const order = await prisma.replacementOrder.findFirst({ where: { id: access.replacementOrderId, customerId: access.customerId }, include: { processType: true } });
  if (!order?.processType) return Response.json({ error: "This request does not have a payment option." }, { status: 409 });
  const totalInCents = quotedTotalInCents(order);
  const balanceInCents = outstandingBalanceInCents(order);
  if (balanceInCents === 0) return Response.json({ error: "No additional payment is due." }, { status: 409 });
  if (!canPayOutstandingBalance({ status: order.status, reviewState: order.reviewState, balanceInCents })) {
    return Response.json({ error: "This request is not waiting for an additional payment." }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const captured = await tx.replacementOrder.updateMany({
        where: { id: order.id, status: "submitted", reviewState: "needs_clarification", amountPaidInCents: order.amountPaidInCents },
        data: { amountPaidInCents: totalInCents, paymentReference: `${order.paymentReference ?? "mock"}+adjustment`, status: "awaiting_verification", reviewState: "unreviewed" },
      });
      if (captured.count !== 1) throw new PaymentStateConflictError();
      await tx.conversationMessage.create({ data: { replacementOrderId: order.id, senderKind: "system", body: `Payment of $${(balanceInCents / 100).toFixed(2)} was received. Support will now finish verifying your request.` } });
      await tx.workItem.upsert({
        where: { replacementOrderId_kind: { replacementOrderId: order.id, kind: "claim_verification" } },
        update: { status: "claimed", snoozedUntil: null, lastActivityAt: new Date() },
        create: { replacementOrderId: order.id, team: "support", kind: "claim_verification", status: "open" },
      });
      await tx.workItem.updateMany({ where: { replacementOrderId: order.id, kind: "needs_clarification", status: { not: "completed" } }, data: { status: "completed", snoozedUntil: null, lastActivityAt: new Date() } });
      await tx.auditEvent.create({ data: { actorKind: "customer", action: "replacement_order.additional_payment_captured", entityType: "replacement_order", entityId: order.id, metadata: { amountInCents: balanceInCents, provider: "mock-commerce" } } });
    });
  } catch (error) {
    if (error instanceof PaymentStateConflictError) return Response.json({ error: "This payment was already processed or the request changed. Refresh to see the latest status." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true, amountPaidInCents: totalInCents });
}
