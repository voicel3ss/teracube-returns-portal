import { cookies } from "next/headers";
import type { Permission, StaffTeam } from "./permissions";
import { hasPermission } from "./permissions";
import { StaffSessionService } from "./staff-session";
import { PrismaStaffSessionRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";

export const STAFF_SESSION_COOKIE = "teracube_staff_session";

export type StaffContext = {
  id: string;
  email: string;
  displayName: string;
  teams: StaffTeam[];
};

export async function getStaffContext(): Promise<StaffContext | null> {
  const token = (await cookies()).get(STAFF_SESSION_COOKIE)?.value ?? "";
  const session = await new StaffSessionService(new PrismaStaffSessionRepository(prisma)).authenticate(token);
  if (!session) return null;

  const staff = await prisma.staffUser.findFirst({
    where: { id: session.staffUserId, active: true },
    include: { memberships: true },
  });
  if (!staff) return null;

  return {
    id: staff.id,
    email: staff.email,
    displayName: staff.displayName,
    teams: staff.memberships.map((membership) => membership.team as StaffTeam),
  };
}

export async function getAuthorizedStaff(permission: Permission): Promise<StaffContext | null> {
  const staff = await getStaffContext();
  return staff && hasPermission(staff.teams, permission) ? staff : null;
}
