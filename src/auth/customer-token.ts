import { randomUUID } from "node:crypto";
import { generateOpaqueToken, hashToken } from "./secure-token";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type StoredCustomerToken = {
  id: string;
  customerId: string;
  replacementOrderId: string;
  tokenHash: string;
  parentAppIssued: boolean;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
};

export interface CustomerTokenRepository {
  create(token: StoredCustomerToken): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<StoredCustomerToken | null>;
}

export class CustomerTokenService {
  constructor(
    private readonly repository: CustomerTokenRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async issue(input: {
    customerId: string;
    replacementOrderId: string;
    parentAppIssued?: boolean;
  }): Promise<{ token: string; expiresAt: Date }> {
    const token = generateOpaqueToken();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + THIRTY_DAYS_MS);

    await this.repository.create({
      id: randomUUID(),
      customerId: input.customerId,
      replacementOrderId: input.replacementOrderId,
      tokenHash: hashToken(token),
      parentAppIssued: input.parentAppIssued ?? false,
      expiresAt,
      createdAt,
    });

    return { token, expiresAt };
  }

  async authenticate(token: string): Promise<{ customerId: string; replacementOrderId: string } | null> {
    if (!token) return null;
    const stored = await this.repository.findByTokenHash(hashToken(token));
    if (!stored || stored.revokedAt || stored.expiresAt <= this.now()) return null;
    return { customerId: stored.customerId, replacementOrderId: stored.replacementOrderId };
  }
}

export class InMemoryCustomerTokenRepository implements CustomerTokenRepository {
  readonly tokens = new Map<string, StoredCustomerToken>();

  async create(token: StoredCustomerToken): Promise<void> {
    this.tokens.set(token.id, structuredClone(token));
  }

  async findByTokenHash(tokenHash: string): Promise<StoredCustomerToken | null> {
    const token = [...this.tokens.values()].find((candidate) => candidate.tokenHash === tokenHash);
    return token ? structuredClone(token) : null;
  }
}
