import { cookies } from "next/headers";
import { STAFF_SESSION_COOKIE } from "@/auth/staff-request";
import { StaffSessionService } from "@/auth/staff-session";
import { PrismaStaffSessionRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value ?? "";
  await new StaffSessionService(new PrismaStaffSessionRepository(prisma)).revoke(token);
  cookieStore.delete(STAFF_SESSION_COOKIE);
  return Response.json({ ok: true });
}
