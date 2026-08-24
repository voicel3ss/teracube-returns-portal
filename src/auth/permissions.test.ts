import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("staff least-privilege permissions", () => {
  it("keeps Repair limited to the physical repair workflow", () => {
    expect(hasPermission(["repair"], "repair:record")).toBe(true);
    expect(hasPermission(["repair"], "shipment:receive")).toBe(false);
    expect(hasPermission(["repair"], "queue:claim")).toBe(false);
  });

  it("keeps Logistics out of the Support queue", () => {
    expect(hasPermission(["logistics"], "shipment:receive")).toBe(true);
    expect(hasPermission(["logistics"], "queue:claim")).toBe(false);
    expect(hasPermission(["logistics"], "order:view_all")).toBe(false);
  });

  it("lets Support and Operations claim cases but reserves assignment for Admin", () => {
    expect(hasPermission(["support"], "queue:claim")).toBe(true);
    expect(hasPermission(["support"], "queue:assign")).toBe(false);
    expect(hasPermission(["ops_lead"], "queue:claim")).toBe(true);
    expect(hasPermission(["ops_lead"], "queue:assign")).toBe(false);
    expect(hasPermission(["ops_lead"], "pii:export")).toBe(false);
    expect(hasPermission(["admin"], "queue:assign")).toBe(true);
    expect(hasPermission(["admin"], "pii:export")).toBe(true);
  });

  it("allows an administrator to perform every tested cross-team action", () => {
    expect(hasPermission(["admin"], "order:verify")).toBe(true);
    expect(hasPermission(["admin"], "repair:record")).toBe(true);
    expect(hasPermission(["admin"], "shipment:dispatch")).toBe(true);
    expect(hasPermission(["admin"], "config:manage")).toBe(true);
  });
});
