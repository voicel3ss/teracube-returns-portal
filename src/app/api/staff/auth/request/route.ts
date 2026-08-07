import { z } from "zod";
import { OtpService } from "@/auth/otp";
import { PrismaOtpRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ accepted: true });

  const email = parsed.data.email.toLowerCase();
  const staff = await prisma.staffUser.findUnique({ where: { email } });
  if (!staff?.active) return Response.json({ accepted: true });

  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) return Response.json({ error: "Staff authentication is not configured." }, { status: 503 });

  const recent = await prisma.otpChallenge.findFirst({
    where: { normalizedEmail: email, purpose: "staff_login", createdAt: { gt: new Date(Date.now() - 60_000) } },
  });
  if (recent) return Response.json({ error: "A code was just issued. Wait a minute before requesting another." }, { status: 429 });

  const challenge = await new OtpService(new PrismaOtpRepository(prisma), secret).issue(email, "staff_login");
  return Response.json({ accepted: true, challengeId: challenge.challengeId, demoCode: challenge.code, delivery: "mock" });
}
