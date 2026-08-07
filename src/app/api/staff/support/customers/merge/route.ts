import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { maskPii } from "@/security/pii";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), survivorId: z.string().uuid(), sourceId: z.string().uuid() }),
  z.object({ action: z.literal("confirm"), survivorId: z.string().uuid(), sourceId: z.string().uuid(), primaryEmailId: z.string().uuid() }),
]);

async function loadPair(survivorId: string, sourceId: string) {
  if (survivorId === sourceId) return null;
  const [survivor, source] = await Promise.all([
    prisma.customer.findFirst({ where: { id: survivorId, mergedIntoId: null }, include: { emails: true, devices: true, orders: { select: { returnedDeviceSerial: true, outboundDeviceSerial: true } } } }),
    prisma.customer.findFirst({ where: { id: sourceId, mergedIntoId: null }, include: { emails: true, devices: true, orders: { select: { returnedDeviceSerial: true, outboundDeviceSerial: true } } } }),
  ]);
  return survivor && source ? { survivor, source } : null;
}

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("customer:merge");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Choose two different active customers." }, { status: 400 });
  const pair = await loadPair(parsed.data.survivorId, parsed.data.sourceId);
  if (!pair) return Response.json({ error: "Both customers must be active and different." }, { status: 409 });

  const serials = (customer: typeof pair.survivor) => new Set([
    ...customer.devices.map((device) => device.serial),
    ...customer.orders.flatMap((order) => [order.returnedDeviceSerial, order.outboundDeviceSerial].filter((value): value is string => Boolean(value))),
  ]);
  const survivorSerials = serials(pair.survivor);
  const conflicts = [...serials(pair.source)].filter((serial) => survivorSerials.has(serial));
  const preview = {
    survivor: { id: pair.survivor.id, emails: pair.survivor.emails.map((email) => ({ id: email.id, masked: maskPii("parent_email", email.email), primary: email.isPrimary })) },
    source: { id: pair.source.id, emails: pair.source.emails.map((email) => ({ id: email.id, masked: maskPii("parent_email", email.email), primary: email.isPrimary })) },
    moved: { emails: pair.source.emails.length, devices: pair.source.devices.length, orders: pair.source.orders.length },
    serialConflicts: conflicts,
  };
  if (parsed.data.action === "preview") return Response.json(preview);
  const primaryEmailId = parsed.data.primaryEmailId;
  const selectedEmail = [...pair.survivor.emails, ...pair.source.emails].find((email) => email.id === primaryEmailId);
  if (!selectedEmail) return Response.json({ error: "Choose a primary email from one of these customers." }, { status: 400 });

  await prisma.$transaction(async (transaction) => {
    await transaction.customerEmail.updateMany({ where: { customerId: pair.survivor.id }, data: { isPrimary: false } });
    await transaction.customerEmail.updateMany({ where: { customerId: pair.source.id }, data: { customerId: pair.survivor.id, isPrimary: false } });
    await transaction.customerEmail.update({ where: { id: selectedEmail.id }, data: { isPrimary: true } });
    await transaction.device.updateMany({ where: { currentOwnerId: pair.source.id }, data: { currentOwnerId: pair.survivor.id } });
    await transaction.replacementOrder.updateMany({ where: { customerId: pair.source.id }, data: { customerId: pair.survivor.id } });
    await transaction.customerAccessToken.updateMany({ where: { customerId: pair.source.id }, data: { customerId: pair.survivor.id } });
    await transaction.customer.update({ where: { id: pair.source.id }, data: { mergedIntoId: pair.survivor.id, mergedAt: new Date() } });
    await transaction.auditEvent.create({
      data: {
        actorStaffId: staff.id,
        actorKind: "staff",
        action: "customer.merged",
        entityType: "customer",
        entityId: pair.survivor.id,
        metadata: { sourceCustomerId: pair.source.id, survivorCustomerId: pair.survivor.id, primaryEmailId: selectedEmail.id, moved: preview.moved, serialConflicts: conflicts },
      },
    });
  });
  return Response.json({ ok: true, survivorId: pair.survivor.id });
}
