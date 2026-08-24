import { describe, expect, it } from "vitest";
import { buildOversightCsv } from "./oversight-csv";

describe("oversight CSV export", () => {
  it("exports operational case data without customer contact fields", () => {
    const csv = buildOversightCsv([{
      orderNumber: 12,
      deviceSerial: "202607T2E240701",
      model: "Teracube 2e",
      statusLabel: "Awaiting verification",
      stage: "support",
      issue: "Screen flickers",
      flow: "regular",
      needsAttention: false,
      updatedAt: "2026-08-24T12:00:00.000Z",
      assignments: [{ name: "Support Agent", work: "Claim verification", team: "support" }],
    }]);
    expect(csv).toContain("#0012,202607T2E240701,Teracube 2e");
    expect(csv).toContain("Support Agent,Claim verification (support)");
    expect(csv.toLowerCase()).not.toContain("parent email");
  });

  it("includes protected customer fields when the authorized export supplies them", () => {
    const csv = buildOversightCsv([{
      orderNumber: 3,
      deviceSerial: "202607T2E240701",
      model: "Teracube 2e",
      statusLabel: "Awaiting verification",
      stage: "support",
      issue: "Screen flickers",
      flow: "regular",
      needsAttention: false,
      updatedAt: "2026-08-24T12:00:00.000Z",
      assignments: [],
      parentEmail: "parent@example.com",
      shippingAddress: "16625 Redmond Way, Redmond, WA 98052",
    }]);
    expect(csv).toContain("Parent email,Shipping address");
    expect(csv).toContain("parent@example.com");
    expect(csv).toContain('"16625 Redmond Way, Redmond, WA 98052"');
  });

  it("quotes commas, quotes, and line breaks safely", () => {
    const csv = buildOversightCsv([{
      orderNumber: 1,
      deviceSerial: null,
      model: "Teracube 4",
      statusLabel: "Awaiting verification",
      stage: "support",
      issue: "Camera says \"failed\", then\ncloses",
      flow: null,
      needsAttention: true,
      updatedAt: "2026-08-24T12:00:00.000Z",
      assignments: [],
    }]);
    expect(csv).toContain('"Camera says ""failed"", then\ncloses"');
    expect(csv).toContain(",Unassigned,,");
  });
});
