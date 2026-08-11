import { z } from "zod";
import { OtpService } from "@/auth/otp";
import { PrismaOtpRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { normalizeEmail } from "@/verification/assertion";
import { customerEmailSchema } from "@/verification/schemas";

const schema = z.object({ email: customerEmailSchema });
const REQUEST_WINDOW_MS = 60 * 1000;

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter a valid email." }, { status: 400 });
  }

  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) return Response.json({ error: "Email verification is not configured." }, { status: 503 });

  const email = normalizeEmail(parsed.data.email);
  const recentChallenge = await prisma.otpChallenge.findFirst({
    where: {
      normalizedEmail: email,
      purpose: "customer_email",
      createdAt: { gt: new Date(Date.now() - REQUEST_WINDOW_MS) },
    },
  });
  if (recentChallenge) {
    return Response.json({ error: "A code was just sent. Wait a minute before requesting another." }, { status: 429 });
  }

  const otp = new OtpService(new PrismaOtpRepository(prisma), secret);
  const challenge = await otp.issue(email, "customer_email");

  // The external email provider is intentionally mocked in this milestone.
  return Response.json({
    challengeId: challenge.challengeId,
    expiresAt: challenge.expiresAt.toISOString(),
    delivery: "mock",
    verificationCode: challenge.code,
  });
}
