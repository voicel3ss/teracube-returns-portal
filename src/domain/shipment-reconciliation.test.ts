import { describe, expect, it } from "vitest";
import { reconcileInbound } from "./shipment-reconciliation";

describe("inbound shipment reconciliation", () => {
  it("matches the observed unit to the expected serial", () => expect(reconcileInbound("A", true, "A")).toBe("matched"));
  it("flags a different observed serial", () => expect(reconcileInbound("A", true, "B")).toBe("mismatch"));
  it("flags an empty package", () => expect(reconcileInbound("A", false, null)).toBe("missing"));
  it("accepts a serial for an unidentified order", () => expect(reconcileInbound(null, true, "B")).toBe("unidentified"));
});
