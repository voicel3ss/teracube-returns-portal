import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const schema = z.object({ resolution: z.enum(["free_refurb", "paid_refurb", "upgrade", "no_replacement", "exception"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("order:verify");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Choose a valid customer outcome." }, { status: 400 });
  const { id } = await params;
  const order = await prisma.replacementOrder.findUnique({ where: { id }, select: { id: true } });
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  await prisma.$transaction([
    prisma.replacementOrder.update({ where: { id }, data: { resolution: parsed.data.resolution } }),
    prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "replacement_order.resolution_updated", entityType: "replacement_order", entityId: id, metadata: { resolution: parsed.data.resolution } } }),
  ]);
  return Response.json({ ok: true });
}
