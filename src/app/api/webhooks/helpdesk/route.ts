import { z } from "zod";
import { prisma } from "@/db/prisma";
import { verifyWebhookSignature } from "@/integrations/webhook-signature";
import { isUniqueConstraintError } from "@/db/prisma-errors";

const schema = z.object({ id: z.string().min(1), type: z.literal("customer.reply"), ticketId: z.string().min(1), body: z.string().trim().min(1).max(5000) });
export async function POST(request: Request) {
  const body = await request.text(); const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) return Response.json({ error: "Webhook processing is not configured." }, { status: 503 });
  if (!verifyWebhookSignature(body, request.headers.get("x-teracube-signature"), secret)) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  let input: unknown; try { input = JSON.parse(body); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = schema.safeParse(input); if (!parsed.success) return Response.json({ error: "Invalid helpdesk event." }, { status: 400 });
  if (await prisma.providerEvent.findUnique({ where: { provider_providerEventId: { provider: "helpdesk", providerEventId: parsed.data.id } } })) return Response.json({ ok: true, duplicate: true });
  const order = await prisma.replacementOrder.findFirst({ where: { communicationTicketId: parsed.data.ticketId }, include: { workItems: { where: { team: "support", status: { not: "completed" } }, select: { id: true } } } }); if (!order) return Response.json({ error: "Ticket is not linked to an order." }, { status: 404 });
  try {
    await prisma.$transaction(async (tx) => {
    await tx.providerEvent.create({ data: { provider: "helpdesk", providerEventId: parsed.data.id, eventType: parsed.data.type, payload: parsed.data } });
    await tx.conversationMessage.create({ data: { replacementOrderId: order.id, senderKind: "customer", body: parsed.data.body } });
    await tx.workItem.updateMany({
      where: { replacementOrderId: order.id, team: "support", status: { not: "completed" }, assignedToStaffId: { not: null } },
      data: { status: "claimed", lastActivityAt: new Date(), snoozedUntil: null },
    });
    await tx.workItem.updateMany({
      where: { replacementOrderId: order.id, team: "support", status: { not: "completed" }, assignedToStaffId: null },
      data: { status: "open", lastActivityAt: new Date(), snoozedUntil: null },
    });
    if (order.reviewState === "needs_clarification") {
      await tx.replacementOrder.update({ where: { id: order.id }, data: { reviewState: "unreviewed" } });
      await tx.workItem.upsert({
        where: { replacementOrderId_kind: { replacementOrderId: order.id, kind: "needs_clarification" } },
        update: { snoozedUntil: null, lastActivityAt: new Date() },
        create: { replacementOrderId: order.id, team: "support", kind: "needs_clarification", status: "open" },
      });
    } else if (order.workItems.length > 0) {
      await tx.workItem.updateMany({ where: { replacementOrderId: order.id, team: "support", status: { not: "completed" } }, data: { lastActivityAt: new Date(), snoozedUntil: null } });
    } else {
      await tx.workItem.upsert({
        where: { replacementOrderId_kind: { replacementOrderId: order.id, kind: "customer_message" } },
        update: { status: "open", assignedToStaffId: null, snoozedUntil: null, lastActivityAt: new Date() },
        create: { replacementOrderId: order.id, team: "support", kind: "customer_message", status: "open" },
      });
    }
    await tx.auditEvent.create({ data: { actorKind: "provider", action: "helpdesk.customer_reply", entityType: "replacement_order", entityId: order.id, metadata: { providerEventId: parsed.data.id, answeredClarification: order.reviewState === "needs_clarification" } } });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return Response.json({ ok: true, duplicate: true });
    throw error;
  }
  return Response.json({ ok: true });
}
