import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { prisma } from "@/db/prisma";
import { StaffShell } from "../support/staff-shell";
import { RepairTools } from "./repair-tools";
export const dynamic = "force-dynamic";
export default async function RepairPage() {
  const staff = await getStaffContext(); if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "repair:record")) {
    if (hasPermission(staff.teams, "order:view_all")) redirect("/staff/support");
    redirect("/staff/login");
  }
  const repairs = await prisma.repair.findMany({ include: { device: { include: { model: true } } }, orderBy: { updatedAt: "desc" }, take: 100 });
  return <StaffShell name={staff.displayName} area="repair"><div className="mx-auto max-w-7xl px-5 py-8 sm:px-7"><div><p className="text-sm font-semibold text-[var(--green-strong)]">Repair operations</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">Physical unit workflow</h1><p className="mt-2 text-black/50">Receive, diagnose, QC, and preserve every serial’s history.</p></div><div className="mt-7"><RepairTools /></div><section className="mt-7 rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8"><div className="flex justify-between"><h2 className="font-semibold">Repair queue & ledger</h2><span className="text-sm text-black/40">{repairs.length} records</span></div><div className="mt-5 divide-y divide-black/10">{repairs.map((repair) => <Link key={repair.id} href={`/staff/repair/${repair.id}`} className="grid gap-2 py-4 sm:grid-cols-[1fr_.7fr_.7fr_auto] sm:items-center"><div><p className="font-mono text-sm font-semibold">{repair.deviceSerial}</p><p className="mt-1 text-xs text-black/40">{repair.device.model.name}</p></div><p className="text-sm capitalize">{repair.status.replaceAll("_", " ")}</p><p className="text-sm capitalize text-black/50">{repair.device.circulationState.replaceAll("_", " ")}</p><span className="text-sm font-semibold">Open →</span></Link>)}{!repairs.length ? <p className="py-10 text-center text-sm text-black/40">No repair records yet. Scan the first unit above.</p> : null}</div></section></div></StaffShell>;
}
