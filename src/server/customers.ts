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

export async function consolidateCustomerForDevice(
  client: Prisma.TransactionClient,
  input: { email: string; serial: string; anchorCustomerId?: string },
) {
  const normalized = input.email.trim().toLowerCase();
  const [anchorCustomer, device, emailRecord] = await Promise.all([
    input.anchorCustomerId ? client.customer.findUnique({ where: { id: input.anchorCustomerId } }) : null,
    client.device.findUnique({ where: { serial: input.serial }, include: { currentOwner: true } }),
    client.customerEmail.findFirst({
      where: { normalized },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  let survivor = anchorCustomer ?? device?.currentOwner ?? emailRecord?.customer ?? null;
  if (survivor?.mergedIntoId) {
    survivor = await client.customer.findUnique({ where: { id: survivor.mergedIntoId } });
  }
  if (!survivor) return findOrCreateCustomer(client, input.email);

  const source = emailRecord?.customer;
  if (source && source.id !== survivor.id) {
    await client.customerEmail.updateMany({ where: { customerId: source.id }, data: { customerId: survivor.id, isPrimary: false } });
    await client.device.updateMany({ where: { currentOwnerId: source.id }, data: { currentOwnerId: survivor.id } });
    await client.replacementOrder.updateMany({ where: { customerId: source.id }, data: { customerId: survivor.id } });
    await client.customerAccessToken.updateMany({ where: { customerId: source.id }, data: { customerId: survivor.id } });
    await client.customer.update({ where: { id: source.id }, data: { mergedIntoId: survivor.id, mergedAt: new Date() } });
    await client.auditEvent.create({
      data: {
        actorKind: "system",
        action: "customer.automatically_merged_by_device",
        entityType: "customer",
        entityId: survivor.id,
        metadata: { sourceCustomerId: source.id, survivorCustomerId: survivor.id, serial: input.serial },
      },
    });
  } else if (!emailRecord) {
    await client.customerEmail.create({
      data: { customerId: survivor.id, email: input.email.trim(), normalized, isPrimary: false },
    });
    await client.auditEvent.create({
      data: {
        actorKind: "system",
        action: "customer.email_linked_by_device",
        entityType: "customer",
        entityId: survivor.id,
        metadata: { serial: input.serial },
      },
    });
  }

  return survivor;
}
