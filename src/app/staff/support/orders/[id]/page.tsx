import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { prisma } from "@/db/prisma";
import { maskPii } from "@/security/pii";
import { StaffShell } from "../../staff-shell";
import { SupportOrderActions } from "./support-order-actions";
import { StaffConversation } from "./staff-conversation";

export const dynamic = "force-dynamic";

export default async function SupportOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("order:view_all");
  if (!staff) redirect("/staff/login");
  const { id } = await params;
  const order = await prisma.replacementOrder.findUnique({
    where: { id },
    include: {
      customer: { include: { emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
      returnedDevice: { include: { model: true } },
      processType: true,
      workItems: { where: { status: { not: "completed" } }, include: { assignedToStaff: true }, orderBy: { createdAt: "asc" } },
      messages: { include: { attachments: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();
  const events = await prisma.auditEvent.findMany({
    where: { entityType: "replacement_order", entityId: order.id },
    include: { actorStaff: true },
    orderBy: { occurredAt: "desc" },
    take: 30,
  });
  const activeItem = order.workItems[0] ?? null;
  const canAssign = hasPermission(staff.teams, "queue:assign");
  const assignableStaff = canAssign ? await prisma.staffUser.findMany({ where: { active: true, memberships: { some: { team: { in: ["support", "ops_lead", "admin"] } } } }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }) : [];
  const coverage = order.processType?.slug.startsWith("warranty-") ? "warranty" : "accident";
  const conversation = order.messages.map((message) => ({ id: message.id, senderKind: message.senderKind, body: message.body, sentAt: message.createdAt.toISOString(), photos: message.attachments.map((photo) => ({ id: photo.id, name: photo.filename, dataUrl: `data:${photo.contentType};base64,${Buffer.from(photo.data).toString("base64")}` })) }));

  return (
    <StaffShell name={staff.displayName} teams={staff.teams}>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-7">
        <Link href="/staff/support" className="text-sm font-semibold text-black/45">← Back to queue</Link>
        <div className="mt-5 grid gap-7 lg:grid-cols-[1fr_0.62fr]">
          <div className="space-y-5">
            <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-sm font-semibold text-[var(--green-strong)]">Replacement order</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">#{String(order.orderNumber).padStart(4, "0")}</h1></div>
                <div className="flex gap-2"><Badge>{order.status.replaceAll("_", " ")}</Badge><Badge>{order.reviewState.replaceAll("_", " ")}</Badge></div>
              </div>
              <dl className="mt-7 grid gap-5 border-t border-black/10 pt-6 sm:grid-cols-2">
                <Data label="Customer">{order.customer.emails[0] ? maskPii("parent_email", order.customer.emails[0].email) : "No email"}</Data>
                <Data label="Communication ticket">{order.communicationTicketId ?? "Not created"}</Data>
                <Data label="Device">{order.returnedDevice?.model.name ?? "Unidentified"}</Data>
                <Data label="Serial">{order.returnedDeviceSerial ?? "Not known"}</Data>
                <Data label="Replacement path">{order.processType?.name ?? "Not selected"}</Data>
                <Data label="Amount captured">${(order.amountPaidInCents / 100).toFixed(2)}</Data>
              </dl>
            </section>

            <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/40">Customer report</p>
              <h2 className="mt-2 text-xl font-semibold capitalize">{order.customerFaultCategory?.replaceAll("_", " ") ?? "No structured fault"}</h2>
              <p className="mt-3 whitespace-pre-wrap leading-7 text-black/60">{order.customerFaultText ?? "No description was supplied."}</p>
              {order.csVerifiedFault ? <div className="mt-5 rounded-xl bg-[var(--mint)]/20 p-4 text-sm"><strong>Support finding:</strong> {order.csVerifiedFault}</div> : null}
            </section>

            <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8">
              <h2 className="font-semibold">Order timeline</h2>
              <ol className="mt-5 space-y-4">
                {events.map((event) => (
                  <li key={event.id} className="grid grid-cols-[0.75rem_1fr] gap-3 text-sm"><span className="mt-1 size-2 rounded-full bg-[var(--green)]" /><div><p className="font-medium">{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</p><p className="mt-1 text-xs text-black/40">{event.actorStaff?.displayName ?? "Customer/system"} · {event.occurredAt.toLocaleString("en-US")}</p></div></li>
                ))}
              </ol>
            </section>

            <StaffConversation orderId={order.id} messages={conversation} canReply />
          </div>

          <aside>
            <SupportOrderActions
              orderId={order.id}
              workItem={activeItem ? { id: activeItem.id, status: activeItem.status, assignedToStaffId: activeItem.assignedToStaffId, assignedToName: activeItem.assignedToStaff?.displayName ?? null } : null}
              staffId={staff.id}
              canAssign={canAssign}
              assignableStaff={assignableStaff}
              reviewState={order.reviewState}
              initialFault={order.customerFaultText ?? ""}
              coverage={coverage}
              requiresFreeReason={Boolean(order.processType && order.processType.feeInCents === 0)}
              refundableDepositInCents={Math.max(0, Math.min(order.processType?.depositInCents ?? 0, order.amountPaidInCents) - order.depositRefundedInCents)}
              refundEligible={["return_in_transit", "return_received"].includes(order.status)}
            />
          </aside>
        </div>
      </div>
    </StaffShell>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-black/[0.055] px-3 py-1.5 text-xs font-semibold capitalize text-black/60">{children}</span>;
}

function Data({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-black/35">{label}</dt><dd className="mt-1.5 text-sm font-medium">{children}</dd></div>;
}
