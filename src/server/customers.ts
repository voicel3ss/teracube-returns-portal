import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export async function findOrCreateCustomer(client: PrismaClient | Prisma.TransactionClient, email: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await client.customerEmail.findFirst({
    where: { normalized },
    include: { customer: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.customer;

  return client.customer.create({
    data: {
      emails: {
        create: { email: email.trim(), normalized, isPrimary: true },
      },
    },
  });
}
