import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { staffDestination } from "@/auth/staff-destination";
import { DevicePiiField } from "@/components/device-pii-field";
import { PiiField } from "@/components/pii-field";
import { prisma } from "@/db/prisma";
import { oversightStatusLabel, oversightWorkLabel } from "@/domain/oversight-case";
import { maskPii } from "@/security/pii";
import { StaffShell } from "../../../support/staff-shell";

export const dynamic = "force-dynamic";

type Detail = { label: string; value: string };
type DeviceEvent = {
  id: string;
  at: Date;
  category: "device" | "order" | "conversation" | "work" | "shipment" | "repair" | "audit";
  title: string;
  actor: string;
  summary: string;
  details: Detail[];
  href?: string;
};

const categoryLabels: Record<DeviceEvent["category"], string> = {
  device: "Device",
  order: "Request",
  conversation: "Conversation",
  work: "Staff work",
  shipment: "Shipment",
  repair: "Repair",
  audit: "Audit",
};

export default async function DeviceEventsPage({ params }: { params: Promise<{ serial: string }> }) {
  const staff = await getStaffContext();
  if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "oversight:view")) redirect(staffDestination(staff.teams));
  const { serial: rawSerial } = await params;
  const serial = rawSerial.toUpperCase();

  const device = await prisma.device.findUnique({
    where: { serial },
    include: {
      model: true,
      currentOwner: { include: { emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
      repairs: { include: { photos: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!device) notFound();

  const orders = await prisma.replacementOrder.findMany({
    where: { OR: [{ returnedDeviceSerial: serial }, { outboundDeviceSerial: serial }] },
    include: {
      customer: { include: { emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
      processType: true,
      workItems: { include: { assignedToStaff: true }, orderBy: { createdAt: "asc" } },
      messages: { include: { attachments: { select: { id: true, filename: true, contentType: true, byteSize: true, createdAt: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  const orderIds = orders.map((order) => order.id);
  const shipments = await prisma.shipment.findMany({
    where: { OR: [{ replacementOrderId: { in: orderIds } }, { units: { some: { deviceSerial: serial } } }] },
    include: {
      units: true,
      trackingEvents: { orderBy: { occurredAt: "asc" } },
      replacementOrder: { select: { id: true, orderNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const workItems = orders.flatMap((order) => order.workItems);
  const relatedEntities = [
    { entityType: "device", ids: [serial] },
    { entityType: "replacement_order", ids: orderIds },
    { entityType: "work_item", ids: workItems.map((item) => item.id) },
    { entityType: "shipment", ids: shipments.map((shipment) => shipment.id) },
    { entityType: "repair", ids: device.repairs.map((repair) => repair.id) },
  ];
  const auditEvents = await prisma.auditEvent.findMany({
    where: { OR: relatedEntities.filter((entry) => entry.ids.length).map((entry) => ({ entityType: entry.entityType, entityId: { in: entry.ids } })) },
    include: { actorStaff: true },
    orderBy: { occurredAt: "asc" },
  });

  const events: DeviceEvent[] = [{
    id: `device-${serial}`,
    at: device.createdAt,
    category: "device",
    title: "Device registered",
    actor: "System",
    summary: `${device.model.name} entered the permanent serial ledger.`,
    details: details({ Serial: device.serial, Model: device.model.name, Grade: device.grade, "Circulation state": device.circulationState, "Registered at": formatDate(device.createdAt), "Last record update": formatDate(device.updatedAt) }),
  }];

  for (const order of orders) {
    events.push({
      id: `order-${order.id}`,
      at: order.submittedAt ?? order.createdAt,
      category: "order",
      title: `Request #${String(order.orderNumber).padStart(4, "0")} created`,
      actor: "Customer/system",
      summary: order.customerFaultText?.trim() || "A replacement request was linked to this device.",
      href: `/staff/support/orders/${order.id}`,
      details: details({ Status: oversightStatusLabel(order.status), Role: order.returnedDeviceSerial === serial ? "Returned device" : "Outbound replacement", Process: order.processType?.name, Flow: order.processType?.flow, "Review state": order.reviewState, Approval: order.approvalState, Resolution: order.resolution, "Customer fault": order.customerFaultCategory, "Verified fault": order.csVerifiedFault, "Free outcome reason": order.freeOutcomeReason, "Amount paid": money(order.amountPaidInCents), "Quoted fee": money(order.quotedFeeInCents), "Quoted deposit": money(order.quotedDepositInCents), "Deposit refunded": money(order.depositRefundedInCents), "Communication ticket": order.communicationTicketId, "Origin ticket": order.originationTicketId, "Submitted at": formatDate(order.submittedAt), "Last order update": formatDate(order.updatedAt) }),
    });

    for (const item of order.workItems) {
      events.push({
        id: `work-${item.id}`,
        at: item.createdAt,
        category: "work",
        title: oversightWorkLabel(item.kind),
        actor: item.assignedToStaff?.displayName ?? "Unassigned team queue",
        summary: `${capitalize(item.team)} work is ${item.status.replaceAll("_", " ")}.`,
        href: `/staff/support/orders/${order.id}`,
        details: details({ Order: `#${String(order.orderNumber).padStart(4, "0")}`, Team: item.team, Kind: item.kind, Status: item.status, "Assigned staff": item.assignedToStaff?.displayName, "Assignment note": item.assignmentNote, "Pause reason": item.pauseReason, "Last activity": formatDate(item.lastActivityAt), Created: formatDate(item.createdAt), Updated: formatDate(item.updatedAt) }),
      });
    }

    for (const message of order.messages) {
      events.push({
        id: `message-${message.id}`,
        at: message.createdAt,
        category: "conversation",
        title: `${capitalize(message.senderKind)} message`,
        actor: capitalize(message.senderKind),
        summary: message.body,
        href: `/staff/support/orders/${order.id}`,
        details: details({ Order: `#${String(order.orderNumber).padStart(4, "0")}`, Sender: message.senderKind, Message: message.body, Attachments: message.attachments.length ? message.attachments.map((file) => `${file.filename} (${file.contentType}, ${formatBytes(file.byteSize)})`).join("; ") : "None", Sent: formatDate(message.createdAt) }),
      });
    }
  }

  for (const shipment of shipments) {
    const carriesDevice = shipment.units.some((unit) => unit.deviceSerial === serial);
    events.push({
      id: `shipment-${shipment.id}`,
      at: shipment.createdAt,
      category: "shipment",
      title: `${capitalize(shipment.type.replaceAll("_", " "))} shipment created`,
      actor: shipment.provider ?? "Staff/system",
      summary: shipment.trackingNumber ? `${shipment.carrier ?? "Carrier"} tracking ${shipment.trackingNumber}` : "Tracking has not been recorded.",
      href: shipment.replacementOrderId ? `/staff/support/orders/${shipment.replacementOrderId}` : undefined,
      details: details({ Order: shipment.replacementOrder ? `#${String(shipment.replacementOrder.orderNumber).padStart(4, "0")}` : null, Type: shipment.type, Status: shipment.status, "Carries this serial": carriesDevice ? "Yes" : "Linked through its request", Units: shipment.units.map((unit) => `${unit.deviceSerial}${unit.observed ? " (observed)" : " (expected)"}`).join("; ") || "No serials attached", Carrier: shipment.carrier, Tracking: shipment.trackingNumber, Provider: shipment.provider, "Provider shipment ID": shipment.providerShipmentId, Fulfillment: shipment.fulfillmentType, "Label filename": shipment.labelFilename, "Label object key": shipment.labelObjectKey, "QR object key": shipment.qrCodeObjectKey, Cost: shipment.costInCents === null ? null : money(shipment.costInCents), "Contents present": shipment.contentsPresent, "Contents notes": shipment.contentsNotes, Delivered: formatDate(shipment.deliveredAt), Received: formatDate(shipment.receivedAt), Created: formatDate(shipment.createdAt), Updated: formatDate(shipment.updatedAt) }),
    });
    for (const tracking of shipment.trackingEvents) {
      events.push({
        id: `tracking-${tracking.id}`,
        at: tracking.occurredAt,
        category: "shipment",
        title: "Carrier tracking event",
        actor: shipment.carrier ?? shipment.provider ?? "Carrier",
        summary: tracking.description,
        details: details({ Tracking: shipment.trackingNumber, "Provider code": tracking.providerCode, Description: tracking.description, Occurred: formatDate(tracking.occurredAt), Recorded: formatDate(tracking.recordedAt), "Provider payload": json(tracking.rawPayload) }),
      });
    }
  }

  for (const repair of device.repairs) {
    events.push({
      id: `repair-${repair.id}`,
      at: repair.receivedAt,
      category: "repair",
      title: "Repair record opened",
      actor: "Repair team",
      summary: repair.repairTeamResolution ?? repair.detailedNotes ?? `Repair is ${repair.status.replaceAll("_", " ")}.`,
      href: `/staff/repair/${repair.id}`,
      details: details({ Status: repair.status, "Resolution category": repair.resolutionCategory, Resolution: repair.repairTeamResolution, Notes: repair.detailedNotes, "Terminal disposition": repair.terminalDisposition, "Terminal sub-disposition": repair.terminalSubDisposition, "Terminal reason": repair.terminalReason, Photos: repair.photos.length ? repair.photos.map((photo) => `${photo.objectKey}${photo.caption ? ` — ${photo.caption}` : ""}`).join("; ") : "None", Received: formatDate(repair.receivedAt), Completed: formatDate(repair.completedAt), Created: formatDate(repair.createdAt), Updated: formatDate(repair.updatedAt) }),
    });
  }

  const workOrderId = new Map(workItems.map((item) => [item.id, item.replacementOrderId]));
  const shipmentOrderId = new Map(shipments.map((shipment) => [shipment.id, shipment.replacementOrderId]));
  for (const audit of auditEvents) {
    const linkedOrderId = audit.entityType === "replacement_order" ? audit.entityId : audit.entityType === "work_item" ? workOrderId.get(audit.entityId) : audit.entityType === "shipment" ? shipmentOrderId.get(audit.entityId) : null;
    events.push({
      id: `audit-${audit.id}`,
      at: audit.occurredAt,
      category: "audit",
      title: audit.action.replaceAll("_", " ").replaceAll(".", " · "),
      actor: audit.actorStaff?.displayName ?? capitalize(audit.actorKind),
      summary: `${capitalize(audit.actorKind)} action recorded against ${audit.entityType.replaceAll("_", " ")}.`,
      href: linkedOrderId ? `/staff/support/orders/${linkedOrderId}` : audit.entityType === "repair" ? `/staff/repair/${audit.entityId}` : undefined,
      details: details({ Action: audit.action, "Actor name": audit.actorStaff?.displayName, "Actor type": audit.actorKind, "Entity type": audit.entityType, "Entity ID": audit.entityId, Metadata: json(audit.metadata), "IP address": audit.ipAddress, Occurred: formatDate(audit.occurredAt) }),
    });
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime());

  const people = new Map<string, { name: string; role: string; interactions: number }>();
  const addPerson = (key: string, name: string, role: string) => { const existing = people.get(key); people.set(key, { name, role, interactions: (existing?.interactions ?? 0) + 1 }); };
  for (const audit of auditEvents) addPerson(audit.actorStaffId ?? audit.actorKind, audit.actorStaff?.displayName ?? capitalize(audit.actorKind), audit.actorStaff ? "Staff" : capitalize(audit.actorKind));
  for (const item of workItems) if (item.assignedToStaff) addPerson(item.assignedToStaff.id, item.assignedToStaff.displayName, `${capitalize(item.team)} staff`);
  for (const order of orders) for (const message of order.messages) addPerson(`message-${message.senderKind}`, capitalize(message.senderKind), "Conversation participant");

  return <StaffShell name={staff.displayName} teams={staff.teams} area="oversight">
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-7">
      <Link href="/staff/oversight" className="text-sm font-semibold text-black/45">← Back to active cases</Link>
      <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-semibold text-[var(--green-strong)]">Permanent device history</p><h1 className="mt-1 font-mono text-3xl font-semibold tracking-[-.035em]">{device.serial}</h1><p className="mt-2 text-black/50">Every recorded interaction and lifecycle event for this physical unit.</p></div>
        <span className="w-fit rounded-full bg-black px-3 py-1.5 text-xs font-semibold capitalize text-white">{device.circulationState.replaceAll("_", " ")}</span>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Linked requests" value={orders.length} />
        <Metric label="Repairs" value={device.repairs.length} />
        <Metric label="Shipments" value={shipments.length} />
        <Metric label="Recorded events" value={events.length} />
      </div>

      <div className="mt-7 grid gap-7 xl:grid-cols-[.7fr_1.3fr]">
        <div className="space-y-7">
          <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
            <h2 className="font-semibold">Device record</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Data label="Model">{device.model.name}</Data><Data label="Model code">{device.model.code}</Data><Data label="Device type">{capitalize(device.model.deviceType)}</Data><Data label="Grade">{capitalize(device.grade)}</Data><Data label="State">{capitalize(device.circulationState.replaceAll("_", " "))}</Data><Data label="Registered">{formatDate(device.createdAt)}</Data>
              <Data label="ICCID"><DevicePiiField serial={device.serial} field="iccid" masked={device.iccid ? maskPii("iccid", device.iccid) : "Not available"} /></Data>
              <Data label="IMEI"><DevicePiiField serial={device.serial} field="imei" masked={device.imei ? maskPii("imei", device.imei) : "Not available"} /></Data>
              <Data label="Current owner emails">{emailList(device.currentOwner?.emails ?? [], "Not assigned")}</Data>
            </dl>
          </section>

          <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
            <h2 className="font-semibold">People and systems involved</h2>
            <div className="mt-4 divide-y divide-black/10">{[...people.values()].sort((a, b) => b.interactions - a.interactions).map((person) => <div key={`${person.name}-${person.role}`} className="flex justify-between gap-4 py-3"><div><p className="text-sm font-semibold">{person.name}</p><p className="mt-1 text-xs text-black/45">{person.role}</p></div><span className="text-xs font-semibold text-black/40">{person.interactions} interaction{person.interactions === 1 ? "" : "s"}</span></div>)}{!people.size ? <p className="py-6 text-sm text-black/45">No human or provider interactions are recorded yet.</p> : null}</div>
          </section>

          <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
            <h2 className="font-semibold">Linked requests</h2>
            <div className="mt-4 space-y-4">{orders.map((order) => <article key={order.id} className="rounded-xl border border-black/10 p-4"><div className="flex items-start justify-between gap-3"><div><Link href={`/staff/support/orders/${order.id}`} className="font-semibold underline decoration-black/15 underline-offset-4">Order #{String(order.orderNumber).padStart(4, "0")}</Link><p className="mt-1 text-xs capitalize text-black/45">{oversightStatusLabel(order.status)} · {order.returnedDeviceSerial === serial ? "returned unit" : "outbound unit"}</p></div><span className="text-xs text-black/40">{formatDate(order.createdAt, true)}</span></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><Data label="Parent emails">{emailList(order.customer.emails)}</Data><Data label="Shipping address"><PiiField orderId={order.id} field="parent_address" masked={order.encryptedShippingAddress ? "••••••••" : "Not available"} /></Data><Data label="Payment reference"><PiiField orderId={order.id} field="payment_reference" masked={order.paymentReference ? maskPii("payment_reference", order.paymentReference) : "Not available"} /></Data><Data label="Process">{order.processType?.name ?? "Not selected"}</Data></dl></article>)}{!orders.length ? <p className="text-sm text-black/45">No replacement requests are linked to this device.</p> : null}</div>
          </section>
        </div>

        <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Complete event timeline</h2><p className="mt-1 text-sm text-black/45">Newest first · timestamps shown in UTC</p></div><span className="text-sm font-semibold text-black/45">{events.length} events</span></div>
          <ol className="mt-6 space-y-4">{events.map((event) => <li key={event.id} className="grid grid-cols-[.8rem_1fr] gap-3"><span className="mt-2 size-2.5 rounded-full bg-[var(--green)] ring-4 ring-[var(--mint)]/20" /><article className="rounded-2xl border border-black/10 p-4"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-black/[.055] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-black/55">{categoryLabels[event.category]}</span><h3 className="text-sm font-semibold capitalize">{event.title}</h3></div><p className="mt-2 text-sm leading-6 text-black/60">{event.summary}</p></div><time className="shrink-0 text-xs text-black/40">{formatDate(event.at)}</time></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/8 pt-3"><p className="text-xs text-black/45">Actor: <strong className="text-black/65">{event.actor}</strong></p>{event.href ? <Link href={event.href} className="text-xs font-semibold text-[var(--green-strong)]">Open record →</Link> : null}</div><details className="mt-3 rounded-xl bg-black/[.025] px-3 py-2"><summary className="cursor-pointer text-xs font-semibold">All recorded details</summary><dl className="mt-3 grid gap-3 border-t border-black/8 pt-3 sm:grid-cols-2">{event.details.map((detail) => <Data key={`${event.id}-${detail.label}`} label={detail.label}>{detail.value}</Data>)}</dl></details></article></li>)}{!events.length ? <li className="text-sm text-black/45">No events have been recorded for this device.</li> : null}</ol>
        </section>
      </div>
    </div>
  </StaffShell>;
}

function Metric({ label, value }: { label: string; value: number }) { return <article className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-sm text-black/50">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></article>; }
function Data({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt className="text-[10px] font-semibold uppercase tracking-[.08em] text-black/35">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-xs font-medium leading-5">{children}</dd></div>; }
function details(values: Record<string, unknown>): Detail[] { return Object.entries(values).filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => ({ label, value: typeof value === "boolean" ? value ? "Yes" : "No" : String(value) })); }
function capitalize(value: string): string { return value ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value; }
function money(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }
function formatBytes(bytes: number): string { return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`; }
function emailList(emails: Array<{ email: string; isPrimary: boolean }>, empty = "Not available"): React.ReactNode { if (!emails.length) return empty; return <span className="space-y-1">{emails.map((email) => <span key={email.email} className="block break-all">{email.email}{email.isPrimary && emails.length > 1 ? <span className="ml-1 text-[10px] font-semibold uppercase text-black/35">Primary</span> : null}</span>)}</span>; }
function json(value: unknown): string | null { return value === null || value === undefined ? null : JSON.stringify(value, null, 2); }
function formatDate(value: Date | null, dateOnly = false): string | null { if (!value) return null; return new Intl.DateTimeFormat("en-US", dateOnly ? { dateStyle: "medium", timeZone: "UTC" } : { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(value); }
