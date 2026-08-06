import { describe, expect, it } from "vitest";
import { InMemoryOtpRepository, OtpService } from "./otp";
import {
  MockGoogleIdentityVerifier,
  MockOtpDeliveryProvider,
  StaffAuthenticationService,
  type StaffDirectory,
  type StaffDirectoryUser,
} from "./staff-authentication";
import { InMemoryStaffSessionRepository, StaffSessionService } from "./staff-session";

class InMemoryStaffDirectory implements StaffDirectory {
  readonly linkedIdentities: Array<{ staffUserId: string; subject: string }> = [];

  constructor(private readonly users: StaffDirectoryUser[]) {}

  async findByEmail(normalizedEmail: string): Promise<StaffDirectoryUser | null> {
    return this.users.find((user) => user.email === normalizedEmail) ?? null;
  }

  async linkGoogleIdentity(staffUserId: string, subject: string): Promise<void> {
    this.linkedIdentities.push({ staffUserId, subject });
  }
}

function setup() {
  const now = () => new Date("2026-08-06T10:00:00Z");
  const directory = new InMemoryStaffDirectory([
    { id: "staff-1", email: "agent@myteracube.com", active: true },
    { id: "staff-2", email: "former@myteracube.com", active: false },
  ]);
  const otp = new OtpService(
    new InMemoryOtpRepository(),
    "a-secure-test-secret-that-is-long-enough",
    now,
    () => "482913",
  );
  const delivery = new MockOtpDeliveryProvider();
  const sessions = new StaffSessionService(new InMemoryStaffSessionRepository(), now);
  const google = new MockGoogleIdentityVerifier(
    new Map([["valid-google-token", { email: "agent@myteracube.com", subject: "google-subject-1" }]]),
  );
  return {
    directory,
    delivery,
    service: new StaffAuthenticationService(directory, sessions, otp, delivery, google),
  };
}

describe("staff authentication orchestration", () => {
  it("delivers an OTP only for active staff and creates a session after verification", async () => {
    const { delivery, service } = setup();
    const requested = await service.requestOtp("AGENT@myteracube.com");
    expect(delivery.deliveries).toHaveLength(1);
    expect(delivery.deliveries[0].code).toBe("482913");

    const session = await service.completeOtp({
      challengeId: requested.challengeId!,
      email: "agent@myteracube.com",
      code: "482913",
    });
    expect(session?.token).toBeTruthy();
  });

  it("does not reveal whether an unknown or inactive staff account exists", async () => {
    const { delivery, service } = setup();
    await expect(service.requestOtp("unknown@myteracube.com")).resolves.toEqual({ accepted: true });
    await expect(service.requestOtp("former@myteracube.com")).resolves.toEqual({ accepted: true });
    expect(delivery.deliveries).toHaveLength(0);
  });

  it("accepts a verified mocked Google identity and links it to the staff record", async () => {
    const { directory, service } = setup();
    const session = await service.completeGoogle("valid-google-token");
    expect(session?.token).toBeTruthy();
    expect(directory.linkedIdentities).toEqual([{ staffUserId: "staff-1", subject: "google-subject-1" }]);
  });
});
