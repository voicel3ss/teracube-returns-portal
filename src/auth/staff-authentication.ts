import type { StaffSessionService } from "./staff-session";
import type { OtpService } from "./otp";

export type StaffDirectoryUser = { id: string; email: string; active: boolean };

export interface StaffDirectory {
  findByEmail(normalizedEmail: string): Promise<StaffDirectoryUser | null>;
  linkGoogleIdentity(staffUserId: string, subject: string): Promise<void>;
}

export interface OtpDeliveryProvider {
  deliver(input: { email: string; code: string; expiresAt: Date }): Promise<void>;
}

export interface GoogleIdentityVerifier {
  verify(idToken: string): Promise<{ email: string; subject: string } | null>;
}

export class StaffAuthenticationService {
  constructor(
    private readonly directory: StaffDirectory,
    private readonly sessions: StaffSessionService,
    private readonly otp: OtpService,
    private readonly otpDelivery: OtpDeliveryProvider,
    private readonly google: GoogleIdentityVerifier,
  ) {}

  async requestOtp(email: string): Promise<{ accepted: true; challengeId?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const staffUser = await this.directory.findByEmail(normalizedEmail);

    // Always return accepted so this endpoint cannot enumerate staff accounts.
    if (!staffUser?.active) return { accepted: true };

    const challenge = await this.otp.issue(normalizedEmail, "staff_login");
    await this.otpDelivery.deliver({ email: normalizedEmail, code: challenge.code, expiresAt: challenge.expiresAt });
    return { accepted: true, challengeId: challenge.challengeId };
  }

  async completeOtp(input: { challengeId: string; email: string; code: string }) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const verified = await this.otp.verify(input.challengeId, normalizedEmail, input.code, "staff_login");
    if (!verified) return null;
    const staffUser = await this.directory.findByEmail(normalizedEmail);
    if (!staffUser?.active) return null;
    return this.sessions.create(staffUser.id);
  }

  async completeGoogle(idToken: string) {
    const identity = await this.google.verify(idToken);
    if (!identity) return null;
    const staffUser = await this.directory.findByEmail(identity.email.trim().toLowerCase());
    if (!staffUser?.active) return null;
    await this.directory.linkGoogleIdentity(staffUser.id, identity.subject);
    return this.sessions.create(staffUser.id);
  }
}

export class MockOtpDeliveryProvider implements OtpDeliveryProvider {
  readonly deliveries: Array<{ email: string; code: string; expiresAt: Date }> = [];

  async deliver(input: { email: string; code: string; expiresAt: Date }): Promise<void> {
    this.deliveries.push(structuredClone(input));
  }
}

export class MockGoogleIdentityVerifier implements GoogleIdentityVerifier {
  constructor(private readonly identitiesByToken: ReadonlyMap<string, { email: string; subject: string }>) {}

  async verify(idToken: string): Promise<{ email: string; subject: string } | null> {
    return this.identitiesByToken.get(idToken) ?? null;
  }
}
