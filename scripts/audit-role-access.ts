import "dotenv/config";
import { PrismaStaffSessionRepository } from "../src/db/auth-repositories";
import { prisma } from "../src/db/prisma";
import { StaffSessionService } from "../src/auth/staff-session";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const routes = ["/staff/support", "/staff/customers", "/staff/repair", "/staff/logistics", "/staff/oversight", "/staff/admin"] as const;
const cases = [
  { email: "support@myteracube.com", destination: "/staff/support", allowed: ["/staff/support", "/staff/customers"] },
  { email: "repair@myteracube.com", destination: "/staff/repair", allowed: ["/staff/repair"] },
  { email: "logistics@myteracube.com", destination: "/staff/logistics", allowed: ["/staff/logistics"] },
  { email: "ops@myteracube.com", destination: "/staff/oversight", allowed: ["/staff/support", "/staff/customers", "/staff/oversight"] },
  { email: "admin@myteracube.com", destination: "/staff/admin", allowed: [...routes] },
] as const;

async function main() {
  const createdSessionIds: string[] = [];

  try {
    const service = new StaffSessionService(new PrismaStaffSessionRepository(prisma));
    for (const account of cases) {
      const staff = await prisma.staffUser.findUnique({ where: { email: account.email } });
      if (!staff?.active) throw new Error(`Active staff fixture missing: ${account.email}`);
      const created = await service.create(staff.id);
      const authenticated = await service.authenticate(created.token);
      if (!authenticated) throw new Error(`Could not authenticate audit session for ${account.email}`);
      createdSessionIds.push(authenticated.sessionId);

      for (const route of routes) {
        const response = await fetch(`${baseUrl}${route}`, {
          redirect: "manual",
          headers: { cookie: `teracube_staff_session=${created.token}` },
        });
        const allowed = (account.allowed as readonly string[]).includes(route);
        const location = response.headers.get("location");
        if (allowed && response.status !== 200) {
          throw new Error(`${account.email} should access ${route}, received ${response.status} ${location ?? ""}`);
        }
        if (!allowed && (response.status < 300 || response.status >= 400 || location !== account.destination)) {
          throw new Error(`${account.email} should redirect from ${route} to ${account.destination}, received ${response.status} ${location ?? ""}`);
        }
      }
      console.log(`${account.email}: role routes verified`);
    }
  } finally {
    if (createdSessionIds.length) await prisma.staffSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
