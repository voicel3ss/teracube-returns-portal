import { z } from "zod";
import { OtpService } from "@/auth/otp";
import { PrismaOtpRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { issueVerificationAssertion, normalizeEmail } from "@/verification/assertion";
import { customerEmailSchema } from "@/verification/schemas";

const schema = z.object({
  challengeId: z.string().uuid(),
  email: customerEmailSchema,
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter the six-digit verification code." }, { status: 400 });

  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) return Response.json({ error: "Email verification is not configured." }, { status: 503 });

  const email = normalizeEmail(parsed.data.email);
  const otp = new OtpService(new PrismaOtpRepository(prisma), secret);
  const verified = await otp.verify(parsed.data.challengeId, email, parsed.data.code, "customer_email");
  if (!verified) return Response.json({ error: "That code is incorrect, expired, or already used." }, { status: 400 });

  return Response.json({
    email,
    verificationToken: issueVerificationAssertion("customer_email", email, secret),
  });
}
