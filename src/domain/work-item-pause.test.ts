import { describe, expect, it } from "vitest";
import { resumesWhenCustomerReplies } from "./work-item-pause";

describe("event-based work pauses", () => {
  it("resumes customer-approval waits when the customer replies", () => {
    expect(resumesWhenCustomerReplies("customer_approval")).toBe(true);
  });

  it("keeps admin-review waits paused after customer replies", () => {
    expect(resumesWhenCustomerReplies("admin_review")).toBe(false);
  });
});
