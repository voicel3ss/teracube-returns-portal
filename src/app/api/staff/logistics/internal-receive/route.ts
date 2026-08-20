import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const schema = z.object({ shipmentId: z.string().uuid(), observedSerials: z.array(z.string().trim().length(15)).min(1).max(200), notes: z.string().trim().max(2000).optional().default("") });

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("shipment:receive");
  if (!staff) return Response.json({ error: "Warehouse receiving authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter at least one valid serial." }, { status: 400 });
  const shipment = await prisma.shipment.findFirst({ where: { id: parsed.data.shipmentId, type: "internal_transfer", status: { in: ["created", "label_ready", "in_transit", "exception"] } }, include: { units: true } });
  if (!shipment) return Response.json({ error: "This internal transfer is not waiting for warehouse receipt." }, { status: 409 });

  const expected = [...new Set(shipment.units.map((unit) => unit.deviceSerial.toUpperCase()))].sort();
  const observed = [...new Set(parsed.data.observedSerials.map((serial) => serial.toUpperCase()))].sort();
  const missing = expected.filter((serial) => !observed.includes(serial));
  const unexpected = observed.filter((serial) => !expected.includes(serial));
  const matched = missing.length === 0 && unexpected.length === 0;
  await prisma.$transaction([
    prisma.shipment.update({ where: { id: shipment.id }, data: { status: matched ? "received" : "exception", receivedAt: new Date(), contentsPresent: observed.length > 0, contentsNotes: JSON.stringify({ note: parsed.data.notes, observedSerials: observed, missing, unexpected }), units: { updateMany: { where: {}, data: { observed: matched } } } } }),
    prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "shipment.internal_transfer_received", entityType: "shipment", entityId: shipment.id, metadata: { result: matched ? "matched" : "mismatch", expectedCount: expected.length, observedCount: observed.length, missingCount: missing.length, unexpectedCount: unexpected.length } } }),
  ]);
  return Response.json({ result: matched ? "matched" : "mismatch", missing, unexpected });
}
