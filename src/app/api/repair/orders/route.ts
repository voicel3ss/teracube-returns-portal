import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CustomerTokenService } from "@/auth/customer-token";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { inferCoverage } from "@/domain/repair-intake";
import { parseTeracubeSerial } from "@/domain/serial-number";
import { mockCommerceProvider, mockHelpdeskProvider } from "@/integrations/mocks/device-care";
import { decodePhotoUploads, PhotoUploadError } from "@/lib/photo-upload";
import { PiiCipher } from "@/security/pii-cipher";
import { consolidateCustomerForDevice } from "@/server/customers";
import { orderSubmittedMessage } from "@/domain/customer-notifications";
import {
  canonicalAddress,
  normalizeEmail,
  verifyVerificationAssertion,
} from "@/verification/assertion";
import { customerEmailSchema, postalAddressSchema } from "@/verification/schemas";

const faultCategories = [
  "screen",
  "charging",
  "camera",
  "calls_cellular",
  "battery",
  "buttons",
  "water_damage",
  "other",
] as const;

const photoSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().max(7_000_000),
});

const orderSchema = z.object({
  parentEmail: customerEmailSchema,
  emailVerificationToken: z.string().min(1),
  serial: z.string().trim(),
  modelId: z.string().uuid(),
  faultCategory: z.enum(faultCategories),
  faultText: z.string().trim().min(3).max(1000),
  processTypeId: z.string().uuid(),
  shippingAddress: postalAddressSchema,
  addressValidationToken: z.string().min(1),
  photos: z.array(photoSchema).max(3).default([]),
});

class ActiveOrderConflictError extends Error {}

