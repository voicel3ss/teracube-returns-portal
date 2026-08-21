import { describe, expect, it } from "vitest";
import { isDifferentReplacementUnit } from "./replacement-unit";

describe("replacement-unit allocation", () => {
  it("rejects returning the same physical unit to the customer", () => {
    expect(isDifferentReplacementUnit("202112T2E235968", "202112t2e235968")).toBe(false);
  });

  it("accepts a different serial and unidentified returns", () => {
    expect(isDifferentReplacementUnit("202112T2E235968", "202405T2E236210")).toBe(true);
    expect(isDifferentReplacementUnit(null, "202405T2E236210")).toBe(true);
  });
});
