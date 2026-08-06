import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CustomerTokenService } from "@/auth/customer-token";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { mockHelpdeskProvider } from "@/integrations/mocks/device-care";
import { findOrCreateCustomer } from "@/server/customers";
import { normalizeEmail, verifyVerificationAssertion } from "@/verification/assertion";
import { customerEmailSchema } from "@/verification/schemas";

const schema = z.object({
  parentEmail: customerEmailSchema,
  emailVerificationToken: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
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
    await transaction.auditEvent.create({
      data: {
        actorKind: "customer",
        action: "replacement_order.identification_help_requested",
        entityType: "replacement_order",
        entityId: created.id,
        metadata: { emailVerified: true },
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
