import { describe, expect, it } from "vitest";
import { signWebhook, verifyWebhookSignature } from "./webhook-signature";

describe("provider webhook signatures", () => {
  const secret = "a-secure-webhook-secret-that-is-long-enough";
  it("accepts an authentic payload", () => { const body = '{"event":"tracking"}'; expect(verifyWebhookSignature(body, signWebhook(body, secret), secret)).toBe(true); });
  it("rejects a changed payload", () => { const signature = signWebhook("original", secret); expect(verifyWebhookSignature("changed", signature, secret)).toBe(false); });
});
