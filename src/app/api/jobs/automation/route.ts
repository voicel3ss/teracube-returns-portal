import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/db/prisma";
import { automationPolicy, olderThan } from "@/automation/policy";

function authorized(request: Request): boolean {
  const secret = process.env.AUTOMATION_JOB_SECRET ?? "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(secret); const received = Buffer.from(token);
  return secret.length >= 32 && expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Job authorization required." }, { status: 401 });
  const now = new Date();
  const orders = await prisma.replacementOrder.findMany({ where: { status: { not: "closed" }, submittedAt: { not: null } }, include: { shipments: true } });
  let reminders = 0; let escalations = 0;
  for (const order of orders) {
    const started = order.submittedAt ?? order.createdAt;
    const returnStarted = order.shipments.some((shipment) => shipment.type === "inbound" && ["in_transit", "delivered", "received"].includes(shipment.status));
    if (!returnStarted && olderThan(started, automationPolicy.returnReminderDays, now)) {
      const exists = await prisma.automationMarker.findUnique({ where: { replacementOrderId_kind: { replacementOrderId: order.id, kind: "return_day_4_reminder" } } });
      if (!exists) { await prisma.$transaction([prisma.automationMarker.create({ data: { replacementOrderId: order.id, kind: "return_day_4_reminder" } }), prisma.conversationMessage.create({ data: { replacementOrderId: order.id, senderKind: "system", body: "Reminder: please send your original device using the Teracube return label. Keep your SIM and pack the device safely." } }), prisma.auditEvent.create({ data: { actorKind: "automation", action: "replacement_order.return_reminder", entityType: "replacement_order", entityId: order.id, metadata: { day: automationPolicy.returnReminderDays } } })]); reminders++; }
    }
    const needsEscalation = (!returnStarted && olderThan(started, automationPolicy.returnEscalationDays, now)) || (order.status === "unidentified" && olderThan(order.updatedAt, automationPolicy.unidentifiedEscalationDays, now));
    if (needsEscalation) {
      const kind = order.status === "unidentified" ? "unidentified_escalation" : "return_day_6_escalation";
      const exists = await prisma.automationMarker.findUnique({ where: { replacementOrderId_kind: { replacementOrderId: order.id, kind } } });
      if (!exists) { await prisma.$transaction([prisma.automationMarker.create({ data: { replacementOrderId: order.id, kind } }), prisma.auditEvent.create({ data: { actorKind: "automation", action: `replacement_order.${kind}`, entityType: "replacement_order", entityId: order.id } })]); escalations++; }
    }
  }
  const staleBefore = new Date(now.getTime() - automationPolicy.staleClaimDays * 86400000);
  const staleClaims = await prisma.workItem.findMany({ where: { status: "claimed", lastActivityAt: { lte: staleBefore } } });
  for (const item of staleClaims) {
    const kind = `stale_claim_${item.id}`;
    await prisma.automationMarker.upsert({ where: { replacementOrderId_kind: { replacementOrderId: item.replacementOrderId, kind } }, update: {}, create: { replacementOrderId: item.replacementOrderId, kind } });
  }
  await prisma.auditEvent.create({ data: { actorKind: "automation", action: "automation.daily_completed", entityType: "system", entityId: now.toISOString(), metadata: { reminders, escalations, staleClaims: staleClaims.length } } });
  return Response.json({ ok: true, reminders, escalations, staleClaims: staleClaims.length });
}
