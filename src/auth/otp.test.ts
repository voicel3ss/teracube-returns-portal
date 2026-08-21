import { describe, expect, it } from "vitest";
import { InMemoryOtpRepository, OtpService } from "./otp";

function service() {
  return new OtpService(
    new InMemoryOtpRepository(),
    "a-secure-test-secret-that-is-long-enough",
    () => new Date("2026-08-21T12:00:00Z"),
    () => "482913",
  );
}

describe("one-time codes", () => {
  it("accepts a valid code only once", async () => {
    const otp = service();
    const challenge = await otp.issue("agent@myteracube.com");
    expect(await otp.verify(challenge.challengeId, "agent@myteracube.com", "482913")).toBe(true);
    expect(await otp.verify(challenge.challengeId, "agent@myteracube.com", "482913")).toBe(false);
  });

  it("allows only one of two simultaneous valid submissions to consume the code", async () => {
    const otp = service();
    const challenge = await otp.issue("agent@myteracube.com");
    const results = await Promise.all([
      otp.verify(challenge.challengeId, "agent@myteracube.com", "482913"),
      otp.verify(challenge.challengeId, "agent@myteracube.com", "482913"),
    ]);
    expect(results.sort()).toEqual([false, true]);
  });
});
