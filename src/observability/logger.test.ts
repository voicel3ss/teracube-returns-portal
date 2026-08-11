import { describe, expect, it } from "vitest";
import { redactForLog } from "./logger";

describe("structured-log redaction", () => {
  it("redacts sensitive values recursively", () => expect(redactForLog({ orderId: "1", customer: { email: "a@b.com", phone: "123" }, token: "secret" })).toEqual({ orderId: "1", customer: { email: "[REDACTED]", phone: "[REDACTED]" }, token: "[REDACTED]" }));
});
