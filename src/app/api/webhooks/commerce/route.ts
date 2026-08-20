import { z } from "zod";
import { prisma } from "@/db/prisma";
import { verifyWebhookSignature } from "@/integrations/webhook-signature";

const schema = z.object({ id: z.string().min(1), type: z.enum(["payment.captured", "fulfillment.blocked"]), orderId: z.string().uuid(), paymentReference: z.string().optional(), lastFour: z.string().regex(/^\d{4}$/).optional() });
export async function POST(request: Request) {
  const body = await request.text(); const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) return Response.json({ error: "Webhook processing is not configured." }, { status: 503 });
  if (!verifyWebhookSignature(body, request.headers.get("x-teracube-signature"), secret)) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  let input: unknown; try { input = JSON.parse(body); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = schema.safeParse(input); if (!parsed.success) return Response.json({ error: "Invalid commerce event." }, { status: 400 });
  if (await prisma.providerEvent.findUnique({ where: { provider_providerEventId: { provider: "commerce", providerEventId: parsed.data.id } } })) return Response.json({ ok: true, duplicate: true });
  const order = await prisma.replacementOrder.findUnique({ where: { id: parsed.data.orderId } }); if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.providerEvent.create({ data: { provider: "commerce", providerEventId: parsed.data.id, eventType: parsed.data.type, payload: parsed.data } });
    if (parsed.data.type === "payment.captured") await tx.replacementOrder.update({ where: { id: order.id }, data: { paymentReference: parsed.data.paymentReference, paymentLastFour: parsed.data.lastFour, status: order.reviewState === "reviewed" ? order.status : "awaiting_verification" } });
    else { await tx.replacementOrder.update({ where: { id: order.id }, data: { status: "fulfillment_blocked", resolution: "exception" } }); await tx.workItem.upsert({ where: { replacementOrderId_kind: { replacementOrderId: order.id, kind: "fulfillment_blocked" } }, update: { status: "open", lastActivityAt: new Date() }, create: { replacementOrderId: order.id, team: "support", kind: "fulfillment_blocked" } }); await tx.conversationMessage.create({ data: { replacementOrderId: order.id, senderKind: "system", body: "Your replacement is delayed while our team sources the correct device. We’ll update you here." } }); }
    await tx.auditEvent.create({ data: { actorKind: "provider", action: parsed.data.type, entityType: "replacement_order", entityId: order.id, metadata: { providerEventId: parsed.data.id } } });
  });
  return Response.json({ ok: true });
}
