import { z } from "zod";
import { CustomerTokenService } from "@/auth/customer-token";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";

const photoSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().max(7_000_000),
});
const schema = z.object({ token: z.string().min(1), message: z.string().trim().min(2).max(2000), photos: z.array(photoSchema).max(3).default([]) });

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const access = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).authenticate(token);
  if (!access) return Response.json({ error: "This secure link is invalid or expired." }, { status: 401 });
  const messages = await prisma.conversationMessage.findMany({
    where: { replacementOrderId: access.replacementOrderId },
    include: { attachments: true },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ messages: messages.map((message) => ({
    id: message.id,
    senderKind: message.senderKind,
    body: message.body,
    sentAt: message.createdAt.toISOString(),
    photos: message.attachments.map((photo) => ({ id: photo.id, name: photo.filename, dataUrl: `data:${photo.contentType};base64,${Buffer.from(photo.data).toString("base64")}` })),
  })) });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid reply." }, { status: 400 });
  const access = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).authenticate(parsed.data.token);
  if (!access) return Response.json({ error: "This secure link is invalid or expired." }, { status: 401 });

  const order = await prisma.replacementOrder.findUnique({
    where: { id: access.replacementOrderId },
    select: {
      reviewState: true,
      workItems: { where: { team: "support", status: { not: "completed" } }, select: { id: true } },
    },
  });
  if (!order) return Response.json({ error: "Request not found." }, { status: 404 });

  const attachments = parsed.data.photos.map((photo) => {
    const data = Buffer.from(photo.data, "base64");
    if (data.byteLength > 5_000_000) throw new Error("Each photo must be 5 MB or smaller.");
    return { filename: photo.name, contentType: photo.type, byteSize: data.byteLength, data };
  });
  await prisma.$transaction(async (tx) => {
    await tx.conversationMessage.create({ data: { replacementOrderId: access.replacementOrderId, senderKind: "customer", body: parsed.data.message, attachments: { create: attachments } } });

    // A reply only advances a claim that was explicitly waiting on clarification.
    // Routine customer messages must not reopen a reviewed verification gate.
    if (order.reviewState === "needs_clarification") {
      await tx.replacementOrder.update({ where: { id: access.replacementOrderId }, data: { reviewState: "unreviewed" } });
    }

    if (order.workItems.length > 0) {
      await tx.workItem.updateMany({
        where: { replacementOrderId: access.replacementOrderId, team: "support", status: { not: "completed" } },
        data: { lastActivityAt: new Date(), snoozedUntil: null },
      });
      if (order.reviewState === "needs_clarification") {
        await tx.workItem.updateMany({
          where: { replacementOrderId: access.replacementOrderId, team: "support", kind: "needs_clarification", status: { not: "completed" } },
          data: { status: "open", snoozedUntil: null, lastActivityAt: new Date() },
        });
      }
    } else {
      await tx.workItem.upsert({
        where: { replacementOrderId_kind: { replacementOrderId: access.replacementOrderId, kind: "needs_clarification" } },
        update: { status: "open", assignedToStaffId: null, snoozedUntil: null, lastActivityAt: new Date() },
        create: { replacementOrderId: access.replacementOrderId, team: "support", kind: "needs_clarification", status: "open" },
      });
    }

    await tx.auditEvent.create({ data: { actorKind: "customer", action: "replacement_order.customer_replied", entityType: "replacement_order", entityId: access.replacementOrderId, metadata: { attachments: attachments.length, answeredClarification: order.reviewState === "needs_clarification" } } });
  });
  return Response.json({ ok: true });
}
