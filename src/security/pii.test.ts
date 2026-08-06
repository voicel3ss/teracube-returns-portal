import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AuditService, InMemoryAuditRepository } from "./audit";
import { PiiCipher } from "./pii-cipher";
import { maskPii, PiiAccessDeniedError, PiiRevealService } from "./pii";

describe("PII controls", () => {
  it("masks fields without exposing the complete value", () => {
    expect(maskPii("parent_email", "sarah@example.com")).toBe("s•••@example.com");
    expect(maskPii("child_phone", "+12065551234")).toBe("••••1234");
    expect(maskPii("parent_address", "123 Main Street")).toBe("••••••••");
  });

  it("hard-blocks repair-team reveals before loading the value", async () => {
    const repository = new InMemoryAuditRepository();
    const loadValue = vi.fn(async () => "sarah@example.com");
    const service = new PiiRevealService(new AuditService(repository));

    await expect(
      service.reveal({
        activeTeam: "repair",
        actorStaffId: "staff-1",
        field: "parent_email",
        entityType: "customer",
        entityId: "customer-1",
        loadValue,
      }),
    ).rejects.toBeInstanceOf(PiiAccessDeniedError);
    expect(loadValue).not.toHaveBeenCalled();
    expect(repository.events).toHaveLength(0);
  });

  it("audit-logs every permitted reveal without logging the revealed value", async () => {
    const repository = new InMemoryAuditRepository();
    const service = new PiiRevealService(new AuditService(repository, () => new Date("2026-08-06T10:00:00Z")));
    const value = await service.reveal({
      activeTeam: "support",
      actorStaffId: "staff-1",
      field: "parent_email",
      entityType: "customer",
      entityId: "customer-1",
      loadValue: async () => "sarah@example.com",
    });

    expect(value).toBe("sarah@example.com");
    expect(repository.events[0]).toMatchObject({
      action: "pii.revealed",
      actorStaffId: "staff-1",
      metadata: { field: "parent_email", activeTeam: "support" },
    });
    expect(JSON.stringify(repository.events[0])).not.toContain("sarah@example.com");
  });
});

describe("PII encryption", () => {
  it("round-trips authenticated ciphertext and rejects tampering", () => {
    const cipher = new PiiCipher(randomBytes(32).toString("base64"));
    const encrypted = cipher.encrypt("123 Main Street");
    expect(encrypted).not.toContain("Main Street");
    expect(cipher.decrypt(encrypted)).toBe("123 Main Street");

    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
    expect(() => cipher.decrypt(tampered)).toThrow();
  });
});
