import { describe, expect, it } from "vitest";
import { MockIdentityProvider } from "./device-care";

describe("mock device identity", () => {
  it("returns the associated email and child name for confirmation", async () => {
    const identity = await new MockIdentityProvider().resolveDevice({ serial: "202112t2e235968" });
    expect(identity).toMatchObject({
      serial: "202112T2E235968",
      parentEmail: "sarah@example.com",
      childName: "Maya",
    });
  });

  it("returns the same identity when looked up by child phone", async () => {
    const identity = await new MockIdentityProvider().resolveDevice({ childPhone: "(206) 555-0142" });
    expect(identity?.childName).toBe("Maya");
  });
});
