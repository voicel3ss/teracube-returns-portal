import { z } from "zod";
import { prisma } from "@/db/prisma";
import { verifyWebhookSignature } from "@/integrations/webhook-signature";

const schema = z.object({ id: z.string().min(1), type: z.literal("customer.reply"), ticketId: z.string().min(1), body: z.string().trim().min(1).max(5000) });
export async function POST(request: Request) {
  const body = await request.text(); const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) return Response.json({ error: "Webhook processing is not configured." }, { status: 503 });
  if (!verifyWebhookSignature(body, request.headers.get("x-teracube-signature"), secret)) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  let input: unknown; try { input = JSON.parse(body); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = schema.safeParse(input); if (!parsed.success) return Response.json({ error: "Invalid helpdesk event." }, { status: 400 });
  if (await prisma.providerEvent.findUnique({ where: { provider_providerEventId: { provider: "helpdesk", providerEventId: parsed.data.id } } })) return Response.json({ ok: true, duplicate: true });
  const order = await prisma.replacementOrder.findFirst({ where: { communicationTicketId: parsed.data.ticketId } }); if (!order) return Response.json({ error: "Ticket is not linked to an order." }, { status: 404 });
  await prisma.$transaction([prisma.providerEvent.create({ data: { provider: "helpdesk", providerEventId: parsed.data.id, eventType: parsed.data.type, payload: parsed.data } }), prisma.conversationMessage.create({ data: { replacementOrderId: order.id, senderKind: "customer", body: parsed.data.body } }), prisma.workItem.updateMany({ where: { replacementOrderId: order.id, kind: "needs_clarification", status: { not: "completed" } }, data: { status: "open", lastActivityAt: new Date() } }), prisma.auditEvent.create({ data: { actorKind: "provider", action: "helpdesk.customer_reply", entityType: "replacement_order", entityId: order.id, metadata: { providerEventId: parsed.data.id } } })]);
  return Response.json({ ok: true });
}
