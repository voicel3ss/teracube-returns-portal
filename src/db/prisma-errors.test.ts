import { describe, expect, it } from "vitest";
import { isUniqueConstraintError } from "./prisma-errors";

describe("Prisma error classification", () => {
  it("recognizes a concurrent unique-key conflict without depending on a generated error class", () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
    expect(isUniqueConstraintError({ code: "P2025" })).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});
