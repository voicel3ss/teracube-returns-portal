import { describe, expect, it } from "vitest";
import { selectSupportWorkItem } from "./support-work-selection";

describe("support work selection", () => {
  it("selects the discrepancy task even when an older customer message is also open", () => {
    const items = [{ id: "message", kind: "customer_message" }, { id: "exception", kind: "return_discrepancy" }];
    expect(selectSupportWorkItem(items, { status: "return_discrepancy", reviewState: "reviewed" })?.id).toBe("exception");
  });

  it("keeps the clarification task selected after a customer reply reopens review", () => {
    const items = [{ id: "clarify", kind: "needs_clarification" }, { id: "verify", kind: "claim_verification" }];
    expect(selectSupportWorkItem(items, { status: "awaiting_verification", reviewState: "unreviewed" })?.id).toBe("clarify");
  });
});
