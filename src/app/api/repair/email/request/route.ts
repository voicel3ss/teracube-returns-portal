import { z } from "zod";
import { OtpService } from "@/auth/otp";
import { PrismaOtpRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { normalizeEmail } from "@/verification/assertion";
import { customerEmailSchema } from "@/verification/schemas";
import { isOtpRequestLimited } from "@/auth/otp-rate-limit";

const schema = z.object({ email: customerEmailSchema });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter a valid email." }, { status: 400 });
  }

  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) return Response.json({ error: "Email verification is not configured." }, { status: 503 });

  const email = normalizeEmail(parsed.data.email);
  if (await isOtpRequestLimited(email, "customer_email")) return Response.json({ error: "Too many code requests. Wait before trying again." }, { status: 429 });

  const otp = new OtpService(new PrismaOtpRepository(prisma), secret);
  const challenge = await otp.issue(email, "customer_email");

  // Local delivery is replaced by the production email adapter at launch.
  return Response.json({
    challengeId: challenge.challengeId,
    expiresAt: challenge.expiresAt.toISOString(),
    delivery: "local",
    verificationCode: challenge.code,
  });
}
