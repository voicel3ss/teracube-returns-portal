import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const schema = z.object({ shipmentId: z.string().uuid(), filename: z.string().trim().min(1), contentType: z.enum(["application/pdf", "image/png", "image/jpeg"]), data: z.string().min(1) });
export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("shipment:upload_transfer_label");
  if (!staff) return Response.json({ error: "Logistics authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Upload a PDF, PNG, or JPEG label." }, { status: 400 });
  const bytes = Buffer.from(parsed.data.data, "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) return Response.json({ error: "The label must be smaller than 5 MB." }, { status: 400 });
  const shipment = await prisma.shipment.findFirst({ where: { id: parsed.data.shipmentId, type: "internal_transfer" } });
  if (!shipment) return Response.json({ error: "Internal transfer not found." }, { status: 404 });
  await prisma.$transaction([
    prisma.shipment.update({ where: { id: shipment.id }, data: { status: "label_ready", labelFilename: parsed.data.filename, labelContentType: parsed.data.contentType, labelData: bytes, labelObjectKey: `local-labels/${shipment.id}/${parsed.data.filename}` } }),
    prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "shipment.transfer_label_uploaded", entityType: "shipment", entityId: shipment.id, metadata: { filename: parsed.data.filename, byteSize: bytes.length } } }),
  ]);
  return Response.json({ ok: true });
}
