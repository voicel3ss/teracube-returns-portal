import { redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { staffDestination } from "@/auth/staff-destination";
import { prisma } from "@/db/prisma";
import { StaffShell } from "../support/staff-shell";
import { maskPii } from "@/security/pii";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const staff = await getStaffContext();
  if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "order:view_all")) redirect(staffDestination(staff.teams));
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const normalizedQuery = q.trim();
  const serialQuery = normalizedQuery.toUpperCase();
  const customers = await prisma.customer.findMany({
    where: {
      mergedIntoId: null,
      AND: [
        { OR: [{ devices: { some: {} } }, { orders: { some: {} } }] },
        ...(normalizedQuery ? [{ OR: [
          { emails: { some: { normalized: { contains: normalizedQuery.toLowerCase() } } } },
          { devices: { some: { serial: { contains: serialQuery, mode: "insensitive" as const } } } },
          { orders: { some: { OR: [
            { returnedDeviceSerial: { contains: serialQuery, mode: "insensitive" as const } },
            { outboundDeviceSerial: { contains: serialQuery, mode: "insensitive" as const } },
          ] } } },
        ] }] : []),
      ],
    },
    include: {
      emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      devices: { select: { serial: true } },
      orders: { select: { id: true, orderNumber: true, status: true, returnedDeviceSerial: true, outboundDeviceSerial: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { devices: true, orders: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  const customerRows = customers.map((customer) => ({
    ...customer,
    associatedDeviceCount: new Set([...customer.devices.map((device) => device.serial), ...customer.orders.flatMap((order) => [order.returnedDeviceSerial, order.outboundDeviceSerial].filter((serial): serial is string => Boolean(serial)))]).size,
  }));

  return (
    <StaffShell name={staff.displayName} teams={staff.teams} area="customers">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-[var(--green-strong)]">Customer records</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">Search customers</h1>
          </div>
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Email or device serial" className="h-11 rounded-xl border border-black/15 bg-white px-4" />
            <button className="cursor-pointer rounded-xl bg-black px-5 text-sm font-semibold text-white">Search</button>
          </form>
        </div>
        <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5">
          <h2 className="font-semibold">Active customers</h2>
          <div className="mt-4 divide-y divide-black/8">
            {customerRows.map((customer) => (
              <div key={customer.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-start">
                <div className="min-w-0">
                  <p className="font-medium">{customer.emails[0] ? maskPii("parent_email", customer.emails[0].email) : "No email"}</p>
                  <p className="mt-1 text-xs text-black/40">{customer.emails.length} email{customer.emails.length === 1 ? "" : "s"} · {customer.associatedDeviceCount} associated device{customer.associatedDeviceCount === 1 ? "" : "s"} · {customer._count.orders} order{customer._count.orders === 1 ? "" : "s"}</p>
                  {customer.orders.length ? <div className="mt-3 flex flex-wrap gap-2">{customer.orders.map((order) => <Link key={order.id} href={`/staff/support/orders/${order.id}`} className="rounded-lg border border-black/10 bg-black/[.02] px-3 py-1.5 text-xs font-semibold hover:border-black/25">#{String(order.orderNumber).padStart(4, "0")} · {order.status.replaceAll("_", " ")}</Link>)}</div> : <p className="mt-2 text-xs text-black/35">No replacement requests yet.</p>}
                </div>
                <span className="font-mono text-xs text-black/30">Customer …{customer.id.slice(-6)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
