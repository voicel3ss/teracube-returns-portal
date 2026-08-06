import { randomInt, randomUUID } from "node:crypto";
import { hashesMatch, hashOneTimeCode } from "./secure-token";

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type OtpPurpose = "staff_login" | "customer_email";

export type StoredOtpChallenge = {
  id: string;
  normalizedEmail: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  consumedAt?: Date;
  failedAttempts: number;
  createdAt: Date;
};

export interface OtpRepository {
  create(challenge: StoredOtpChallenge): Promise<void>;
  findById(id: string): Promise<StoredOtpChallenge | null>;
  recordFailedAttempt(id: string): Promise<void>;
  consume(id: string, consumedAt: Date): Promise<void>;
}

export class OtpService {
  constructor(
    private readonly repository: OtpRepository,
    private readonly secret: string,
    private readonly now: () => Date = () => new Date(),
    private readonly codeGenerator: () => string = () => randomInt(100000, 1000000).toString(),
  ) {
    if (secret.length < 32) throw new Error("OTP secret must be at least 32 characters.");
  }

  async issue(
    email: string,
    purpose: OtpPurpose = "staff_login",
  ): Promise<{ challengeId: string; code: string; expiresAt: Date }> {
    const normalizedEmail = email.trim().toLowerCase();
    const id = randomUUID();
    const code = this.codeGenerator();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + OTP_LIFETIME_MS);

    await this.repository.create({
      id,
      normalizedEmail,
      purpose,
      codeHash: hashOneTimeCode(this.secret, id, normalizedEmail, code),
      expiresAt,
      failedAttempts: 0,
      createdAt,
    });

    return { challengeId: id, code, expiresAt };
  }

  async verify(
    challengeId: string,
    email: string,
    code: string,
    purpose: OtpPurpose = "staff_login",
  ): Promise<boolean> {
    const challenge = await this.repository.findById(challengeId);
    const normalizedEmail = email.trim().toLowerCase();

    if (
      !challenge ||
      challenge.normalizedEmail !== normalizedEmail ||
      challenge.purpose !== purpose ||
      challenge.consumedAt ||
      challenge.expiresAt <= this.now() ||
      challenge.failedAttempts >= MAX_ATTEMPTS
    ) {
      return false;
    }

    const suppliedHash = hashOneTimeCode(this.secret, challenge.id, normalizedEmail, code);
    if (!hashesMatch(challenge.codeHash, suppliedHash)) {
      await this.repository.recordFailedAttempt(challenge.id);
      return false;
    }

    await this.repository.consume(challenge.id, this.now());
    return true;
  }
}

export class InMemoryOtpRepository implements OtpRepository {
  readonly challenges = new Map<string, StoredOtpChallenge>();

  async create(challenge: StoredOtpChallenge): Promise<void> {
    this.challenges.set(challenge.id, structuredClone(challenge));
  }

  async findById(id: string): Promise<StoredOtpChallenge | null> {
    const challenge = this.challenges.get(id);
    return challenge ? structuredClone(challenge) : null;
  }

  async recordFailedAttempt(id: string): Promise<void> {
    const challenge = this.challenges.get(id);
    if (challenge) this.challenges.set(id, { ...challenge, failedAttempts: challenge.failedAttempts + 1 });
  }

  async consume(id: string, consumedAt: Date): Promise<void> {
    const challenge = this.challenges.get(id);
    if (challenge) this.challenges.set(id, { ...challenge, consumedAt });
  }
}
