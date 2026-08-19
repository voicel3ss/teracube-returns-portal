import { redirect } from "next/navigation";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { StaffShell } from "../support/staff-shell";
import { maskPii } from "@/security/pii";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await getAuthorizedStaff("order:view_all");
  if (!staff) redirect("/staff/login");
  const { q = "" } = await searchParams;
  const customers = await prisma.customer.findMany({
    where: {
      mergedIntoId: null,
      ...(q.trim() ? { OR: [
        { emails: { some: { normalized: { contains: q.trim().toLowerCase() } } } },
        { devices: { some: { serial: { contains: q.trim().toUpperCase(), mode: "insensitive" } } } },
      ] } : {}),
    },
    include: {
      emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      orders: { select: { returnedDeviceSerial: true, outboundDeviceSerial: true } },
      _count: { select: { devices: true, orders: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  const customerRows = customers.map((customer) => ({
    ...customer,
    associatedDeviceCount: new Set(customer.orders.flatMap((order) => [order.returnedDeviceSerial, order.outboundDeviceSerial].filter((serial): serial is string => Boolean(serial)))).size,
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
              <div key={customer.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{customer.emails[0] ? maskPii("parent_email", customer.emails[0].email) : "No email"}</p>
                  <p className="mt-1 text-xs text-black/40">{customer.emails.length} email{customer.emails.length === 1 ? "" : "s"} · {customer.associatedDeviceCount} associated device{customer.associatedDeviceCount === 1 ? "" : "s"} · {customer._count.orders} order{customer._count.orders === 1 ? "" : "s"}</p>
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
