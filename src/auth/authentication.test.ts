import { describe, expect, it } from "vitest";
import { CustomerTokenService, InMemoryCustomerTokenRepository } from "./customer-token";
import { InMemoryOtpRepository, OtpService } from "./otp";
import { InMemoryStaffSessionRepository, StaffSessionService } from "./staff-session";

const NOW = new Date("2026-08-06T10:00:00.000Z");

describe("staff sessions", () => {
  it("stores only a hash and authenticates the opaque token for 30 days", async () => {
    const repository = new InMemoryStaffSessionRepository();
    const service = new StaffSessionService(repository, () => NOW);
    const issued = await service.create("staff-1");
    const stored = [...repository.sessions.values()][0];

    expect(stored.tokenHash).not.toContain(issued.token);
    await expect(service.authenticate(issued.token)).resolves.toEqual({ staffUserId: "staff-1", sessionId: stored.id });
    expect(issued.expiresAt).toEqual(new Date("2026-09-05T10:00:00.000Z"));
  });

  it("rejects expired and revoked sessions", async () => {
    let now = NOW;
    const repository = new InMemoryStaffSessionRepository();
    const service = new StaffSessionService(repository, () => now);
    const first = await service.create("staff-1");
    await service.revoke(first.token);
    await expect(service.authenticate(first.token)).resolves.toBeNull();

    const second = await service.create("staff-1");
    now = new Date("2026-09-06T10:00:00.000Z");
    await expect(service.authenticate(second.token)).resolves.toBeNull();
  });
});

describe("email OTP", () => {
  it("normalizes email, consumes a correct code once, and never stores the code", async () => {
    const repository = new InMemoryOtpRepository();
    const service = new OtpService(repository, "a-secure-test-secret-that-is-long-enough", () => NOW, () => "482913");
    const issued = await service.issue(" Agent@Teracube.com ");
    const stored = repository.challenges.get(issued.challengeId)!;

    expect(stored.normalizedEmail).toBe("agent@teracube.com");
    expect(stored.codeHash).not.toContain("482913");
    await expect(service.verify(issued.challengeId, "agent@teracube.com", "482913")).resolves.toBe(true);
    await expect(service.verify(issued.challengeId, "agent@teracube.com", "482913")).resolves.toBe(false);
  });

  it("locks a challenge after five incorrect attempts", async () => {
    const repository = new InMemoryOtpRepository();
    const service = new OtpService(repository, "a-secure-test-secret-that-is-long-enough", () => NOW, () => "482913");
    const issued = await service.issue("agent@teracube.com");
    for (let index = 0; index < 5; index += 1) {
      await service.verify(issued.challengeId, "agent@teracube.com", "000000");
    }
    await expect(service.verify(issued.challengeId, "agent@teracube.com", "482913")).resolves.toBe(false);
  });

  it("does not allow a customer verification code to authenticate staff", async () => {
    const repository = new InMemoryOtpRepository();
    const service = new OtpService(repository, "a-secure-test-secret-that-is-long-enough", () => NOW, () => "482913");
    const issued = await service.issue("agent@teracube.com", "customer_email");

    await expect(
      service.verify(issued.challengeId, "agent@teracube.com", "482913", "staff_login"),
    ).resolves.toBe(false);
    await expect(
      service.verify(issued.challengeId, "agent@teracube.com", "482913", "customer_email"),
    ).resolves.toBe(true);
  });
});

describe("customer access tokens", () => {
  it("is scoped to one customer and one replacement order", async () => {
    const service = new CustomerTokenService(new InMemoryCustomerTokenRepository(), () => NOW);
    const issued = await service.issue({ customerId: "customer-1", replacementOrderId: "order-1" });
    await expect(service.authenticate(issued.token)).resolves.toEqual({
      customerId: "customer-1",
      replacementOrderId: "order-1",
    });
  });
});
