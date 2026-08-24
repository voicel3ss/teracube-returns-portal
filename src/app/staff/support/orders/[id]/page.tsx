import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { staffDestination } from "@/auth/staff-destination";
import { prisma } from "@/db/prisma";
import { maskPii } from "@/security/pii";
import { StaffShell } from "../../staff-shell";
import { SupportOrderActions } from "./support-order-actions";
import { StaffConversation } from "./staff-conversation";
import { PiiField } from "@/components/pii-field";
import { refundableDepositInCents } from "@/domain/order-pricing";
import { selectSupportWorkItem } from "@/domain/support-work-selection";
import { isDepositRefundEligible } from "@/domain/support-review";

export const dynamic = "force-dynamic";

export default async function SupportOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "order:view_all")) redirect(staffDestination(staff.teams));
  const { id } = await params;
  const order = await prisma.replacementOrder.findUnique({
    where: { id },
    include: {
      customer: { include: { emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
      returnedDevice: { include: { model: true } },
      processType: true,
      workItems: { where: { status: { not: "completed" } }, include: { assignedToStaff: true }, orderBy: { createdAt: "asc" } },
      messages: { include: { attachments: true }, orderBy: { createdAt: "asc" } },
      shipments: { where: { type: "inbound" }, select: { status: true } },
    },
  });
  if (!order) notFound();
  const config = await prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const events = await prisma.auditEvent.findMany({
    where: { entityType: "replacement_order", entityId: order.id },
    include: { actorStaff: true },
    orderBy: { occurredAt: "desc" },
    take: 30,
  });
  const activeItem = selectSupportWorkItem(order.workItems, { status: order.status, reviewState: order.reviewState });
  const refundItem = order.workItems.find((item) => item.kind === "deposit_refund");
  const canAssign = hasPermission(staff.teams, "queue:assign");
  const canCompleteAdminReview = hasPermission(staff.teams, "config:manage");
  const assignableStaff = canAssign ? await prisma.staffUser.findMany({ where: { active: true, memberships: { some: { team: { in: ["support", "ops_lead", "admin"] } } } }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }) : [];
  const coverage = order.processType?.slug.startsWith("warranty-") ? "warranty" : "accident";
  const displayedStatus = order.reviewState === "needs_clarification"
    ? "waiting for customer"
    : order.reviewState === "reviewed" && order.status === "awaiting_verification"
      ? "verified"
      : order.status.replaceAll("_", " ");
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
                <Badge>{displayedStatus}</Badge>
              </div>
              <dl className="mt-7 grid gap-5 border-t border-black/10 pt-6 sm:grid-cols-2">
                <Data label="Customer"><PiiField orderId={order.id} field="parent_email" masked={order.customer.emails[0] ? maskPii("parent_email", order.customer.emails[0].email) : "No email"} /></Data>
                <Data label="Communication ticket">{order.communicationTicketId ?? "Not created"}</Data>
                <Data label="Device">{order.returnedDevice?.model.name ?? "Unidentified"}</Data>
                <Data label="Serial">{order.returnedDeviceSerial ?? "Not known"}</Data>
                <Data label="Replacement path">{order.processType?.name ?? "Not selected"}</Data>
                <Data label="Amount captured">${(order.amountPaidInCents / 100).toFixed(2)}</Data>
                <Data label="Quoted fee">${(order.quotedFeeInCents / 100).toFixed(2)}</Data>
                <Data label="Quoted deposit">${(order.quotedDepositInCents / 100).toFixed(2)}</Data>
                <Data label="Payment reference"><PiiField orderId={order.id} field="payment_reference" masked={order.paymentReference ? maskPii("payment_reference", order.paymentReference) : "Not available"} /></Data>
                <Data label="Shipping address"><PiiField orderId={order.id} field="parent_address" masked={order.encryptedShippingAddress ? "••••••••" : "Not available"} /></Data>
                <Data label="Customer outcome">{order.resolution?.replaceAll("_", " ") ?? "Not decided"}</Data>
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

            <StaffConversation orderId={order.id} messages={conversation} canReply={activeItem?.assignedToStaffId === staff.id} />
          </div>

          <aside>
            <SupportOrderActions
              key={`${order.id}-${order.status}-${order.reviewState}-${order.resolution ?? "none"}`}
              orderId={order.id}
              orderStatus={order.status}
              workItem={activeItem ? { id: activeItem.id, status: activeItem.status, assignedToStaffId: activeItem.assignedToStaffId, assignedToName: activeItem.assignedToStaff?.displayName ?? null, pauseReason: activeItem.pauseReason } : null}
              staffId={staff.id}
              canAssign={canAssign}
              canCompleteAdminReview={canCompleteAdminReview}
              assignableStaff={assignableStaff}
              reviewState={order.reviewState}
              initialFault={order.customerFaultText ?? ""}
              coverage={coverage}
              resolution={order.resolution}
              requiresFreeReason={Boolean(order.processType && order.quotedFeeInCents === 0)}
              refundableDepositInCents={refundableDepositInCents(order)}
              refundEligible={isDepositRefundEligible({ orderStatus: order.status, inboundShipmentStatuses: order.shipments.map((shipment) => shipment.status), refundGate: config.depositRefundGate === "return_received" ? "return_received" : "return_in_transit" })}
              refundGate={config.depositRefundGate === "return_received" ? "return_received" : "return_in_transit"}
              refundOwnedByMe={refundItem?.assignedToStaffId === staff.id}
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
