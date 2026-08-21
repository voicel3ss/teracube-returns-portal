import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CustomerTokenService } from "@/auth/customer-token";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { mockHelpdeskProvider } from "@/integrations/mocks/device-care";
import { decodePhotoUploads, PhotoUploadError } from "@/lib/photo-upload";
import { findOrCreateCustomer } from "@/server/customers";
import { identificationHelpMessage } from "@/domain/customer-notifications";
import { normalizeEmail, verifyVerificationAssertion } from "@/verification/assertion";
import { customerEmailSchema } from "@/verification/schemas";

const photoSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().max(7_000_000),
});

const schema = z.object({
  parentEmail: customerEmailSchema,
  emailVerificationToken: z.string().min(1),
  lookupType: z.enum(["serial", "phone"]),
  identifier: z.string().trim().min(3).max(100),
  message: z.string().trim().max(2000).optional().default(""),
  photos: z.array(photoSchema).max(3).default([]),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid parent email." }, { status: 400 });

  const verificationSecret = process.env.AUTH_TOKEN_SECRET;
  if (!verificationSecret) return Response.json({ error: "Email verification is not configured." }, { status: 503 });
  const normalizedEmail = normalizeEmail(parsed.data.parentEmail);
  if (
    !verifyVerificationAssertion(
      parsed.data.emailVerificationToken,
      "customer_email",
      normalizedEmail,
      verificationSecret,
    )
  ) {
    return Response.json({ error: "Verify this email address before asking support for help." }, { status: 403 });
  }

  let attachments;
  try {
    attachments = decodePhotoUploads(parsed.data.photos);
  } catch (error) {
    if (error instanceof PhotoUploadError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const orderId = randomUUID();
  const ticket = await mockHelpdeskProvider.createOrderTicket({
    orderId,
    customerEmail: normalizedEmail,
    subject: "Help identifying a Teracube device",
  });

  const order = await prisma.$transaction(async (transaction) => {
    const customer = await findOrCreateCustomer(transaction, normalizedEmail);
    const created = await transaction.replacementOrder.create({
      data: {
        id: orderId,
        customer: { connect: { id: customer.id } },
        status: "unidentified",
        approvalState: "auto_approved",
        reviewState: "needs_clarification",
        communicationTicketId: ticket.ticketId,
        submittedAt: new Date(),
      },
    });
    await transaction.workItem.create({
      data: {
        replacementOrderId: created.id,
        team: "support",
        kind: "unidentified_device",
      },
    });
    const attemptedIdentifier = parsed.data.lookupType === "serial" ? `Attempted device serial: ${parsed.data.identifier.toUpperCase()}` : `Attempted child phone: ${parsed.data.identifier}`;
    const customerContext = parsed.data.message || (parsed.data.photos.length ? "Photos supplied to help identify the device." : "The customer could not identify the device during intake.");
    await transaction.conversationMessage.create({
      data: {
        replacementOrderId: created.id,
        senderKind: "customer",
        body: `${attemptedIdentifier}\n\n${customerContext}`,
        attachments: { create: attachments },
      },
    });
    await transaction.conversationMessage.create({
      data: {
        replacementOrderId: created.id,
        senderKind: "system",
        body: identificationHelpMessage(),
      },
    });
    await transaction.auditEvent.create({
      data: {
        actorKind: "customer",
        action: "replacement_order.identification_help_requested",
        entityType: "replacement_order",
        entityId: created.id,
        metadata: { emailVerified: true, lookupType: parsed.data.lookupType, identifierProvided: true, contextProvided: Boolean(parsed.data.message), attachments: parsed.data.photos.length },
      },
    });
    return { ...created, customerId: customer.id };
  });

  const tokenService = new CustomerTokenService(new PrismaCustomerTokenRepository(prisma));
  const access = await tokenService.issue({ customerId: order.customerId, replacementOrderId: order.id });
  return Response.json(
    {
      orderNumber: order.orderNumber,
      accessToken: access.token,
      trackingUrl: `/repair/track?token=${encodeURIComponent(access.token)}`,
    },
    { status: 201 },
  );
}
