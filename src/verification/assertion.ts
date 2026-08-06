import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { PostalAddress } from "@/integrations/contracts";

const ASSERTION_LIFETIME_MS = 30 * 60 * 1000;

type AssertionKind = "customer_email" | "shipping_address";
type AssertionClaims = {
  kind: AssertionKind;
  valueHash: string;
  issuedAt: number;
  expiresAt: number;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sign(encodedClaims: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedClaims).digest();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function canonicalAddress(address: PostalAddress): string {
  return JSON.stringify({
    name: address.name.trim(),
    line1: address.line1.trim(),
    line2: address.line2?.trim() || "",
    city: address.city.trim(),
    region: address.region.trim().toUpperCase(),
    postalCode: address.postalCode.trim(),
    country: address.country,
  });
}

export function issueVerificationAssertion(
  kind: AssertionKind,
  value: string,
  secret: string,
  now: Date = new Date(),
): string {
  if (secret.length < 32) throw new Error("Verification secret must be at least 32 characters.");
  const claims: AssertionClaims = {
    kind,
    valueHash: digest(value),
    issuedAt: now.getTime(),
    expiresAt: now.getTime() + ASSERTION_LIFETIME_MS,
  };
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${encodedClaims}.${sign(encodedClaims, secret).toString("base64url")}`;
}

export function verifyVerificationAssertion(
  token: string,
  kind: AssertionKind,
  value: string,
  secret: string,
  now: Date = new Date(),
): boolean {
  const [encodedClaims, encodedSignature, extra] = token.split(".");
  if (!encodedClaims || !encodedSignature || extra) return false;

  try {
    const suppliedSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = sign(encodedClaims, secret);
    if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) {
      return false;
    }

    const claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as Partial<AssertionClaims>;
    return (
      claims.kind === kind &&
      claims.valueHash === digest(value) &&
      typeof claims.issuedAt === "number" &&
      claims.issuedAt <= now.getTime() &&
      typeof claims.expiresAt === "number" &&
      claims.expiresAt > now.getTime()
    );
  } catch {
    return false;
  }
}
