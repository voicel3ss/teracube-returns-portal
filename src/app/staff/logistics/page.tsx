import { redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { staffDestination } from "@/auth/staff-destination";
import { prisma } from "@/db/prisma";
import { effectiveShipmentStatus, isInboundStillExpected } from "@/domain/shipment-presentation";
import { StaffShell } from "../support/staff-shell";
import { LogisticsWorkspace } from "./logistics-workspace";

export const dynamic = "force-dynamic";

export default async function LogisticsPage() {
  const staff = await getStaffContext();
  if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "shipment:dispatch")) redirect(staffDestination(staff.teams));

  const [orders, stock, transfers, expectedInbound, pendingOutbound, recent] = await Promise.all([
    prisma.replacementOrder.findMany({ where: { reviewState: "reviewed", shipments: { none: { type: "outbound", status: { not: "exception" } } }, OR: [
      { processType: { flow: "advance" }, status: { in: ["awaiting_verification", "return_in_transit", "return_received"] } },
      { processType: { flow: "regular" }, status: { in: ["return_in_transit", "return_received"] } },
    ] }, include: { processType: true, customer: { include: { _count: { select: { orders: true } } } }, returnedDevice: { include: { model: true, repairs: { orderBy: { createdAt: "desc" }, take: 5 } } } }, orderBy: { updatedAt: "asc" }, take: 50 }),
    prisma.device.findMany({ where: { circulationState: "in_stock", shipmentUnits: { none: { shipment: { type: "internal_transfer", status: { in: ["created", "label_ready", "in_transit", "exception"] } } } } }, include: { model: true }, orderBy: { updatedAt: "asc" }, take: 100 }),
    prisma.shipment.findMany({ where: { type: "internal_transfer", status: { in: ["created", "label_ready", "in_transit", "exception"] } }, include: { units: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.shipment.findMany({
      where: { type: "inbound", status: { in: ["label_ready", "in_transit", "delivered", "exception"] } },
      include: { replacementOrder: { include: { returnedDevice: { include: { model: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.shipment.findMany({ where: { type: "outbound", status: "created" }, include: { replacementOrder: { include: { returnedDevice: { include: { model: true } } } } }, orderBy: { createdAt: "asc" }, take: 50 }),
    prisma.shipment.findMany({ where: { status: { in: ["received", "in_transit", "label_ready"] } }, include: { replacementOrder: true, units: true }, orderBy: { updatedAt: "desc" }, take: 12 }),
  ]);
  const inboundStillExpected = expectedInbound.filter((shipment) => isInboundStillExpected(shipment.replacementOrder?.status ?? null));

  return (
    <StaffShell name={staff.displayName} teams={staff.teams} area="logistics">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-7">
        <p className="text-sm font-semibold text-[var(--green-strong)]">Logistics operations</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">Receive, reconcile, and dispatch</h1>
        <p className="mt-2 text-black/50">Scan every physical handoff so the shipment record and serial ledger stay aligned.</p>

        <ExpectedInbound shipments={inboundStillExpected.map((shipment) => ({
          id: shipment.id,
          tracking: shipment.trackingNumber,
          status: shipment.status,
          orderNumber: shipment.replacementOrder?.orderNumber ?? null,
          expectedSerial: shipment.replacementOrder?.returnedDeviceSerial ?? null,
          model: shipment.replacementOrder?.returnedDevice?.model.name ?? "Unidentified model",
        }))} />

        <div className="mt-7"><LogisticsWorkspace orders={orders.map((order) => ({ id: order.id, orderNumber: order.orderNumber, model: order.returnedDevice?.model.name ?? "Unidentified model", flow: order.processType?.flow ?? "regular", status: order.status, customerSince: order.customer.createdAt.toISOString(), priorOrderCount: Math.max(0, order.customer._count.orders - 1), returnedSerial: order.returnedDeviceSerial, repairHistory: order.returnedDevice?.repairs.map((repair) => ({ status: repair.status, resolution: repair.repairTeamResolution ?? repair.terminalReason })) ?? [] }))} stock={stock.map((device) => ({ serial: device.serial, model: device.model.name, grade: device.grade }))} transfers={transfers.map((shipment) => ({ id: shipment.id, status: shipment.status, serials: shipment.units.map((unit) => unit.deviceSerial), observedSerials: readObservedSerials(shipment.contentsNotes, shipment.units.filter((unit) => unit.observed).map((unit) => unit.deviceSerial)), labelFilename: shipment.labelFilename }))} pendingOutbound={pendingOutbound.map((shipment) => ({ id: shipment.id, orderNumber: shipment.replacementOrder?.orderNumber ?? 0, model: shipment.replacementOrder?.returnedDevice?.model.name ?? "Unknown model" }))} /></div>

        <section className="mt-7 rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Recent handoffs</h2><span className="text-sm text-black/40">{recent.length} shipments</span></div>
          <div className="mt-5 divide-y divide-black/10">
            {recent.map((shipment) => {
              const status = effectiveShipmentStatus(shipment.type, shipment.status, shipment.replacementOrder?.status ?? null);
              return <div key={shipment.id} className="grid gap-2 py-4 sm:grid-cols-[.7fr_1fr_1fr_.6fr]"><p className="text-sm font-semibold capitalize">{shipment.type.replaceAll("_", " ")}</p><p className="font-mono text-xs text-black/55">{shipment.trackingNumber ?? shipment.id.slice(0, 8)}</p><p className="text-sm text-black/55">{shipment.units.length} unit{shipment.units.length === 1 ? "" : "s"}</p><p className="text-sm font-medium capitalize">{status.replaceAll("_", " ")}</p></div>;
            })}
            {!recent.length ? <p className="py-8 text-center text-sm text-black/40">No shipment handoffs recorded yet.</p> : null}
          </div>
        </section>
      </div>
    </StaffShell>
  );
}

function readObservedSerials(contentsNotes: string | null, fallback: string[]) {
  if (!contentsNotes) return fallback;
  try {
    const value = JSON.parse(contentsNotes) as { observedSerials?: unknown };
    return Array.isArray(value.observedSerials) ? value.observedSerials.filter((item): item is string => typeof item === "string") : fallback;
  } catch { return fallback; }
}

type ExpectedShipment = { id: string; tracking: string | null; status: string; orderNumber: number | null; expectedSerial: string | null; model: string };

function ExpectedInbound({ shipments }: { shipments: ExpectedShipment[] }) {
  return (
    <section className="mt-7 rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Expected inbound packages</h2><p className="mt-1 text-sm text-black/45">Compare each delivered package with the device serial expected on its order.</p></div>
        <span className="text-sm font-medium text-black/45">{shipments.filter((shipment) => shipment.status !== "received").length} still expected</span>
      </div>
      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[760px] divide-y divide-black/10">
          <div className="grid grid-cols-[1.1fr_.65fr_1fr_.8fr] gap-4 pb-3 text-xs font-semibold uppercase tracking-[.08em] text-black/35"><span>Tracking</span><span>Order</span><span>Expected serial</span><span>Model</span></div>
          {shipments.map((shipment) => (
            <div key={shipment.id} className="grid grid-cols-[1.1fr_.65fr_1fr_.8fr] items-center gap-4 py-4 text-sm">
              <div><p className="font-mono text-xs font-semibold">{shipment.tracking ?? "Tracking pending"}</p><p className="mt-1 text-xs capitalize text-black/40">{shipment.status.replaceAll("_", " ")}</p></div>
              <span className="font-semibold">{shipment.orderNumber ? `#${String(shipment.orderNumber).padStart(4, "0")}` : "—"}</span>
              <span className="font-mono text-xs font-semibold">{shipment.expectedSerial ?? "Not identified"}</span>
              <span>{shipment.model}</span>
            </div>
          ))}
          {!shipments.length ? <p className="py-10 text-center text-sm text-black/40">No inbound packages are currently expected.</p> : null}
        </div>
      </div>
    </section>
  );
}
