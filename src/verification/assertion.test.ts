import { describe, expect, it } from "vitest";
import {
  canonicalAddress,
  issueVerificationAssertion,
  normalizeEmail,
  verifyVerificationAssertion,
} from "./assertion";

const SECRET = "a-secure-verification-secret-that-is-long-enough";
const NOW = new Date("2026-08-06T10:00:00.000Z");

describe("customer verification assertions", () => {
  it("binds an email assertion to the normalized email and purpose", () => {
    const email = normalizeEmail(" Parent@Mail.com ");
    const token = issueVerificationAssertion("customer_email", email, SECRET, NOW);

    expect(verifyVerificationAssertion(token, "customer_email", "parent@mail.com", SECRET, NOW)).toBe(true);
    expect(verifyVerificationAssertion(token, "customer_email", "other@mail.com", SECRET, NOW)).toBe(false);
    expect(verifyVerificationAssertion(token, "shipping_address", email, SECRET, NOW)).toBe(false);
  });

  it("rejects tampering and expiration", () => {
    const token = issueVerificationAssertion("customer_email", "parent@mail.com", SECRET, NOW);
    expect(verifyVerificationAssertion(`${token}x`, "customer_email", "parent@mail.com", SECRET, NOW)).toBe(false);
    expect(
      verifyVerificationAssertion(
        token,
        "customer_email",
        "parent@mail.com",
        SECRET,
        new Date("2026-08-06T10:31:00.000Z"),
      ),
    ).toBe(false);
  });

  it("invalidates an address assertion when delivery details change", () => {
    const address = {
      name: "Teracube Demo",
      line1: "16625 Redmond Way",
      line2: "Ste M-175",
      city: "Redmond",
      region: "WA",
      postalCode: "98052",
      country: "US" as const,
    };
    const token = issueVerificationAssertion("shipping_address", canonicalAddress(address), SECRET, NOW);
    expect(verifyVerificationAssertion(token, "shipping_address", canonicalAddress(address), SECRET, NOW)).toBe(true);
    expect(
      verifyVerificationAssertion(
        token,
        "shipping_address",
        canonicalAddress({ ...address, postalCode: "98053" }),
        SECRET,
        NOW,
      ),
    ).toBe(false);
  });
});
