import { z } from "zod";
import { CustomerTokenService } from "@/auth/customer-token";
import { verifyCustomerEntry } from "@/auth/customer-entry";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { parseTeracubeSerial } from "@/domain/serial-number";
import { mockIdentityProvider, mockPlanProvider } from "@/integrations/mocks/device-care";
import { consolidateCustomerForDevice } from "@/server/customers";
import { issueVerificationAssertion, normalizeEmail, verifyVerificationAssertion } from "@/verification/assertion";
import { customerEmailSchema } from "@/verification/schemas";

const identifySchema = z
  .object({
    serial: z.string().trim().optional(),
    childPhone: z.string().trim().optional(),
    parentAppEntry: z.string().trim().optional(),
    parentEmail: customerEmailSchema.optional(),
    emailVerificationToken: z.string().min(1).optional(),
  })
  .refine((value) => value.serial || value.childPhone || value.parentAppEntry, {
    message: "Enter a serial number or child phone number.",
  });

export async function POST(request: Request) {
  const parsed = identifySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid lookup." }, { status: 400 });
  }

  let lookup = parsed.data;
  let trustedParentEmail: string | undefined;

  if (parsed.data.parentAppEntry) {
    const secret = process.env.AUTH_TOKEN_SECRET;
    const appEntry = secret ? verifyCustomerEntry(parsed.data.parentAppEntry, secret) : null;
    if (!appEntry) return Response.json({ error: "This secure customer link is invalid or expired." }, { status: 401 });
    lookup = { serial: appEntry.serial };
    trustedParentEmail = appEntry.parentEmail;
  }

  const identity = await mockIdentityProvider.resolveDevice(lookup);
  if (!identity) return Response.json({ status: "unidentified" });

  const models = await prisma.deviceModel.findMany({ where: { active: true } });
  const serial = parseTeracubeSerial(identity.serial, models);
  if (!serial.ok) return Response.json({ status: "unidentified" });

  const model = models.find((candidate) => candidate.id === serial.value.modelId)!;
  const plan = await mockPlanProvider.getPlanByIccid(identity.iccid);

  let verifiedParentEmail = trustedParentEmail ? normalizeEmail(trustedParentEmail) : undefined;
  if (parsed.data.parentEmail && parsed.data.emailVerificationToken) {
    const secret = process.env.AUTH_TOKEN_SECRET;
    const normalizedEmail = normalizeEmail(parsed.data.parentEmail);
    if (!secret || !verifyVerificationAssertion(parsed.data.emailVerificationToken, "customer_email", normalizedEmail, secret)) {
      return Response.json({ error: "Verify this email address again before checking the request." }, { status: 403 });
    }
    verifiedParentEmail = normalizedEmail;
  }
  if (verifiedParentEmail) {
    const activeOrder = await prisma.replacementOrder.findFirst({
      where: { returnedDeviceSerial: serial.value.serial, status: { not: "closed" } },
      orderBy: { createdAt: "desc" },
    });
    if (activeOrder) {
      const customer = await prisma.$transaction((transaction) =>
        consolidateCustomerForDevice(transaction, { email: verifiedParentEmail, serial: serial.value.serial }),
      );
      const access = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).issue({
        customerId: customer.id,
        replacementOrderId: activeOrder.id,
      });
      return Response.json({
        status: "active_request",
        orderNumber: activeOrder.orderNumber,
        trackingUrl: `/repair/track?token=${encodeURIComponent(access.token)}`,
      });
    }
  }

  const secret = process.env.AUTH_TOKEN_SECRET;
  return Response.json({
    status: "identified",
    device: {
      serial: serial.value.serial,
      modelId: model.id,
      modelName: model.name,
      deviceType: model.deviceType,
      manufactured: `${serial.value.manufacturedYear}-${String(serial.value.manufacturedMonth).padStart(2, "0")}`,
      iccidMasked: `••••${identity.iccid.slice(-4)}`,
    },
    plan: plan ? { status: plan.status } : null,
    parentEmail: trustedParentEmail,
    emailVerificationToken: trustedParentEmail && secret ? issueVerificationAssertion("customer_email", normalizeEmail(trustedParentEmail), secret) : undefined,
  });
}
