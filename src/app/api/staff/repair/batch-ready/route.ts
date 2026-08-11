import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const schema = z.object({ serials: z.array(z.string().trim()).min(1).max(100) });
export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("repair:batch_ready");
  if (!staff) return Response.json({ error: "Batch authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Enter at least one serial." }, { status: 400 });
  const serials = [...new Set(parsed.data.serials.map((value) => value.toUpperCase()))];
  const repairs = await prisma.repair.findMany({ where: { deviceSerial: { in: serials }, status: { in: ["in_repair", "qc_pass"] }, repairTeamResolution: { not: null } }, orderBy: { createdAt: "desc" } });
  const eligible = [...new Map(repairs.map((repair) => [repair.deviceSerial, repair])).values()];
  if (eligible.length !== serials.length) return Response.json({ error: "Every serial needs an active repair with a recorded resolution before batch QC." }, { status: 409 });
  await prisma.$transaction([...eligible.map((repair) => prisma.repair.update({ where: { id: repair.id }, data: { status: "back_to_stock", completedAt: new Date() } })), prisma.device.updateMany({ where: { serial: { in: serials } }, data: { circulationState: "in_stock", grade: "refurbished", currentOwnerId: null } }), prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.batch_ready", entityType: "device_batch", entityId: crypto.randomUUID(), metadata: { serials, count: serials.length } } })]);
  return Response.json({ ok: true, count: serials.length });
}
