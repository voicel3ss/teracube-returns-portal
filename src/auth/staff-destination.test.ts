import { describe, expect, it } from "vitest";
import { staffDestination } from "./staff-destination";

describe("staff workspace destinations", () => {
  it.each([
    [["admin"], "/staff/admin"],
    [["ops_lead"], "/staff/oversight"],
    [["support"], "/staff/support"],
    [["repair"], "/staff/repair"],
    [["logistics"], "/staff/logistics"],
  ] as const)("routes %j to %s", (teams, destination) => {
    expect(staffDestination(teams)).toBe(destination);
  });

  it("uses the highest-privilege workspace for multi-team staff", () => {
    expect(staffDestination(["repair", "admin", "support"])).toBe("/staff/admin");
  });
});
