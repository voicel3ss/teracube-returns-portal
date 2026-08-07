import { getAuthorizedStaff } from "@/auth/staff-request";
import { CustomerTokenService } from "@/auth/customer-token";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("order:create");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const { id } = await params;
  const order = await prisma.replacementOrder.findUnique({ where: { id }, select: { id: true, customerId: true } });
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  const issued = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).issue({
    customerId: order.customerId,
    replacementOrderId: order.id,
  });
  await prisma.auditEvent.create({ data: {
    actorStaffId: staff.id,
    actorKind: "staff",
    action: "replacement_order.customer_link_issued",
    entityType: "replacement_order",
    entityId: id,
    metadata: { expiresAt: issued.expiresAt.toISOString() },
  } });
  return Response.json({ path: `/repair/track?token=${encodeURIComponent(issued.token)}`, expiresAt: issued.expiresAt.toISOString() });
}
