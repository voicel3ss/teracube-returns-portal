import { describe, expect, it } from "vitest";
import { oversightNeedsAttention, oversightStage, oversightStatusLabel } from "./oversight-case";

const claimedSupport = [{ kind: "claim_verification", status: "claimed", team: "support", assignedToStaff: { id: "staff", displayName: "Support Agent" } }] as const;

describe("oversight case presentation", () => {
  it("uses active work ownership before inferred order stage", () => {
    expect(oversightStage("return_received", [...claimedSupport], true)).toBe("support");
  });

  it("shows active physical repairs as repair work", () => {
    expect(oversightStage("return_received", [], true)).toBe("repair");
  });

  it("uses readable status labels", () => {
    expect(oversightStatusLabel("fulfillment_blocked")).toBe("Fulfillment blocked");
  });

  it("flags exceptions and stale claimed cases", () => {
    const now = new Date("2026-08-24T12:00:00Z");
    const staleBefore = new Date("2026-08-21T12:00:00Z");
    expect(oversightNeedsAttention("return_discrepancy", [], now, staleBefore)).toBe(true);
    expect(oversightNeedsAttention("awaiting_verification", [...claimedSupport], new Date("2026-08-20T12:00:00Z"), staleBefore)).toBe(true);
    expect(oversightNeedsAttention("awaiting_verification", [...claimedSupport], now, staleBefore)).toBe(false);
  });
});
