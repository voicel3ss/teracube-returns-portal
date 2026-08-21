import type { PrismaClient } from "@/generated/prisma/client";
import type { CustomerTokenRepository, StoredCustomerToken } from "@/auth/customer-token";
import type { OtpRepository, StoredOtpChallenge } from "@/auth/otp";
import type { StaffSessionRepository, StoredStaffSession } from "@/auth/staff-session";

export class PrismaStaffSessionRepository implements StaffSessionRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(session: StoredStaffSession): Promise<void> {
    await this.client.staffSession.create({ data: session });
  }

  async findByTokenHash(tokenHash: string): Promise<StoredStaffSession | null> {
    const session = await this.client.staffSession.findUnique({ where: { tokenHash } });
    return session
      ? {
          ...session,
          revokedAt: session.revokedAt ?? undefined,
        }
      : null;
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.client.staffSession.update({ where: { id }, data: { revokedAt } });
  }
}

export class PrismaOtpRepository implements OtpRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(challenge: StoredOtpChallenge): Promise<void> {
    await this.client.otpChallenge.create({ data: challenge });
  }

  async findById(id: string): Promise<StoredOtpChallenge | null> {
    const challenge = await this.client.otpChallenge.findUnique({ where: { id } });
    return challenge
      ? {
          ...challenge,
          consumedAt: challenge.consumedAt ?? undefined,
        }
      : null;
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.client.otpChallenge.update({ where: { id }, data: { failedAttempts: { increment: 1 } } });
  }

  async consume(id: string, consumedAt: Date): Promise<boolean> {
    const consumed = await this.client.otpChallenge.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt },
    });
    return consumed.count === 1;
  }
}

export class PrismaCustomerTokenRepository implements CustomerTokenRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(token: StoredCustomerToken): Promise<void> {
    await this.client.customerAccessToken.create({ data: token });
  }

  async findByTokenHash(tokenHash: string): Promise<StoredCustomerToken | null> {
    const token = await this.client.customerAccessToken.findUnique({ where: { tokenHash } });
    return token
      ? {
          ...token,
          revokedAt: token.revokedAt ?? undefined,
        }
      : null;
  }
}
