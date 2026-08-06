import type { AddressValidationProvider, PostalAddress } from "../contracts";

function comparable(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\bsuite\b/g, "ste")
    .replace(/\s+/g, " ");
}

export class MockAddressValidationProvider implements AddressValidationProvider {
  async validate(address: PostalAddress) {
    const matchesTeracubeAddress =
      comparable(address.line1) === "16625 redmond way" &&
      comparable(address.line2) === "ste m-175" &&
      comparable(address.city) === "redmond" &&
      comparable(address.region) === "wa" &&
      comparable(address.postalCode) === "98052" &&
      address.country === "US";

    if (!matchesTeracubeAddress) {
      return {
        valid: false as const,
        reason: "The mock validator could not confirm this address. Use the verified demo address for local testing.",
      };
    }

    return {
      valid: true as const,
      validationId: "mock-teracube-redmond-98052",
      normalizedAddress: {
        name: address.name.trim(),
        line1: "16625 Redmond Way",
        line2: "Ste M-175",
        city: "Redmond",
        region: "WA",
        postalCode: "98052",
        country: "US" as const,
      },
    };
  }
}

export const mockAddressValidationProvider = new MockAddressValidationProvider();
