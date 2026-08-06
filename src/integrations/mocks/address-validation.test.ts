import { describe, expect, it } from "vitest";
import { MockAddressValidationProvider } from "./address-validation";

const provider = new MockAddressValidationProvider();

describe("mock address validation", () => {
  it("recognizes and standardizes the public Teracube contact address", async () => {
    const result = await provider.validate({
      name: "Teracube Demo",
      line1: "16625 redmond way",
      line2: "Suite M-175",
      city: "Redmond",
      region: "wa",
      postalCode: "98052",
      country: "US",
    });

    expect(result).toEqual({
      valid: true,
      validationId: "mock-teracube-redmond-98052",
      normalizedAddress: {
        name: "Teracube Demo",
        line1: "16625 Redmond Way",
        line2: "Ste M-175",
        city: "Redmond",
        region: "WA",
        postalCode: "98052",
        country: "US",
      },
    });
  });

  it("does not pretend an unknown address was validated", async () => {
    const result = await provider.validate({
      name: "Parent",
      line1: "123 Main Street",
      city: "Seattle",
      region: "WA",
      postalCode: "98101",
      country: "US",
    });
    expect(result.valid).toBe(false);
  });
});
