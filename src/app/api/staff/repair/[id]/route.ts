import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const photo = z.object({ name: z.string().max(200), type: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().max(7_000_000) });
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("complete"), resolutionCategory: z.enum(["screen", "charging", "camera", "calls_cellular", "battery", "buttons", "water_damage", "other"]), resolution: z.string().trim().min(3).max(2000), notes: z.string().trim().max(4000), photos: z.array(photo).max(3).default([]) }),
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
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid repair update." }, { status: 400 });
  const { id } = await params;
  const repair = await prisma.repair.findUnique({ where: { id } });
  if (!repair) return Response.json({ error: "Repair not found." }, { status: 404 });
  if (parsed.data.action === "start") {
    if (repair.status !== "received") return Response.json({ error: "Only received units can begin repair." }, { status: 409 });
    await prisma.repair.update({ where: { id }, data: { status: "in_repair" } });
    return Response.json({ ok: true });
  }
  if (parsed.data.action === "terminal") {
    const terminalSubDisposition = parsed.data.disposition === "beyond_economic_repair" ? parsed.data.terminalSubDisposition : null;
    await prisma.$transaction([prisma.repair.update({ where: { id }, data: { status: "terminal_fail", terminalDisposition: parsed.data.disposition, terminalSubDisposition, terminalReason: parsed.data.reason, completedAt: new Date() } }), prisma.device.update({ where: { serial: repair.deviceSerial }, data: { circulationState: "retired", currentOwnerId: null } }), prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.terminal_fail", entityType: "repair", entityId: id, metadata: { serial: repair.deviceSerial, disposition: parsed.data.disposition, terminalSubDisposition } } })]);
    return Response.json({ ok: true });
  }
  const photos = parsed.data.photos.map((item) => ({ objectKey: `data:${item.type};base64,${item.data}`, caption: item.name }));
  if (repair.status !== "in_repair") return Response.json({ error: "Only a device currently in repair can be submitted for batch QC." }, { status: 409 });
  await prisma.$transaction([
    prisma.repair.update({ where: { id }, data: { status: "qc_pass", resolutionCategory: parsed.data.resolutionCategory, repairTeamResolution: parsed.data.resolution, detailedNotes: parsed.data.notes, completedAt: null, photos: { create: photos } } }),
    prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.resolution_recorded_awaiting_batch_qc", entityType: "repair", entityId: id, metadata: { serial: repair.deviceSerial, resolutionCategory: parsed.data.resolutionCategory } } }),
  ]);
  return Response.json({ ok: true });
}
