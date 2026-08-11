import { describe, expect, it } from "vitest";
import { olderThan } from "./policy";

describe("automation timing", () => {
  const now = new Date("2026-08-11T12:00:00Z");
  it("fires once the configured day boundary is reached", () => expect(olderThan(new Date("2026-08-07T12:00:00Z"), 4, now)).toBe(true));
  it("does not fire early", () => expect(olderThan(new Date("2026-08-08T12:00:01Z"), 3, now)).toBe(false));
});