export async function POST(request: Request) {
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid order details." }, { status: 400 });
  }

  const verificationSecret = process.env.AUTH_TOKEN_SECRET;
  if (!verificationSecret) return Response.json({ error: "Customer verification is not configured." }, { status: 503 });

  const normalizedEmail = normalizeEmail(parsed.data.parentEmail);
  if (
    !verifyVerificationAssertion(
      parsed.data.emailVerificationToken,
      "customer_email",
      normalizedEmail,
      verificationSecret,
    )
  ) {
    return Response.json({ error: "Verify this email address again before submitting." }, { status: 403 });
  }
  if (
    !verifyVerificationAssertion(
      parsed.data.addressValidationToken,
      "shipping_address",
      canonicalAddress(parsed.data.shippingAddress),
      verificationSecret,
    )
  ) {
    return Response.json({ error: "Validate this shipping address again before submitting." }, { status: 403 });
  }

  const models = await prisma.deviceModel.findMany({ where: { active: true } });
  const serialResult = parseTeracubeSerial(parsed.data.serial, models);
  if (!serialResult.ok || serialResult.value.modelId !== parsed.data.modelId) {
    return Response.json({ error: "The device serial no longer matches the selected model." }, { status: 409 });
  }

  const coverage = inferCoverage(parsed.data.faultCategory, parsed.data.faultText);
  const processType = await prisma.processType.findFirst({
    where: {
      id: parsed.data.processTypeId,
      active: true,
      slug: { startsWith: `${coverage}-` },
      modelMappings: { some: { modelId: parsed.data.modelId } },
    },
  });
  if (!processType) return Response.json({ error: "That replacement option is no longer available." }, { status: 409 });

  const encryptionKey = process.env.PII_ENCRYPTION_KEY;
  if (!encryptionKey) return Response.json({ error: "Shipping-address encryption is not configured." }, { status: 503 });

  const customer = await prisma.$transaction((transaction) =>
    consolidateCustomerForDevice(transaction, { email: normalizedEmail, serial: serialResult.value.serial }),
  );
  const activeOrder = await prisma.replacementOrder.findFirst({
    where: { returnedDeviceSerial: serialResult.value.serial, status: { not: "closed" } },
    orderBy: { createdAt: "desc" },
  });
  if (activeOrder) {
    const access = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).issue({
      customerId: customer.id,
      replacementOrderId: activeOrder.id,
    });
    const trackingUrl = `/repair/track?token=${encodeURIComponent(access.token)}`;
    await prisma.auditEvent.create({
      data: {
        actorKind: "customer",
        action: "replacement_order.duplicate_prevented",
        entityType: "replacement_order",
        entityId: activeOrder.id,
        metadata: { serial: serialResult.value.serial, alternateEmailVerified: true },
      },
    });
    return Response.json(
      {
        code: "ACTIVE_REQUEST_EXISTS",
        error: `A replacement request is already in progress for this device (order #${String(activeOrder.orderNumber).padStart(4, "0")}).`,
        orderNumber: activeOrder.orderNumber,
        trackingUrl,
      },
      { status: 409 },
    );
  }

  let attachments;
  try {
    attachments = decodePhotoUploads(parsed.data.photos);
  } catch (error) {
    if (error instanceof PhotoUploadError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const orderId = randomUUID();
  const cipher = new PiiCipher(encryptionKey);
  const encryptedAddress = cipher.encrypt(JSON.stringify(parsed.data.shippingAddress));

  let order;
  try {
    order = await prisma.$transaction(async (transaction) => {
      await transaction.device.upsert({
        where: { serial: serialResult.value.serial },
        update: { modelId: parsed.data.modelId, currentOwnerId: customer.id },
        create: {
          serial: serialResult.value.serial,
          modelId: parsed.data.modelId,
          currentOwnerId: customer.id,
          grade: "new",
          circulationState: "deployed",
        },
      });
      const concurrentOrder = await transaction.replacementOrder.findFirst({ where: { returnedDeviceSerial: serialResult.value.serial, status: { not: "closed" } }, select: { id: true } });
      if (concurrentOrder) throw new ActiveOrderConflictError();
      const checkout = await mockCommerceProvider.createCheckout({
        orderId,
        fee: { amountInCents: processType.feeInCents, currency: "USD" },
        deposit: { amountInCents: processType.depositInCents, currency: "USD" },
        customerEmail: normalizedEmail,
      });
      const ticket = await mockHelpdeskProvider.createOrderTicket({
        orderId,
        customerEmail: normalizedEmail,
        subject: "Teracube replacement request",
      });

      const created = await transaction.replacementOrder.create({
        data: {
        id: orderId,
        customerId: customer.id,
        processTypeId: processType.id,
        returnedDeviceSerial: serialResult.value.serial,
        status: "awaiting_verification",
        approvalState: "auto_approved",
        reviewState: "unreviewed",
        customerFaultCategory: parsed.data.faultCategory,
        customerFaultText: parsed.data.faultText,
        communicationTicketId: ticket.ticketId,
        paymentReference: checkout.checkoutId,
        amountPaidInCents: processType.feeInCents + processType.depositInCents,
        quotedFeeInCents: processType.feeInCents,
        quotedDepositInCents: processType.depositInCents,
        encryptedShippingAddress: encryptedAddress,
        submittedAt: new Date(),
        },
      });

      await transaction.workItem.create({
      data: {
        replacementOrderId: created.id,
        team: "support",
        kind: "claim_verification",
      },
      });

      await transaction.conversationMessage.create({
      data: {
        replacementOrderId: created.id,
        senderKind: "customer",
        body: parsed.data.faultText,
        attachments: { create: attachments },
      },
      });

      await transaction.conversationMessage.create({
        data: {
          replacementOrderId: created.id,
          senderKind: "system",
          body: orderSubmittedMessage(processType.feeInCents + processType.depositInCents),
        },
      });

      await transaction.auditEvent.create({
      data: {
        actorKind: "customer",
        action: "replacement_order.submitted",
        entityType: "replacement_order",
        entityId: created.id,
        metadata: {
          entry: "customer_portal",
          coverage,
          flow: processType.flow,
          emailVerified: true,
          addressValidated: true,
        },
      },
      });
      return { ...created, customerId: customer.id, communicationTicketId: ticket.ticketId };
    });
  } catch (error) {
    if (!(error instanceof ActiveOrderConflictError)) throw error;
    const concurrentOrder = await prisma.replacementOrder.findFirst({ where: { returnedDeviceSerial: serialResult.value.serial, status: { not: "closed" } }, orderBy: { createdAt: "desc" } });
    if (!concurrentOrder) return Response.json({ error: "Another request changed this device. Please try again." }, { status: 409 });
    const access = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).issue({ customerId: customer.id, replacementOrderId: concurrentOrder.id });
    return Response.json({ code: "ACTIVE_REQUEST_EXISTS", error: `A replacement request is already in progress for this device (order #${String(concurrentOrder.orderNumber).padStart(4, "0")}).`, orderNumber: concurrentOrder.orderNumber, trackingUrl: `/repair/track?token=${encodeURIComponent(access.token)}` }, { status: 409 });
  }

  await mockHelpdeskProvider.reply({
    ticketId: order.communicationTicketId!,
    body: `We received Teracube replacement order #${order.orderNumber}.`,
  });

  const tokenService = new CustomerTokenService(new PrismaCustomerTokenRepository(prisma));
  const access = await tokenService.issue({ customerId: order.customerId, replacementOrderId: order.id });

  return Response.json(
    {
      orderNumber: order.orderNumber,
      status: order.status,
      amountPaidInCents: order.amountPaidInCents,
      accessToken: access.token,
      trackingUrl: `/repair/track?token=${encodeURIComponent(access.token)}`,
    },
    { status: 201 },
  );
}
