import { createHmac, timingSafeEqual } from "node:crypto";

type CustomerEntryClaims = { serial: string; parentEmail: string; source: "parent_app" | "staff"; expiresAt: number };

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest();
}

export function issueCustomerEntry(claims: Omit<CustomerEntryClaims, "expiresAt">, secret: string, now = new Date(), lifetimeMs = 7 * 24 * 60 * 60 * 1000): string {
  if (secret.length < 32) throw new Error("Customer entry secret must be at least 32 characters.");
  const payload = Buffer.from(JSON.stringify({ ...claims, expiresAt: now.getTime() + lifetimeMs })).toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function verifyCustomerEntry(token: string, secret: string, now = new Date()): CustomerEntryClaims | null {
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra || secret.length < 32) return null;
  try {
    const expected = signature(payload, secret);
    const supplied = Buffer.from(encodedSignature, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<CustomerEntryClaims>;
    const validSource = claims.source === "parent_app" || claims.source === "staff";
    if (!claims.serial || !claims.parentEmail || !validSource || typeof claims.expiresAt !== "number" || claims.expiresAt <= now.getTime()) return null;
    return claims as CustomerEntryClaims;
  } catch {
    return null;
  }
}
