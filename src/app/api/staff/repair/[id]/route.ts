import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { decodePhotoUploads, PhotoUploadError } from "@/lib/photo-upload";

class RepairStateConflictError extends Error {}

const photo = z.object({ name: z.string().max(200), type: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().max(7_000_000) });
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("complete"), resolutionCategory: z.enum(["screen", "charging", "camera", "calls_cellular", "battery", "buttons", "water_damage", "other"]), resolution: z.string().trim().min(3).max(2000), notes: z.string().trim().max(4000), photos: z.array(photo).max(3).default([]) }),
  z.object({ action: z.literal("complete_and_release"), resolutionCategory: z.enum(["screen", "charging", "camera", "calls_cellular", "battery", "buttons", "water_damage", "other"]), resolution: z.string().trim().min(3).max(2000), notes: z.string().trim().max(4000), photos: z.array(photo).max(3).default([]) }),
  z.object({ action: z.literal("release") }),
  z.object({
    action: z.literal("terminal"),
    disposition: z.enum(["scrap", "parts_harvest", "beyond_economic_repair"]),
    terminalSubDisposition: z.enum(["water_damage", "destroyed"]).optional(),
    reason: z.string().trim().min(3).max(2000),
  }).superRefine((value, context) => {
    if (value.disposition === "beyond_economic_repair" && !value.terminalSubDisposition) {
      context.addIssue({ code: "custom", path: ["terminalSubDisposition"], message: "Choose whether the device has water damage or is destroyed." });
    }
  }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("repair:record");
  if (!staff) return Response.json({ error: "Repair authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid repair update." }, { status: 400 });
  const { id } = await params;
  const repair = await prisma.repair.findUnique({ where: { id } });
  if (!repair) return Response.json({ error: "Repair not found." }, { status: 404 });
  if (parsed.data.action === "start") {
    if (repair.status !== "received") return Response.json({ error: "Only received units can begin repair." }, { status: 409 });
    await prisma.repair.update({ where: { id }, data: { status: "in_repair" } });
    return Response.json({ ok: true });
  }
  if (parsed.data.action === "release") {
    if (repair.status !== "qc_pass" || !repair.repairTeamResolution) return Response.json({ error: "Save a repair resolution before releasing this device." }, { status: 409 });
    const shipmentId = crypto.randomUUID();
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.repair.updateMany({ where: { id, status: "qc_pass" }, data: { status: "back_to_stock", completedAt: new Date() } });
        if (claimed.count !== 1) throw new RepairStateConflictError();
        await tx.device.update({ where: { serial: repair.deviceSerial }, data: { circulationState: "in_transfer", grade: "refurbished", currentOwnerId: null } });
        await tx.shipment.create({ data: { id: shipmentId, type: "internal_transfer", status: "created", provider: "manual-upload", units: { create: { deviceSerial: repair.deviceSerial } } } });
        await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.released_to_warehouse", entityType: "repair", entityId: id, metadata: { serial: repair.deviceSerial, shipmentId } } });
      });
    } catch (error) {
      if (error instanceof RepairStateConflictError) return Response.json({ error: "This repair was already released or changed by another staff member." }, { status: 409 });
      throw error;
    }
    return Response.json({ ok: true, shipmentId });
  }
  if (parsed.data.action === "terminal") {
    if (repair.status !== "in_repair") return Response.json({ error: "Only a device currently in repair can be marked as unrepairable." }, { status: 409 });
    const terminalData = parsed.data;
    const terminalSubDisposition = terminalData.disposition === "beyond_economic_repair" ? terminalData.terminalSubDisposition : null;
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.repair.updateMany({ where: { id, status: "in_repair" }, data: { status: "terminal_fail", terminalDisposition: terminalData.disposition, terminalSubDisposition, terminalReason: terminalData.reason, completedAt: new Date() } });
        if (claimed.count !== 1) throw new RepairStateConflictError();
        await tx.device.update({ where: { serial: repair.deviceSerial }, data: { circulationState: "retired", currentOwnerId: null } });
        await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.terminal_fail", entityType: "repair", entityId: id, metadata: { serial: repair.deviceSerial, disposition: terminalData.disposition, terminalSubDisposition } } });
      });
    } catch (error) {
      if (error instanceof RepairStateConflictError) return Response.json({ error: "This repair was already completed or changed by another staff member." }, { status: 409 });
      throw error;
    }
    return Response.json({ ok: true });
  }
  let decodedPhotos;
  try {
    decodedPhotos = decodePhotoUploads(parsed.data.photos);
  } catch (error) {
    if (error instanceof PhotoUploadError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
  const photos = decodedPhotos.map((item) => ({ objectKey: `data:${item.contentType};base64,${Buffer.from(item.data).toString("base64")}`, caption: item.filename }));
  if (repair.status !== "in_repair") return Response.json({ error: "Only a device currently in repair can be submitted for batch QC." }, { status: 409 });
  if (parsed.data.action === "complete_and_release") {
    const completionData = parsed.data;
    const shipmentId = crypto.randomUUID();
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.repair.updateMany({ where: { id, status: "in_repair" }, data: { status: "back_to_stock", resolutionCategory: completionData.resolutionCategory, repairTeamResolution: completionData.resolution, detailedNotes: completionData.notes, completedAt: new Date() } });
        if (claimed.count !== 1) throw new RepairStateConflictError();
        if (photos.length > 0) await tx.repairPhoto.createMany({ data: photos.map((item) => ({ ...item, repairId: id })) });
        await tx.device.update({ where: { serial: repair.deviceSerial }, data: { circulationState: "in_transfer", grade: "refurbished", currentOwnerId: null } });
        await tx.shipment.create({ data: { id: shipmentId, type: "internal_transfer", status: "created", provider: "manual-upload", units: { create: { deviceSerial: repair.deviceSerial } } } });
        await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.completed_and_released", entityType: "repair", entityId: id, metadata: { serial: repair.deviceSerial, resolutionCategory: completionData.resolutionCategory, shipmentId } } });
      });
    } catch (error) {
      if (error instanceof RepairStateConflictError) return Response.json({ error: "This repair was already completed or changed by another staff member." }, { status: 409 });
      throw error;
    }
    return Response.json({ ok: true, shipmentId });
  }
  if (parsed.data.action !== "complete") return Response.json({ error: "Invalid repair action." }, { status: 400 });
  const completionData = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const completed = await tx.repair.updateMany({ where: { id, status: "in_repair" }, data: { status: "qc_pass", resolutionCategory: completionData.resolutionCategory, repairTeamResolution: completionData.resolution, detailedNotes: completionData.notes, completedAt: null } });
      if (completed.count !== 1) throw new RepairStateConflictError();
      if (photos.length) await tx.repairPhoto.createMany({ data: photos.map((item) => ({ ...item, repairId: id })) });
      await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.resolution_recorded_awaiting_batch_qc", entityType: "repair", entityId: id, metadata: { serial: repair.deviceSerial, resolutionCategory: completionData.resolutionCategory } } });
    });
  } catch (error) {
    if (error instanceof RepairStateConflictError) return Response.json({ error: "This repair was already completed or changed by another staff member." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true });
}
