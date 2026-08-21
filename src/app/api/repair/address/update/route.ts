import { z } from "zod";
import { CustomerTokenService } from "@/auth/customer-token";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { PiiCipher } from "@/security/pii-cipher";
import { canonicalAddress, verifyVerificationAssertion } from "@/verification/assertion";
import { postalAddressSchema } from "@/verification/schemas";

const schema = z.object({ token: z.string().min(1), address: postalAddressSchema, addressValidationToken: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter a complete US address." }, { status: 400 });
  const access = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).authenticate(parsed.data.token);
  if (!access) return Response.json({ error: "This secure request link is invalid or expired." }, { status: 401 });
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret || !verifyVerificationAssertion(parsed.data.addressValidationToken, "shipping_address", canonicalAddress(parsed.data.address), secret)) {
    return Response.json({ error: "Validate this shipping address again before saving it." }, { status: 403 });
  }
  const order = await prisma.replacementOrder.findFirst({ where: { id: access.replacementOrderId, customerId: access.customerId }, select: { id: true, encryptedShippingAddress: true, status: true } });
  if (!order) return Response.json({ error: "Request not found." }, { status: 404 });
  if (order.encryptedShippingAddress) return Response.json({ error: "A shipping address is already saved for this request. Contact Support to change it." }, { status: 409 });
  if (order.status === "closed") return Response.json({ error: "This request is already closed." }, { status: 409 });
  const encryptionKey = process.env.PII_ENCRYPTION_KEY;
  if (!encryptionKey) return Response.json({ error: "Shipping-address encryption is not configured." }, { status: 503 });
  const encryptedShippingAddress = new PiiCipher(encryptionKey).encrypt(JSON.stringify(parsed.data.address));
  await prisma.$transaction([
    prisma.replacementOrder.update({ where: { id: order.id }, data: { encryptedShippingAddress } }),
    prisma.conversationMessage.create({ data: { replacementOrderId: order.id, senderKind: "system", body: "Your shipping address was added securely. Support can now finish reviewing the request." } }),
    prisma.auditEvent.create({ data: { actorKind: "customer", action: "replacement_order.shipping_address_added", entityType: "replacement_order", entityId: order.id, metadata: { addressValidated: true } } }),
  ]);
  return Response.json({ ok: true });
}
