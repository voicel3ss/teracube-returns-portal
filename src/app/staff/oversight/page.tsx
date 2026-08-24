import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { staffDestination } from "@/auth/staff-destination";
import { prisma } from "@/db/prisma";
import { oversightNeedsAttention, oversightStage, oversightStatusLabel, oversightWorkLabel } from "@/domain/oversight-case";
import { StaffShell } from "../support/staff-shell";
import { ActiveCasesList, type ActiveCaseRow } from "./active-cases-list";

export const dynamic = "force-dynamic";

export default async function OversightPage() {
  const staff = await getStaffContext();
  if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "oversight:view")) redirect(staffDestination(staff.teams));

  const config = await prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const now = new Date();
  const overdueBefore = new Date(now.getTime() - 86_400_000);
  const staleBefore = new Date(now.getTime() - config.staleClaimDays * 86_400_000);
  const repairBefore = new Date(now.getTime() - config.stuckRepairDays * 86_400_000);
  const deliveredBefore = new Date(now.getTime() - 86_400_000);

  const [orders, owned, deliveredNotScanned, stuckRepairs, resolutions] = await Promise.all([
    prisma.replacementOrder.findMany({
      include: {
        processType: { select: { flow: true } },
        returnedDevice: {
          include: {
            model: { select: { name: true } },
            repairs: { where: { status: { in: ["received", "in_repair"] } }, orderBy: { updatedAt: "desc" }, take: 1 },
          },
        },
        workItems: {
          where: { status: { in: ["open", "claimed", "snoozed"] } },
          include: { assignedToStaff: { select: { id: true, displayName: true } } },
          orderBy: { lastActivityAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.workItem.findMany({ where: { status: { in: ["claimed", "snoozed"] } }, include: { assignedToStaff: true, replacementOrder: true }, orderBy: { lastActivityAt: "asc" } }),
    prisma.shipment.findMany({ where: { type: { in: ["inbound", "internal_transfer"] }, status: "delivered", deliveredAt: { lte: deliveredBefore }, receivedAt: null }, include: { replacementOrder: true, units: true }, orderBy: { deliveredAt: "asc" } }),
    prisma.repair.findMany({ where: { status: { in: ["received", "in_repair"] }, updatedAt: { lte: repairBefore } }, include: { device: { include: { model: true } } }, orderBy: { updatedAt: "asc" } }),
    prisma.replacementOrder.groupBy({ by: ["resolution"], where: { resolution: { not: null } }, _count: { _all: true } }),
  ]);

  const cases: ActiveCaseRow[] = orders.map((order) => {
    const work = order.workItems;
    const assigned = work.filter((item) => item.assignedToStaff);
    const uniqueAssignments = assigned.filter((item, index) => assigned.findIndex((candidate) => candidate.assignedToStaffId === item.assignedToStaffId && candidate.kind === item.kind) === index);
    const stage = oversightStage(order.status, work, Boolean(order.returnedDevice?.repairs.length));
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: oversightStatusLabel(order.status),
      stage,
      deviceSerial: order.returnedDeviceSerial,
      model: order.returnedDevice?.model.name ?? "Device not identified",
      issue: order.customerFaultText?.trim() || order.customerFaultCategory?.replaceAll("_", " ") || "No customer description provided",
      flow: order.processType?.flow ?? null,
      assignments: uniqueAssignments.map((item) => ({ staffId: item.assignedToStaff!.id, name: item.assignedToStaff!.displayName, team: item.team, work: oversightWorkLabel(item.kind), status: item.status, pauseReason: item.pauseReason })),
      updatedAt: order.updatedAt.toISOString(),
      needsAttention: oversightNeedsAttention(order.status, work, order.updatedAt, staleBefore),
      overdue: order.status !== "closed" && order.updatedAt < overdueBefore,
      active: order.status !== "closed",
    };
  });

  const activeCases = cases.filter((item) => item.active);
  const assignedCaseCount = activeCases.filter((item) => item.assignments.length > 0).length;
  const attentionCaseCount = activeCases.filter((item) => item.needsAttention).length;

  return (
    <StaffShell name={staff.displayName} area="oversight">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-7">
        <p className="text-sm font-semibold text-[var(--green-strong)]">Operations oversight</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">Active repair cases</h1>
        <p className="mt-2 max-w-3xl text-black/50">See every active customer request, where it is in the workflow, and who currently owns the next action.</p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Active cases" value={activeCases.length} />
          <Metric label="Assigned cases" value={assignedCaseCount} />
          <Metric label="Unassigned cases" value={activeCases.length - assignedCaseCount} attention={activeCases.length - assignedCaseCount > 0} />
          <Metric label="Needs attention" value={attentionCaseCount} attention={attentionCaseCount > 0} />
        </div>

        <div className="mt-7"><ActiveCasesList cases={cases} canExportPii={hasPermission(staff.teams, "pii:export")} /></div>

        <div className="mt-7 grid gap-7 xl:grid-cols-[1fr_.7fr]">
          <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
            <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Claimed and paused work</h2><span className="text-xs text-black/40">Stale after {config.staleClaimDays} days</span></div>
            <div className="mt-4 divide-y divide-black/10">
              {owned.map((item) => {
                const stale = item.status === "claimed" && item.lastActivityAt <= staleBefore;
                return <Link key={item.id} href={`/staff/support/orders/${item.replacementOrderId}`} className={`grid gap-2 py-4 sm:grid-cols-[.7fr_1fr_.7fr_auto] ${stale ? "text-red-800" : ""}`}><span className="font-semibold">#{String(item.replacementOrder.orderNumber).padStart(4, "0")}</span><span className="text-sm">{oversightWorkLabel(item.kind)}</span><span className="text-sm">{item.assignedToStaff?.displayName ?? "Unassigned"}</span><span className="text-xs font-semibold uppercase">{stale ? "Stale" : item.status === "snoozed" ? item.pauseReason === "admin_review" ? "Waiting for admin" : "Waiting for customer" : item.status}</span></Link>;
              })}
              {!owned.length ? <p className="py-8 text-center text-sm text-black/40">No claimed or paused work.</p> : null}
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
            <h2 className="font-semibold">Customer outcomes</h2>
            <p className="mt-1 text-sm text-black/45">Completed resolution mix across all orders.</p>
            <div className="mt-5 space-y-3">{resolutions.map((row) => <div key={row.resolution} className="flex justify-between rounded-xl bg-black/[.035] px-4 py-3"><span className="text-sm capitalize">{row.resolution?.replaceAll("_", " ")}</span><strong>{row._count._all}</strong></div>)}{!resolutions.length ? <p className="text-sm text-black/40">No resolutions recorded yet.</p> : null}</div>
          </section>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-2">
          <AlertList title="Delivered but never scanned" empty="No unscanned delivered packages." items={deliveredNotScanned.map((shipment) => ({ key: shipment.id, title: shipment.trackingNumber ?? shipment.id.slice(0, 8), detail: `${shipment.type.replaceAll("_", " ")} · ${shipment.units.length} unit${shipment.units.length === 1 ? "" : "s"}`, age: shipment.deliveredAt }))} />
          <AlertList title="Checked in but not repaired" empty="No units are stuck in repair." items={stuckRepairs.map((repair) => ({ key: repair.id, title: repair.deviceSerial, detail: `${repair.device.model.name} · ${repair.status.replaceAll("_", " ")}`, age: repair.updatedAt }))} />
        </div>
      </div>
    </StaffShell>
  );
}

function Metric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return <article className={`rounded-2xl border p-5 ${attention ? "border-amber-300 bg-amber-50" : "border-black/10 bg-white"}`}><p className="text-sm text-black/50">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></article>;
}

function AlertList({ title, items, empty }: { title: string; items: { key: string; title: string; detail: string; age: Date | null }[]; empty: string }) {
  return <section className="rounded-[1.5rem] border border-black/10 bg-white p-6"><h2 className="font-semibold">{title}</h2><div className="mt-4 divide-y divide-black/10">{items.map((item) => <div key={item.key} className="py-4"><div className="flex justify-between gap-3"><p className="font-mono text-sm font-semibold">{item.title}</p><span className="text-xs text-black/40">{item.age?.toLocaleDateString()}</span></div><p className="mt-1 text-sm capitalize text-black/50">{item.detail}</p></div>)}{!items.length ? <p className="py-8 text-center text-sm text-black/40">{empty}</p> : null}</div></section>;
}
