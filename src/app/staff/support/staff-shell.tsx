import type { StaffTeam } from "@/auth/permissions";
import { getStaffContext } from "@/auth/staff-request";
import { StaffHeader, type StaffArea } from "./staff-header";

export async function StaffShell({ name, teams, children, area = "support" }: { name: string; teams?: StaffTeam[]; children: React.ReactNode; area?: StaffArea }) {
  const session = teams ? null : await getStaffContext();
  const effectiveTeams = teams ?? session?.teams ?? [];

  return (
    <main className="min-h-screen bg-[#f3f5f0] text-[var(--ink)]">
      <StaffHeader name={name} teams={effectiveTeams} area={area} />
      {children}
    </main>
  );
}
