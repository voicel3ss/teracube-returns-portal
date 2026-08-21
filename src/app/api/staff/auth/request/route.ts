import { z } from "zod";
import { OtpService } from "@/auth/otp";
import { PrismaOtpRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { isOtpRequestLimited } from "@/auth/otp-rate-limit";
import { deliverVerificationCode, emailDeliveryConfigured } from "@/integrations/postmark-email";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ accepted: true });

  const email = parsed.data.email.toLowerCase();
  if (await isOtpRequestLimited(email, "staff_login")) return Response.json({ error: "Too many code requests. Wait before trying again." }, { status: 429 });
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) return Response.json({ error: "Staff authentication is not configured." }, { status: 503 });

  const challenge = await new OtpService(new PrismaOtpRepository(prisma), secret).issue(email, "staff_login");
  const staff = await prisma.staffUser.findUnique({ where: { email }, select: { active: true } });
  if (staff?.active) await deliverVerificationCode({ to: email, code: challenge.code, expiresAt: challenge.expiresAt, purpose: "staff" });
  return Response.json({
    accepted: true,
    challengeId: challenge.challengeId,
    delivery: emailDeliveryConfigured() ? "email" : "local",
    ...(process.env.NODE_ENV !== "production" && !emailDeliveryConfigured() ? { verificationCode: challenge.code } : {}),
  });
}
