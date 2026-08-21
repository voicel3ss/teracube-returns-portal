import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const schema = z.object({ shipmentId: z.string().uuid(), filename: z.string().trim().min(1).max(200), contentType: z.enum(["application/pdf", "image/png", "image/jpeg"]), data: z.string().min(1).max(7_000_000) });
class LabelConflictError extends Error {}
export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("shipment:upload_transfer_label");
  if (!staff) return Response.json({ error: "Logistics authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Upload a PDF, PNG, or JPEG label." }, { status: 400 });
  const encoded = parsed.data.data.trim();
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > 5_000_000) return Response.json({ error: "The label must be 5 MB or smaller." }, { status: 400 });
  if (encoded.length % 4 !== 0 || bytes.toString("base64") !== encoded) return Response.json({ error: "The uploaded label is not valid file data." }, { status: 400 });
  const shipment = await prisma.shipment.findFirst({ where: { id: parsed.data.shipmentId, type: "internal_transfer", status: { in: ["created", "label_ready"] } } });
  if (!shipment) return Response.json({ error: "This transfer is no longer waiting for a label." }, { status: 409 });
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.updateMany({ where: { id: shipment.id, status: shipment.status, updatedAt: shipment.updatedAt }, data: { status: "label_ready", labelFilename: parsed.data.filename, labelContentType: parsed.data.contentType, labelData: bytes, labelObjectKey: `local-labels/${shipment.id}/${parsed.data.filename}` } });
      if (updated.count !== 1) throw new LabelConflictError();
      await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "shipment.transfer_label_uploaded", entityType: "shipment", entityId: shipment.id, metadata: { filename: parsed.data.filename, byteSize: bytes.length } } });
    });
  } catch (error) {
    if (error instanceof LabelConflictError) return Response.json({ error: "This transfer changed in another session. Refresh before replacing its label." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true });
}
