import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { mockHelpdeskProvider, mockObjectStorageProvider, mockShippingProvider } from "@/integrations/mocks/device-care";
import { validateClaimReview } from "@/domain/support-review";
import { staffOwnsActiveSupportWork } from "@/auth/support-work";
import { selectSupportWorkItem } from "@/domain/support-work-selection";

class ReviewConflictError extends Error {}

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("verify"),
    csVerifiedFault: z.string().trim().min(3).max(1000),
    confirmedCoverage: z.enum(["warranty", "accident"]),
    freeOutcomeReason: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("reprice"), csVerifiedFault: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("message"), message: z.string().trim().min(5).max(2000) }),
  z.object({ action: z.literal("clarify"), message: z.string().trim().min(5).max(2000) }),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("order:view_all");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const { id } = await params;
  if (!await prisma.replacementOrder.findUnique({ where: { id }, select: { id: true } })) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }
  const messages = await prisma.conversationMessage.findMany({ where: { replacementOrderId: id }, include: { attachments: true }, orderBy: { createdAt: "asc" } });
  return Response.json({ messages: messages.map((message) => ({
    id: message.id,
    senderKind: message.senderKind,
    body: message.body,
    sentAt: message.createdAt.toISOString(),
    photos: message.attachments.map((photo) => ({ id: photo.id, name: photo.filename, dataUrl: `data:${photo.contentType};base64,${Buffer.from(photo.data).toString("base64")}` })),
  })) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("order:verify");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid review." }, { status: 400 });
  const { id } = await params;
  const order = await prisma.replacementOrder.findUnique({
    where: { id },
    include: {
      processType: true,
      returnedDevice: true,
      workItems: { where: { team: "support", status: { not: "completed" } }, select: { id: true, kind: true, assignedToStaffId: true } },
    },
  });
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  if (parsed.data.action === "clarify" || parsed.data.action === "message") {
    const currentWork = selectSupportWorkItem(order.workItems, { status: order.status, reviewState: order.reviewState });
    if (!currentWork || currentWork.assignedToStaffId !== staff.id) {
      return Response.json({ error: "Claim this item before messaging the customer." }, { status: 403 });
    }
    const asksForReply = parsed.data.action === "clarify";
    const pausesVerification = asksForReply
      && order.reviewState !== "reviewed"
      && ["claim_verification", "needs_clarification"].includes(currentWork.kind);
    if (order.communicationTicketId) {
      await mockHelpdeskProvider.reply({ ticketId: order.communicationTicketId, body: parsed.data.message });
    }
    await prisma.$transaction([
      ...(pausesVerification
        ? [prisma.replacementOrder.update({ where: { id }, data: { reviewState: "needs_clarification" } })]
        : []),
      ...(asksForReply
        ? [prisma.workItem.update({
          where: { id: currentWork.id },
          data: { status: "snoozed", snoozedUntil: null, pauseReason: "customer_approval", lastActivityAt: new Date() },
        })]
        : []),
      ...(!asksForReply
        ? [prisma.workItem.updateMany({
          where: { replacementOrderId: id, team: "support", kind: "customer_message", status: { not: "completed" } },
          data: { status: "completed", lastActivityAt: new Date(), snoozedUntil: null, pauseReason: null },
        })]
        : []),
      prisma.conversationMessage.create({
        data: { replacementOrderId: id, senderKind: "staff", body: parsed.data.message },
      }),
      prisma.workItem.updateMany({ where: { replacementOrderId: id, status: { not: "completed" }, id: { not: currentWork.id } }, data: { lastActivityAt: new Date() } }),
      prisma.auditEvent.create({
        data: {
          actorStaffId: staff.id,
          actorKind: "staff",
          action: asksForReply ? "replacement_order.clarification_requested" : "replacement_order.staff_message_sent",
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
    return Response.json({ ok: true, reviewState: pausesVerification ? "needs_clarification" : order.reviewState });
  }

  if (parsed.data.action === "reprice") {
    const repriceData = parsed.data;
    if (!order.processType) return Response.json({ error: "Identify the replacement process before applying a fee." }, { status: 409 });
    if (order.reviewState !== "unreviewed") return Response.json({ error: "This claim is not ready to be repriced. Refresh to see its current state." }, { status: 409 });
    if (!await staffOwnsActiveSupportWork(id, staff.id, ["claim_verification", "needs_clarification"])) return Response.json({ error: "Claim this verification item before changing its price." }, { status: 403 });
    const paidProcess = await prisma.processType.findFirst({
      where: {
        slug: `accident-${order.processType.flow}`,
        active: true,
        ...(order.returnedDevice ? { modelMappings: { some: { modelId: order.returnedDevice.modelId } } } : {}),
      },
    });
    if (!paidProcess || paidProcess.feeInCents <= 0) return Response.json({ error: "No paid accidental-damage option is configured for this device and replacement path." }, { status: 409 });
    const totalDue = paidProcess.feeInCents + paidProcess.depositInCents;
    const balanceDue = Math.max(0, totalDue - order.amountPaidInCents);
    if (balanceDue === 0) return Response.json({ error: "This order is already fully paid. Refresh the page and verify it." }, { status: 409 });
    const customerMessage = `Support confirmed accidental damage. A payment of $${(balanceDue / 100).toFixed(2)} is required before we can release the return label or replacement.`;
    try {
      await prisma.$transaction(async (tx) => {
        const repriced = await tx.replacementOrder.updateMany({ where: { id, reviewState: "unreviewed", processTypeId: order.processType!.id }, data: { processTypeId: paidProcess.id, quotedFeeInCents: paidProcess.feeInCents, quotedDepositInCents: paidProcess.depositInCents, csVerifiedFault: repriceData.csVerifiedFault, reviewState: "needs_clarification", status: "submitted", freeOutcomeReason: null, resolution: null } });
        if (repriced.count !== 1) throw new ReviewConflictError();
        await tx.conversationMessage.create({ data: { replacementOrderId: id, senderKind: "system", body: customerMessage } });
        await tx.workItem.updateMany({ where: { replacementOrderId: id, kind: "claim_verification", status: { not: "completed" } }, data: { lastActivityAt: new Date(), snoozedUntil: null, pauseReason: null } });
        await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "replacement_order.repriced_for_accidental_damage", entityType: "replacement_order", entityId: id, metadata: { previousProcessTypeId: order.processType!.id, processTypeId: paidProcess.id, balanceDueInCents: balanceDue } } });
      });
    } catch (error) {
      if (error instanceof ReviewConflictError) return Response.json({ error: "Another agent already updated this verification. Refresh to see the result." }, { status: 409 });
      throw error;
    }
    return Response.json({ ok: true, reviewState: "needs_clarification", balanceDueInCents: balanceDue });
  }

  if (parsed.data.action !== "verify") return Response.json({ error: "Invalid review action." }, { status: 400 });
  const verificationData = parsed.data;
  if (!order.processType) return Response.json({ error: "Identify the device and replacement process before verification." }, { status: 409 });
  if (order.reviewState !== "unreviewed" || !["submitted", "paid", "awaiting_verification"].includes(order.status)) return Response.json({ error: "This claim is not waiting for verification. Refresh to see its current state." }, { status: 409 });
  if (!await staffOwnsActiveSupportWork(id, staff.id, ["claim_verification", "needs_clarification"])) return Response.json({ error: "Claim this verification item before releasing it." }, { status: 403 });
  if (!order.encryptedShippingAddress) return Response.json({ error: "The customer must add a shipping address before this request can be verified." }, { status: 409 });
  const config = await prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const configuredCoverage = order.processType.slug.startsWith("warranty-") ? "warranty" : "accident";
  const validationError = validateClaimReview({
    configuredCoverage,
    confirmedCoverage: verificationData.confirmedCoverage,
    feeInCents: order.quotedFeeInCents,
    freeOutcomeReason: verificationData.freeOutcomeReason,
  });
  if (validationError) return Response.json({ error: validationError }, { status: 409 });

  try {
    await prisma.$transaction(async (tx) => {
      const verified = await tx.replacementOrder.updateMany({
        where: { id, reviewState: "unreviewed", status: { in: ["submitted", "paid", "awaiting_verification"] } },
        data: { reviewState: "reviewed", csVerifiedFault: verificationData.csVerifiedFault, freeOutcomeReason: verificationData.freeOutcomeReason || null, resolution: order.quotedFeeInCents > 0 ? "paid_refurb" : "free_refurb" },
      });
      if (verified.count !== 1) throw new ReviewConflictError();
      const label = await mockShippingProvider.createInboundLabel({ orderId: id, destinationCode: "TERACUBE-RETURNS" });
      const labelKey = `labels/inbound/${id}.pdf`;
      const qrKey = `labels/inbound/${id}.txt`;
      await mockObjectStorageProvider.put({ key: labelKey, bytes: label.labelBytes, contentType: "application/pdf" });
      if (label.qrCodeBytes) await mockObjectStorageProvider.put({ key: qrKey, bytes: label.qrCodeBytes, contentType: "text/plain" });
      await tx.shipment.upsert({
        where: { id: `00000000-0000-4000-8000-${id.replaceAll("-", "").slice(0, 12)}` },
        update: { status: "label_ready", trackingNumber: label.trackingNumber, labelObjectKey: labelKey, labelFilename: `teracube-return-${order.orderNumber}.txt`, labelContentType: "text/plain", labelData: Buffer.from(label.labelBytes), qrCodeObjectKey: label.qrCodeBytes ? qrKey : null },
        create: { id: `00000000-0000-4000-8000-${id.replaceAll("-", "").slice(0, 12)}`, replacementOrderId: id, type: "inbound", status: "label_ready", provider: "local-shipping", providerShipmentId: label.providerShipmentId, trackingNumber: label.trackingNumber, labelObjectKey: labelKey, labelFilename: `teracube-return-${order.orderNumber}.txt`, labelContentType: "text/plain", labelData: Buffer.from(label.labelBytes), qrCodeObjectKey: label.qrCodeBytes ? qrKey : null },
      });
      await tx.conversationMessage.create({ data: { replacementOrderId: id, senderKind: "system", body: `Your request is verified. Return tracking: ${label.trackingNumber}. ${config.returnInstructions}` } });
      await tx.workItem.updateMany({ where: { replacementOrderId: id, kind: { in: ["claim_verification", "needs_clarification", "customer_message"] }, status: { not: "completed" } }, data: { status: "completed", lastActivityAt: new Date(), snoozedUntil: null, pauseReason: null } });
      await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "replacement_order.claim_reviewed", entityType: "replacement_order", entityId: id, metadata: { confirmedCoverage: verificationData.confirmedCoverage, freeOutcomeReasonRecorded: Boolean(verificationData.freeOutcomeReason) } } });
    });
  } catch (error) {
    if (error instanceof ReviewConflictError) return Response.json({ error: "Another agent already verified this claim. Refresh to see the released request." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true, reviewState: "reviewed" });
}
