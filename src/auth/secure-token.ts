import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashOneTimeCode(secret: string, challengeId: string, email: string, code: string): string {
  return createHmac("sha256", secret)
    .update(`${challengeId}:${email}:${code}`)
    .digest("hex");
}

export function hashesMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
