import { randomUUID } from "node:crypto";
import { generateOpaqueToken, hashToken } from "./secure-token";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type StoredStaffSession = {
  id: string;
  staffUserId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  lastSeenAt: Date;
};

export interface StaffSessionRepository {
  create(session: StoredStaffSession): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<StoredStaffSession | null>;
  revoke(id: string, revokedAt: Date): Promise<void>;
}

export class StaffSessionService {
  constructor(
    private readonly repository: StaffSessionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(staffUserId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = generateOpaqueToken();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + THIRTY_DAYS_MS);

    await this.repository.create({
      id: randomUUID(),
      staffUserId,
      tokenHash: hashToken(token),
      expiresAt,
      createdAt,
      lastSeenAt: createdAt,
    });

    return { token, expiresAt };
  }

  async authenticate(token: string): Promise<{ staffUserId: string; sessionId: string } | null> {
    if (!token) return null;
    const session = await this.repository.findByTokenHash(hashToken(token));
    if (!session || session.revokedAt || session.expiresAt <= this.now()) return null;
    return { staffUserId: session.staffUserId, sessionId: session.id };
  }

  async revoke(token: string): Promise<void> {
    const session = await this.repository.findByTokenHash(hashToken(token));
    if (session && !session.revokedAt) await this.repository.revoke(session.id, this.now());
  }
}

export class InMemoryStaffSessionRepository implements StaffSessionRepository {
  readonly sessions = new Map<string, StoredStaffSession>();

  async create(session: StoredStaffSession): Promise<void> {
    this.sessions.set(session.id, structuredClone(session));
  }

  async findByTokenHash(tokenHash: string): Promise<StoredStaffSession | null> {
    const session = [...this.sessions.values()].find((candidate) => candidate.tokenHash === tokenHash);
    return session ? structuredClone(session) : null;
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, revokedAt });
  }
}
