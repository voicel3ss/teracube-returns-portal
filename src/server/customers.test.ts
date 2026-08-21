import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { consolidateCustomerForDevice } from "./customers";

function transaction(overrides: { emailCustomer?: { id: string; mergedIntoId: string | null } | null } = {}) {
  const anchor = { id: "anchor", mergedIntoId: null };
  const source = overrides.emailCustomer === undefined ? { id: "source", mergedIntoId: null } : overrides.emailCustomer;
  return {
    anchor,
    client: {
      customer: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => where.id === anchor.id ? anchor : null),
        update: vi.fn(async () => ({})),
        create: vi.fn(async () => anchor),
      },
      device: { findUnique: vi.fn(async () => ({ currentOwner: null })), updateMany: vi.fn(async () => ({ count: 0 })) },
      customerEmail: {
        findFirst: vi.fn(async () => source ? { customer: source } : null),
        updateMany: vi.fn(async () => ({ count: 0 })),
        create: vi.fn(async () => ({})),
      },
      replacementOrder: { updateMany: vi.fn(async () => ({ count: 0 })) },
      customerAccessToken: { updateMany: vi.fn(async () => ({ count: 0 })) },
      auditEvent: { create: vi.fn(async () => ({})) },
    },
  };
}

describe("customer consolidation for an active device request", () => {
  it("keeps the order customer as the survivor when a verified alternate email belongs elsewhere", async () => {
    const { anchor, client } = transaction();
    const survivor = await consolidateCustomerForDevice(client as unknown as Prisma.TransactionClient, {
      email: "alternate@myteracube.com",
      serial: "202112T2E235968",
      anchorCustomerId: anchor.id,
    });

    expect(survivor.id).toBe(anchor.id);
    expect(client.customerEmail.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customerId: anchor.id }) }));
    expect(client.replacementOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { customerId: "source" }, data: { customerId: anchor.id } }));
  });

  it("links a new alternate email directly to the order customer", async () => {
    const { anchor, client } = transaction({ emailCustomer: null });
    const survivor = await consolidateCustomerForDevice(client as unknown as Prisma.TransactionClient, {
      email: "new-parent@myteracube.com",
      serial: "202112T2E235968",
      anchorCustomerId: anchor.id,
    });

    expect(survivor.id).toBe(anchor.id);
    expect(client.customerEmail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: anchor.id, normalized: "new-parent@myteracube.com", isPrimary: false }),
    });
  });
});
