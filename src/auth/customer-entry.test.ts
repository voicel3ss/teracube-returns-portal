import { describe, expect, it } from "vitest";
import { issueCustomerEntry, verifyCustomerEntry } from "./customer-entry";

const secret = "0123456789abcdef0123456789abcdef";

describe("customer entry links", () => {
  it("round-trips signed staff intake claims", () => {
    const now = new Date("2026-08-14T00:00:00Z");
    const token = issueCustomerEntry({ serial: "202112T2E235968", parentEmail: "parent@example.com", source: "staff" }, secret, now);
    expect(verifyCustomerEntry(token, secret, now)).toMatchObject({ serial: "202112T2E235968", parentEmail: "parent@example.com", source: "staff" });
  });

  it("rejects tampered and expired links", () => {
    const now = new Date("2026-08-14T00:00:00Z");
    const token = issueCustomerEntry({ serial: "202112T2E235968", parentEmail: "parent@example.com", source: "parent_app" }, secret, now, 1000);
    expect(verifyCustomerEntry(`${token}x`, secret, now)).toBeNull();
    expect(verifyCustomerEntry(token, secret, new Date(now.getTime() + 1001))).toBeNull();
  });
});
