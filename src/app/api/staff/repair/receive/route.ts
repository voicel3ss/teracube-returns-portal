import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { parseTeracubeSerial } from "@/domain/serial-number";
import { isUniqueConstraintError } from "@/db/prisma-errors";

const schema = z.object({ serial: z.string().trim().min(1) });
class DeviceStateConflictError extends Error {}

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("repair:record");
  if (!staff) return Response.json({ error: "Repair authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Scan a valid serial number." }, { status: 400 });
  const models = await prisma.deviceModel.findMany({ where: { active: true } });
  const serial = parseTeracubeSerial(parsed.data.serial, models);
  if (!serial.ok) return Response.json({ error: serial.reason === "unknown_model_code" ? "That model code is not registered." : "The serial format is invalid." }, { status: 400 });
  const activeStatuses: Array<"received" | "in_repair" | "qc_pass"> = ["received", "in_repair", "qc_pass"];
  const existing = await prisma.repair.findFirst({ where: { deviceSerial: serial.value.serial, status: { in: activeStatuses } } });
  if (existing) return Response.json({ repairId: existing.id, existing: true });
  const device = await prisma.device.findUnique({ where: { serial: serial.value.serial }, select: { circulationState: true } });
  if (device && !["deployed", "in_repair"].includes(device.circulationState)) return Response.json({ error: `This device is ${device.circulationState.replaceAll("_", " ")}. Reconcile its custody before opening another repair.` }, { status: 409 });
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      if (device) {
        const locked = await tx.device.updateMany({ where: { serial: serial.value.serial, circulationState: { in: ["deployed", "in_repair"] } }, data: { circulationState: "in_repair", updatedAt: new Date() } });
        if (locked.count !== 1) throw new DeviceStateConflictError();
      } else {
        await tx.device.create({ data: { serial: serial.value.serial, modelId: serial.value.modelId, grade: "new", circulationState: "in_repair" } });
      }
      const concurrent = await tx.repair.findFirst({ where: { deviceSerial: serial.value.serial, status: { in: activeStatuses } } });
      if (concurrent) return { repair: concurrent, existing: true };
      const created = await tx.repair.create({ data: { deviceSerial: serial.value.serial, status: "received" } });
      await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.unit_received", entityType: "repair", entityId: created.id, metadata: { serial: serial.value.serial, deviceRegistered: !device } } });
      return { repair: created, existing: false };
    });
  } catch (error) {
    if (error instanceof DeviceStateConflictError) return Response.json({ error: "This device changed custody in another session. Refresh the repair queue." }, { status: 409 });
    if (isUniqueConstraintError(error)) {
      const concurrent = await prisma.repair.findFirst({ where: { deviceSerial: serial.value.serial, status: { in: activeStatuses } } });
      if (concurrent) return Response.json({ repairId: concurrent.id, existing: true });
    }
    throw error;
  }
  return Response.json({ repairId: result.repair.id, ...(result.existing ? { existing: true } : {}) }, { status: result.existing ? 200 : 201 });
}
