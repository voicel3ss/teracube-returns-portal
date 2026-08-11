import { cookies } from "next/headers";
import { z } from "zod";
import { OtpService } from "@/auth/otp";
import { STAFF_SESSION_COOKIE } from "@/auth/staff-request";
import { StaffSessionService } from "@/auth/staff-session";
import { PrismaOtpRepository, PrismaStaffSessionRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";

const schema = z.object({
  email: z.string().trim().email(),
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Enter the six-digit code." }, { status: 400 });
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) return Response.json({ error: "Staff authentication is not configured." }, { status: 503 });

  const email = parsed.data.email.toLowerCase();
  const verified = await new OtpService(new PrismaOtpRepository(prisma), secret).verify(
    parsed.data.challengeId,
    email,
    parsed.data.code,
    "staff_login",
  );
  if (!verified) return Response.json({ error: "That code is incorrect, expired, or already used." }, { status: 400 });

  const staff = await prisma.staffUser.findUnique({ where: { email }, include: { memberships: true } });
  if (!staff?.active) return Response.json({ error: "This staff account is unavailable." }, { status: 403 });

  const session = await new StaffSessionService(new PrismaStaffSessionRepository(prisma)).create(staff.id);
  (await cookies()).set(STAFF_SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });
  const teams = new Set(staff.memberships.map((membership) => membership.team));
  const destination = teams.has("admin")
    ? "/staff/admin"
    : teams.has("ops_lead")
      ? "/staff/oversight"
      : teams.has("support")
        ? "/staff/support"
        : teams.has("repair")
      ? "/staff/repair"
      : teams.has("logistics")
        ? "/staff/logistics"
        : "/staff/login";
  return Response.json({ ok: true, destination });
}
