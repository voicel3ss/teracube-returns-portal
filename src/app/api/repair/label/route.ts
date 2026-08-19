import { CustomerTokenService } from "@/auth/customer-token";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const access = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).authenticate(token);
  if (!access) return Response.json({ error: "This secure link is invalid or expired." }, { status: 401 });

  const shipment = await prisma.shipment.findFirst({
    where: { replacementOrderId: access.replacementOrderId, type: "inbound", status: { in: ["label_ready", "in_transit", "delivered", "received"] } },
    include: { replacementOrder: { include: { returnedDevice: { include: { model: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  if (!shipment) return Response.json({ error: "Your return label is not ready yet." }, { status: 404 });

  const contentType = shipment.labelContentType ?? "text/plain; charset=utf-8";
  const filename = shipment.labelFilename ?? `teracube-return-${shipment.replacementOrder?.orderNumber ?? "label"}.txt`;
  const fallback = [
    "TERACUBE DEVICE RETURN",
    `Order: #${String(shipment.replacementOrder?.orderNumber ?? "").padStart(4, "0")}`,
    `Device: ${shipment.replacementOrder?.returnedDevice?.model.name ?? "Teracube device"}`,
    `Serial: ${shipment.replacementOrder?.returnedDeviceSerial ?? "Not identified"}`,
    `Carrier tracking: ${shipment.trackingNumber ?? "Pending"}`,
    "Destination: TERACUBE RETURNS",
  ].join("\n");
  const body = shipment.labelData ? new Uint8Array(shipment.labelData) : new TextEncoder().encode(fallback);

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename.replaceAll('"', "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
