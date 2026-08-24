import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { staffDestination } from "@/auth/staff-destination";
import { prisma } from "@/db/prisma";
import { StaffShell } from "./staff-shell";
import { SupportIntakeLink } from "./support-intake-link";

export const dynamic = "force-dynamic";

const kindLabels = {
  claim_verification: "Verify claim",
  unidentified_device: "Identify device",
  return_discrepancy: "Resolve return discrepancy",
  fulfillment_blocked: "Resolve fulfillment block",
  deposit_refund: "Review deposit refund",
  needs_clarification: "Customer clarification",
  customer_message: "Customer message",
} as const;

export default async function SupportQueuePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const staff = await getStaffContext();
  if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "order:view_all")) redirect(staffDestination(staff.teams));
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const [items, searchResults] = await Promise.all([
    prisma.workItem.findMany({
      where: {
        team: "support",
        status: { in: ["open", "claimed", "snoozed"] },
      },
      include: {
        assignedToStaff: true,
        replacementOrder: {
          include: { customer: { include: { emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } }, returnedDevice: { include: { model: true } }, processType: true },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    q.trim()
      ? prisma.replacementOrder.findMany({
          where: {
            OR: [
              ...(Number.isFinite(Number(q)) ? [{ orderNumber: Number(q) }] : []),
              { returnedDeviceSerial: { contains: q.trim().toUpperCase(), mode: "insensitive" as const } },
              { customer: { emails: { some: { normalized: { contains: q.trim().toLowerCase() } } } } },
            ],
          },
          include: { customer: { include: { emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } }, returnedDevice: { include: { model: true } } },
          take: 12,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const myItems = items
    .filter((item) => item.assignedToStaffId === staff.id)
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  const teamItems = items.filter((item) => !item.assignedToStaffId);

  return (
    <StaffShell name={staff.displayName} teams={staff.teams}>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-7 sm:py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-sm font-semibold text-[var(--green-strong)]">Support operations</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">Claims needing attention</h1></div>
          <form className="flex w-full max-w-md gap-2">
            <input name="q" defaultValue={q} placeholder="Order, serial, or email" className="h-11 min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-4 outline-none focus:border-[var(--green-strong)]" />
            <button className="rounded-xl bg-black px-5 text-sm font-semibold text-white">Search</button>
          </form>
        </div>

        {hasPermission(staff.teams, "order:create") ? <SupportIntakeLink /> : null}

        {q ? (
          <section className="mt-7 rounded-2xl border border-black/10 bg-white p-5">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Search results</h2><Link href="/staff/support" className="text-sm text-black/45">Clear</Link></div>
            <div className="mt-4 grid gap-2">
              {searchResults.length ? searchResults.map((order) => {
                const overdue = order.status !== "closed" && order.updatedAt.getTime() < Date.now() - 86_400_000;
                return (
                <Link key={order.id} href={`/staff/support/orders/${order.id}`} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${overdue ? "border-red-200 bg-red-50 hover:border-red-400" : "border-black/8 hover:border-black/25"}`}>
                  <span><strong>#{String(order.orderNumber).padStart(4, "0")}</strong><span className="ml-3 text-sm text-black/45">{order.returnedDevice?.model.name ?? "Unidentified device"}</span></span>
                  <span className="max-w-[55%] text-right text-sm text-black/45">{formatEmails(order.customer.emails)}{overdue ? <span className="ml-2 font-semibold text-red-700">Over 24h</span> : null}</span>
                </Link>
                );
              }) : <p className="text-sm text-black/45">No matching orders.</p>}
            </div>
          </section>
        ) : null}

        <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_0.55fr]">
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">My work</h2><span className="rounded-full bg-black px-2.5 py-1 text-xs font-semibold text-white">{myItems.length}</span></div>
            <QueueList items={myItems} empty="Open a case from the team queue to start working." />
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Team queue</h2><span className="rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-semibold">{teamItems.length}</span></div>
            <QueueList items={teamItems} empty="The support queue is clear." />
          </section>
        </div>
      </div>
    </StaffShell>
  );
}

type QueueListItem = {
  id: string;
  kind: keyof typeof kindLabels;
  status: string;
  pauseReason: "customer_approval" | "admin_review" | null;
  replacementOrder: {
    id: string;
    orderNumber: number;
    returnedDeviceSerial: string | null;
    returnedDevice: { model: { name: string } } | null;
    processType: { name: string } | null;
    reviewState: string;
    status: string;
    updatedAt: Date;
    customer: { emails: Array<{ email: string }> };
  };
};

function QueueList({ items, empty }: { items: QueueListItem[]; empty: string }) {
  if (!items.length) return <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-8 text-sm text-black/45">{empty}</div>;
  return <div className="grid gap-3">{items.map((item) => {
    const order = item.replacementOrder;
    const overdue = order.status !== "closed" && order.updatedAt.getTime() < Date.now() - 86_400_000;
    return (
      <Link key={item.id} data-work-item-id={item.id} href={`/staff/support/orders/${order.id}`} className={`group rounded-2xl border p-5 shadow-[0_10px_30px_rgba(20,30,22,0.035)] transition hover:-translate-y-0.5 ${overdue ? "border-red-200 bg-red-50 hover:border-red-400" : "border-black/10 bg-white hover:border-black/25"}`}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--green-strong)]">{item.kind === "needs_clarification" ? "Customer replied" : kindLabels[item.kind]}</p><h3 className="mt-1 text-lg font-semibold">Order #{String(order.orderNumber).padStart(4, "0")}</h3>{overdue ? <span className="mt-2 inline-block rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-800">Over 24h</span> : null}</div><span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-medium">{item.status === "snoozed" ? item.pauseReason === "admin_review" ? "Waiting for admin" : "Waiting for customer" : item.status}</span></div>
        <p className="mt-3 text-sm text-black/55">{order.returnedDevice?.model.name ?? "Device not identified"} · {order.returnedDeviceSerial ?? "No serial"}</p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-black/8 pt-3 text-xs text-black/40"><span className="min-w-0 break-all">{formatEmails(order.customer.emails)}</span><span className="shrink-0">{order.processType?.name ?? "Manual review"} →</span></div>
      </Link>
    );
  })}</div>;
}

function formatEmails(emails: Array<{ email: string }>): string {
  return emails.length ? emails.map((email) => email.email).join(", ") : "No email";
}
