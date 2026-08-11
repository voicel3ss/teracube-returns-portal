import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { parseTeracubeSerial } from "@/domain/serial-number";

const schema = z.object({ serial: z.string().trim().min(1) });

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("repair:record");
  if (!staff) return Response.json({ error: "Repair authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Scan a valid serial number." }, { status: 400 });
  const models = await prisma.deviceModel.findMany({ where: { active: true } });
  const serial = parseTeracubeSerial(parsed.data.serial, models);
  if (!serial.ok) return Response.json({ error: serial.reason === "unknown_model_code" ? "That model code is not registered." : "The serial format is invalid." }, { status: 400 });
  const existing = await prisma.repair.findFirst({ where: { deviceSerial: serial.value.serial, status: { in: ["received", "in_repair", "qc_pass"] } } });
  if (existing) return Response.json({ repairId: existing.id, existing: true });
  const repair = await prisma.$transaction(async (tx) => {
    await tx.device.upsert({ where: { serial: serial.value.serial }, update: { circulationState: "in_repair" }, create: { serial: serial.value.serial, modelId: serial.value.modelId, grade: "new", circulationState: "in_repair" } });
    const created = await tx.repair.create({ data: { deviceSerial: serial.value.serial, status: "received" } });
    await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.unit_received", entityType: "repair", entityId: created.id, metadata: { serial: serial.value.serial } } });
    return created;
  });
  return Response.json({ repairId: repair.id }, { status: 201 });
}
