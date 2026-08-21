import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const schema = z.object({ serials: z.array(z.string().trim()).min(1).max(100) });
class BatchConflictError extends Error {}
export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("repair:batch_ready");
  if (!staff) return Response.json({ error: "Batch authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter at least one serial." }, { status: 400 });
  const serials = [...new Set(parsed.data.serials.map((value) => value.toUpperCase()))];
  const repairs = await prisma.repair.findMany({ where: { deviceSerial: { in: serials }, status: "qc_pass", repairTeamResolution: { not: null } }, orderBy: { createdAt: "desc" } });
  const eligible = [...new Map(repairs.map((repair) => [repair.deviceSerial, repair])).values()];
  if (eligible.length !== serials.length) return Response.json({ error: "Every serial must be awaiting batch QC with a recorded repair resolution." }, { status: 409 });
  const shipmentId = crypto.randomUUID();
  try {
    await prisma.$transaction(async (tx) => {
      for (const repair of eligible) {
        const released = await tx.repair.updateMany({ where: { id: repair.id, status: "qc_pass", repairTeamResolution: { not: null } }, data: { status: "back_to_stock", completedAt: new Date() } });
        if (released.count !== 1) throw new BatchConflictError();
      }
      await tx.device.updateMany({ where: { serial: { in: serials } }, data: { circulationState: "in_transfer", grade: "refurbished", currentOwnerId: null } });
      await tx.shipment.create({ data: { id: shipmentId, type: "internal_transfer", status: "created", provider: "manual-upload", units: { create: serials.map((deviceSerial) => ({ deviceSerial })) } } });
      await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "repair.batch_ready", entityType: "shipment", entityId: shipmentId, metadata: { serials, count: serials.length } } });
    });
  } catch (error) {
    if (error instanceof BatchConflictError) return Response.json({ error: "One of these repairs was already released. Refresh the batch before trying again." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true, count: serials.length, shipmentId });
}
