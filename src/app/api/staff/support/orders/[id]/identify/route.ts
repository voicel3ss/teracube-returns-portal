import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { staffOwnsActiveSupportWork } from "@/auth/support-work";
import { parseTeracubeSerial } from "@/domain/serial-number";
import { isUniqueConstraintError } from "@/db/prisma-errors";

const schema = z.object({
  serial: z.string().trim().min(8).max(15),
  coverage: z.enum(["warranty", "accident"]),
  flow: z.enum(["regular", "advance"]),
});

class IdentificationConflictError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("order:verify");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter valid device details." }, { status: 400 });
  const { id } = await params;
  const models = await prisma.deviceModel.findMany({ where: { active: true } });
  const parsedSerial = parseTeracubeSerial(parsed.data.serial, models);
  if (!parsedSerial.ok) return Response.json({ error: parsedSerial.reason === "unknown_model_code" ? "That serial uses an unknown Teracube model code." : "Enter a valid 15-character Teracube serial." }, { status: 400 });
  const serial = parsedSerial.value.serial;
  const model = models.find((candidate) => candidate.id === parsedSerial.value.modelId)!;
  const order = await prisma.replacementOrder.findUnique({ where: { id }, select: { id: true, status: true, orderNumber: true, customerId: true } });
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "unidentified") return Response.json({ error: "This request already has an identified device." }, { status: 409 });
  if (!await staffOwnsActiveSupportWork(id, staff.id, ["unidentified_device"])) return Response.json({ error: "Claim the device-identification item before continuing." }, { status: 403 });
  const activeOrder = await prisma.replacementOrder.findFirst({ where: { id: { not: id }, returnedDeviceSerial: serial, status: { not: "closed" } }, select: { orderNumber: true } });
  if (activeOrder) return Response.json({ error: `This device already has active order #${String(activeOrder.orderNumber).padStart(4, "0")}.` }, { status: 409 });
  const processType = await prisma.processType.findFirst({
    where: { slug: `${parsed.data.coverage}-${parsed.data.flow}`, active: true, modelMappings: { some: { modelId: model.id } } },
  });
  if (!processType) return Response.json({ error: "That replacement option is not available for this model." }, { status: 409 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.device.upsert({
        where: { serial },
        update: { modelId: model.id, currentOwnerId: order.customerId },
        create: { serial, modelId: model.id, currentOwnerId: order.customerId, grade: "new", circulationState: "deployed" },
      });
      const attached = await tx.replacementOrder.updateMany({ where: { id, status: "unidentified", processTypeId: null }, data: { returnedDeviceSerial: serial, processTypeId: processType.id, quotedFeeInCents: processType.feeInCents, quotedDepositInCents: processType.depositInCents, status: "awaiting_verification", reviewState: "unreviewed" } });
      if (attached.count !== 1) throw new IdentificationConflictError();
      await tx.workItem.updateMany({ where: { replacementOrderId: id, kind: "unidentified_device", status: { not: "completed" } }, data: { status: "completed", lastActivityAt: new Date(), snoozedUntil: null, pauseReason: null } });
      await tx.workItem.upsert({
        where: { replacementOrderId_kind: { replacementOrderId: id, kind: "claim_verification" } },
        update: { team: "support", status: "claimed", assignedToStaffId: staff.id, snoozedUntil: null, pauseReason: null, lastActivityAt: new Date() },
        create: { replacementOrderId: id, team: "support", kind: "claim_verification", status: "claimed", assignedToStaffId: staff.id },
      });
      await tx.conversationMessage.create({ data: { replacementOrderId: id, senderKind: "system", body: `Support identified this device as ${model.name} (${serial}). The claim is now ready for verification.` } });
      await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "replacement_order.device_identified", entityType: "replacement_order", entityId: id, metadata: { serial, modelId: model.id, processTypeId: processType.id } } });
    });
  } catch (error) {
    if (error instanceof IdentificationConflictError || isUniqueConstraintError(error)) return Response.json({ error: "Another request or agent already claimed this device. Refresh to see the current record." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true, serial, model: model.name, processType: processType.name });
}
