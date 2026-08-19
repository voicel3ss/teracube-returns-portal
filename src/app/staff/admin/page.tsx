import { redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission, type StaffTeam } from "@/auth/permissions";
import { prisma } from "@/db/prisma";
import { StaffShell } from "../support/staff-shell";
import { AdminConfigForm } from "./admin-config-form";
import { StaffAccountsForm } from "./staff-accounts-form";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const staff = await getStaffContext();
  if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "config:manage")) {
    if (hasPermission(staff.teams, "oversight:view")) redirect("/staff/oversight");
    if (hasPermission(staff.teams, "order:view_all")) redirect("/staff/support");
    redirect("/staff/login");
  }
  const [config, processTypes, users] = await Promise.all([
    prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }),
    prisma.processType.findMany({ orderBy: [{ flow: "asc" }, { name: "asc" }] }),
    prisma.staffUser.findMany({ include: { memberships: true }, orderBy: { displayName: "asc" } }),
  ]);
  const accounts = users.map((user) => ({ id: user.id, email: user.email, displayName: user.displayName, active: user.active, teams: user.memberships.map((membership) => membership.team as StaffTeam) }));

  return <StaffShell name={staff.displayName} teams={staff.teams} area="admin">
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-7">
      <p className="text-sm font-semibold text-[var(--green-strong)]">Administration</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">Repair and replacement settings</h1>
      <p className="mt-2 text-black/50">Control customer options, charges, reminders, staff access, and return instructions.</p>
      <div className="mt-7 grid gap-7 xl:grid-cols-[1fr_.42fr]">
        <AdminConfigForm config={config} processTypes={processTypes} />
        <StaffAccountsForm accounts={accounts} currentStaffId={staff.id} />
      </div>
    </div>
  </StaffShell>;
}
