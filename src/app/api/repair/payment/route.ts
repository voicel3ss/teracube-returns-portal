import { z } from "zod";
import { CustomerTokenService } from "@/auth/customer-token";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";

const schema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "A valid secure link is required." }, { status: 400 });
  const access = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).authenticate(parsed.data.token);
  if (!access) return Response.json({ error: "This secure link is invalid or expired." }, { status: 401 });
  const order = await prisma.replacementOrder.findFirst({ where: { id: access.replacementOrderId, customerId: access.customerId }, include: { processType: true } });
  if (!order?.processType) return Response.json({ error: "This request does not have a payment option." }, { status: 409 });
  const totalInCents = order.processType.feeInCents + order.processType.depositInCents;
  const balanceInCents = Math.max(0, totalInCents - order.amountPaidInCents);
  if (balanceInCents === 0) return Response.json({ error: "No additional payment is due." }, { status: 409 });

  await prisma.$transaction([
    prisma.replacementOrder.update({ where: { id: order.id }, data: { amountPaidInCents: totalInCents, paymentReference: `${order.paymentReference ?? "mock"}+adjustment`, status: "awaiting_verification", reviewState: "unreviewed" } }),
    prisma.conversationMessage.create({ data: { replacementOrderId: order.id, senderKind: "system", body: `Payment of $${(balanceInCents / 100).toFixed(2)} was received. Support will now finish verifying your request.` } }),
    prisma.workItem.updateMany({ where: { replacementOrderId: order.id, kind: "claim_verification", status: { not: "completed" } }, data: { status: "open", snoozedUntil: null, lastActivityAt: new Date() } }),
    prisma.auditEvent.create({ data: { actorKind: "customer", action: "replacement_order.additional_payment_captured", entityType: "replacement_order", entityId: order.id, metadata: { amountInCents: balanceInCents, provider: "mock-commerce" } } }),
  ]);
  return Response.json({ ok: true, amountPaidInCents: totalInCents });
}
