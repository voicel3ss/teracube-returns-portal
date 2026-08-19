import { cookies } from "next/headers";
import { z } from "zod";
import { verifyGoogleIdToken } from "@/auth/google-id-token";
import { STAFF_SESSION_COOKIE } from "@/auth/staff-request";
import { staffDestination } from "@/auth/staff-destination";
import { StaffSessionService } from "@/auth/staff-session";
import { PrismaStaffSessionRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";

const schema = z.object({ credential: z.string().min(100).max(10000) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Google sign-in could not be verified." }, { status: 400 });
  const clientId = process.env.GOOGLE_STAFF_OAUTH_CLIENT_ID;
  if (!clientId || clientId.startsWith("replace-with")) return Response.json({ error: "Google staff sign-in is not configured." }, { status: 503 });
  const identity = await verifyGoogleIdToken(parsed.data.credential, clientId);
  if (!identity) return Response.json({ error: "Google sign-in could not be verified." }, { status: 401 });
  const staff = await prisma.staffUser.findUnique({ where: { email: identity.email }, include: { memberships: true } });
  if (!staff?.active) return Response.json({ error: "This Google account is not assigned to an active staff account." }, { status: 403 });
  await prisma.staffIdentity.upsert({
    where: { provider_providerSubject: { provider: "google", providerSubject: identity.subject } },
    update: { staffUserId: staff.id },
    create: { staffUserId: staff.id, provider: "google", providerSubject: identity.subject },
  });
  const session = await new StaffSessionService(new PrismaStaffSessionRepository(prisma)).create(staff.id);
  (await cookies()).set(STAFF_SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: session.expiresAt });
  await prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "staff.signed_in_google", entityType: "staff_user", entityId: staff.id } });
  return Response.json({ ok: true, destination: staffDestination(staff.memberships.map((membership) => membership.team)) });
}
