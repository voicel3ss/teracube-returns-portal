import { describe, expect, it } from "vitest";
import { getPiiFieldAccess, hasPermission } from "./permissions";

describe("team permissions", () => {
  it("combines permissions for multi-team staff", () => {
    expect(hasPermission(["support", "logistics"], "shipment:dispatch")).toBe(true);
    expect(hasPermission(["support", "logistics"], "repair:record")).toBe(false);
  });

  it("hard-blocks repair staff from customer PII", () => {
    expect(getPiiFieldAccess("repair", "parent_address")).toBe("blocked");
    expect(getPiiFieldAccess("repair", "child_phone")).toBe("blocked");
  });

  it("allows audited address reveal for logistics", () => {
    expect(getPiiFieldAccess("logistics", "parent_address")).toBe("masked_reveal_with_audit");
  });
});
