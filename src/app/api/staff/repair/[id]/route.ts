import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const photo = z.object({ name: z.string().max(200), type: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().max(7_000_000) });
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("complete"), resolutionCategory: z.enum(["screen", "charging", "camera", "calls_cellular", "battery", "buttons", "water_damage", "other"]), resolution: z.string().trim().min(3).max(2000), notes: z.string().trim().max(4000), photos: z.array(photo).max(3).default([]) }),
  z.object({ action: z.literal("terminal"), disposition: z.enum(["scrap", "parts_harvest", "beyond_economic_repair"]), reason: z.string().trim().min(3).max(2000) }),
]);

export async function PATCH(request: Request, { params }: RouteContext<"/api/staff/repair/[id]">) {
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
    await prisma.$transaction([prisma.repair.update({ where: { id }, data: { status: "terminal_fail", terminalDisposition: parsed.data.disposition, terminalReason: parsed.data.reason, completedAt: new Date() } }), prisma.device.update({ where: { serial: repair.deviceSerial }, data: { circulationState: "retired", currentOwnerId: null } }), prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.terminal_fail", entityType: "repair", entityId: id, metadata: { serial: repair.deviceSerial, disposition: parsed.data.disposition } } })]);
    return Response.json({ ok: true });
  }
  const photos = parsed.data.photos.map((item) => ({ objectKey: `data:${item.type};base64,${item.data}`, caption: item.name }));
  await prisma.$transaction([prisma.repair.update({ where: { id }, data: { status: "back_to_stock", resolutionCategory: parsed.data.resolutionCategory, repairTeamResolution: parsed.data.resolution, detailedNotes: parsed.data.notes, completedAt: new Date(), photos: { create: photos } } }), prisma.device.update({ where: { serial: repair.deviceSerial }, data: { circulationState: "in_stock", grade: "refurbished", currentOwnerId: null } }), prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.qc_passed_back_to_stock", entityType: "repair", entityId: id, metadata: { serial: repair.deviceSerial, resolutionCategory: parsed.data.resolutionCategory } } })]);
  return Response.json({ ok: true });
}
