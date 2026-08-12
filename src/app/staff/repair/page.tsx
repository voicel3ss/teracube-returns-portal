import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { prisma } from "@/db/prisma";
import { StaffShell } from "../support/staff-shell";
import { PendingRepairRow } from "./pending-repair-row";
import { RepairTools } from "./repair-tools";

export const dynamic = "force-dynamic";

export default async function RepairPage() {
  const staff = await getStaffContext();
  if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "repair:record")) {
    if (hasPermission(staff.teams, "order:view_all")) redirect("/staff/support");
    if (hasPermission(staff.teams, "shipment:dispatch")) redirect("/staff/logistics");
    redirect("/staff/login");
  }

  const [repairs, pendingDevices] = await Promise.all([
    prisma.repair.findMany({
      where: { status: { in: ["received", "in_repair", "qc_pass"] } },
      include: { device: { include: { model: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.device.findMany({
      where: {
        circulationState: "in_repair",
        repairs: { none: { status: { in: ["received", "in_repair", "qc_pass"] } } },
      },
      include: { model: true, returnedForOrders: { orderBy: { updatedAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const total = repairs.length + pendingDevices.length;
  return (
    <StaffShell name={staff.displayName} teams={staff.teams} area="repair">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-7">
        <div>
          <p className="text-sm font-semibold text-[var(--green-strong)]">Repair operations</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">Physical unit workflow</h1>
          <p className="mt-2 text-black/50">Every received device stays visible until its repair and quality check are complete.</p>
        </div>

        <div className="mt-7"><RepairTools /></div>

        <section className="mt-7 rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">Devices needing repair</h2><p className="mt-1 text-sm text-black/45">Unstarted devices and active repair records</p></div><span className="text-sm font-medium text-black/40">{total} devices</span></div>
          <div className="mt-5 divide-y divide-black/10">
            {pendingDevices.map((device) => <PendingRepairRow key={device.serial} serial={device.serial} model={device.model.name} orderNumber={device.returnedForOrders[0]?.orderNumber ?? null} />)}
            {repairs.map((repair) => (
              <Link key={repair.id} href={`/staff/repair/${repair.id}`} className="grid gap-2 py-4 transition hover:bg-black/[.015] sm:grid-cols-[1fr_.7fr_.7fr_auto] sm:items-center">
                <div><p className="font-mono text-sm font-semibold">{repair.deviceSerial}</p><p className="mt-1 text-xs text-black/40">{repair.device.model.name}</p></div>
                <p className="text-sm capitalize">{repair.status.replaceAll("_", " ")}</p>
                <p className="text-sm capitalize text-black/50">{repair.device.circulationState.replaceAll("_", " ")}</p>
                <span className="text-sm font-semibold">Open →</span>
              </Link>
            ))}
            {!total ? <p className="py-10 text-center text-sm text-black/40">No devices currently need repair.</p> : null}
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
