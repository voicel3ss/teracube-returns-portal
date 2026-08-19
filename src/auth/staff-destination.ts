import type { StaffTeam } from "./permissions";

export function staffDestination(teams: Iterable<StaffTeam | string>): string {
  const memberships = new Set(teams);
  if (memberships.has("admin")) return "/staff/admin";
  if (memberships.has("ops_lead")) return "/staff/oversight";
  if (memberships.has("support")) return "/staff/support";
  if (memberships.has("repair")) return "/staff/repair";
  if (memberships.has("logistics")) return "/staff/logistics";
  return "/staff/login";
}
