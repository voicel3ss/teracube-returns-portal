import { describe, expect, it } from "vitest";
import { formatMoney, inferCoverage } from "./repair-intake";

describe("repair intake", () => {
  it("classifies explicit accidental damage without asking the parent to choose coverage", () => {
    expect(inferCoverage("water_damage", "It stopped turning on")).toBe("accident");
    expect(inferCoverage("screen", "Cracked after a drop")).toBe("accident");
  });

  it("keeps ordinary hardware symptoms on the warranty path for CS verification", () => {
    expect(inferCoverage("charging", "Only charges at a certain angle")).toBe("warranty");
  });

  it("formats stored integer cents for display", () => {
    expect(formatMoney(12900)).toBe("$129.00");
  });
});
