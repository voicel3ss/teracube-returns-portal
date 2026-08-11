import { z } from "zod";
import { OtpService } from "@/auth/otp";
import { PrismaOtpRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { isOtpRequestLimited } from "@/auth/otp-rate-limit";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ accepted: true });

  const email = parsed.data.email.toLowerCase();
  if (await isOtpRequestLimited(email, "staff_login")) return Response.json({ error: "Too many code requests. Wait before trying again." }, { status: 429 });
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) return Response.json({ error: "Staff authentication is not configured." }, { status: 503 });

  const challenge = await new OtpService(new PrismaOtpRepository(prisma), secret).issue(email, "staff_login");
  return Response.json({ accepted: true, challengeId: challenge.challengeId, verificationCode: challenge.code, delivery: "local" });
}
