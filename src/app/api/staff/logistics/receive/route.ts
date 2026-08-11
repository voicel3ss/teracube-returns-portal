import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { parseTeracubeSerial } from "@/domain/serial-number";
import { reconcileInbound } from "@/domain/shipment-reconciliation";

const schema = z.object({ trackingNumber: z.string().trim().min(1), contentsPresent: z.boolean(), observedSerial: z.string().trim().optional(), notes: z.string().trim().max(1000).optional() });

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("shipment:receive");
  if (!staff) return Response.json({ error: "Logistics authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Enter the inbound tracking number and package contents." }, { status: 400 });
  const shipment = await prisma.shipment.findFirst({ where: { trackingNumber: parsed.data.trackingNumber, type: "inbound" }, include: { replacementOrder: true } });
  if (!shipment) return Response.json({ error: "No inbound shipment matches that tracking number." }, { status: 404 });

  let observedSerial: string | null = null;
  let observedModelId: string | null = null;
  if (parsed.data.contentsPresent) {
    const models = await prisma.deviceModel.findMany({ where: { active: true } });
    const serial = parseTeracubeSerial(parsed.data.observedSerial ?? "", models);
    if (!serial.ok) return Response.json({ error: "Scan a valid device serial when a unit is present." }, { status: 400 });
    observedSerial = serial.value.serial;
    observedModelId = serial.value.modelId;
  }
  const result = reconcileInbound(shipment.replacementOrder?.returnedDeviceSerial ?? null, parsed.data.contentsPresent, observedSerial);
  await prisma.$transaction(async (tx) => {
    if (observedSerial && observedModelId) {
      await tx.device.upsert({ where: { serial: observedSerial }, update: { circulationState: "in_repair" }, create: { serial: observedSerial, modelId: observedModelId, grade: "new", circulationState: "in_repair" } });
      await tx.shipmentUnit.upsert({ where: { shipmentId_deviceSerial: { shipmentId: shipment.id, deviceSerial: observedSerial } }, update: { observed: true }, create: { shipmentId: shipment.id, deviceSerial: observedSerial, observed: true } });
    }
    await tx.shipment.update({ where: { id: shipment.id }, data: { status: "received", receivedAt: new Date(), contentsPresent: parsed.data.contentsPresent, contentsNotes: parsed.data.notes || null } });
    if (shipment.replacementOrderId) {
      const discrepancy = result === "mismatch" || result === "missing";
      await tx.replacementOrder.update({ where: { id: shipment.replacementOrderId }, data: { status: discrepancy ? "return_discrepancy" : "return_received", ...(result === "unidentified" && observedSerial ? { returnedDeviceSerial: observedSerial } : {}) } });
      if (discrepancy) await tx.workItem.upsert({ where: { replacementOrderId_kind: { replacementOrderId: shipment.replacementOrderId, kind: "return_discrepancy" } }, update: { status: "open", lastActivityAt: new Date() }, create: { replacementOrderId: shipment.replacementOrderId, team: "support", kind: "return_discrepancy" } });
    }
    await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "shipment.inbound_received", entityType: "shipment", entityId: shipment.id, metadata: { result, observedSerial, contentsPresent: parsed.data.contentsPresent } } });
  });
  return Response.json({ ok: true, result });
}
