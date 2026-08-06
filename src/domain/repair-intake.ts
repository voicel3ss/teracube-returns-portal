import type { FaultCategory } from "@/generated/prisma/enums";

export type CoverageKind = "warranty" | "accident";

const ACCIDENT_LANGUAGE = /\b(crack(?:ed)?|drop(?:ped)?|fell|fall|water|liquid|smash(?:ed)?|impact|ran over)\b/i;

export function inferCoverage(faultCategory: FaultCategory, description: string): CoverageKind {
  if (faultCategory === "water_damage" || ACCIDENT_LANGUAGE.test(description)) return "accident";
  return "warranty";
}

export function formatMoney(amountInCents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountInCents / 100);
}
