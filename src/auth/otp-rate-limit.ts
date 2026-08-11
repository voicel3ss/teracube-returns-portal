import type { OtpPurpose } from "@/generated/prisma/enums";
import { prisma } from "@/db/prisma";

export async function isOtpRequestLimited(email: string, purpose: OtpPurpose, now = new Date()): Promise<boolean> {
  const [lastMinute, recentWindow] = await Promise.all([
    prisma.otpChallenge.count({ where: { normalizedEmail: email, purpose, createdAt: { gt: new Date(now.getTime() - 60_000) } } }),
    prisma.otpChallenge.count({ where: { normalizedEmail: email, purpose, createdAt: { gt: new Date(now.getTime() - 15 * 60_000) } } }),
  ]);
  return lastMinute >= 1 || recentWindow >= 5;
}
