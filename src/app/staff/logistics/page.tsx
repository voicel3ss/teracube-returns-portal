import { redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { prisma } from "@/db/prisma";
import { StaffShell } from "../support/staff-shell";
import { LogisticsWorkspace } from "./logistics-workspace";

export const dynamic = "force-dynamic";

export default async function LogisticsPage() {
  const staff = await getStaffContext();
  if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "shipment:dispatch")) {
    if (hasPermission(staff.teams, "repair:record")) redirect("/staff/repair");
    if (hasPermission(staff.teams, "order:view_all")) redirect("/staff/support");
    redirect("/staff/login");
  }
  const [orders, stock, transfers, recent] = await Promise.all([
    prisma.replacementOrder.findMany({ where: { reviewState: "reviewed", status: { in: ["awaiting_verification", "return_in_transit", "return_received"] }, outboundDeviceSerial: null }, include: { processType: true, returnedDevice: { include: { model: true } } }, orderBy: { updatedAt: "asc" }, take: 50 }),
    prisma.device.findMany({ where: { circulationState: "in_stock", grade: "refurbished" }, include: { model: true }, orderBy: { updatedAt: "asc" }, take: 100 }),
    prisma.shipment.findMany({ where: { type: "internal_transfer", status: { in: ["created", "label_ready", "in_transit"] } }, include: { units: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.shipment.findMany({ where: { status: { in: ["received", "in_transit", "label_ready"] } }, include: { replacementOrder: true, units: true }, orderBy: { updatedAt: "desc" }, take: 12 }),
  ]);
  return <StaffShell name={staff.displayName} area="logistics"><div className="mx-auto max-w-7xl px-5 py-8 sm:px-7"><p className="text-sm font-semibold text-[var(--green-strong)]">Logistics operations</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">Receive, reconcile, and dispatch</h1><p className="mt-2 text-black/50">Scan every physical handoff so the shipment record and serial ledger stay aligned.</p><div className="mt-7"><LogisticsWorkspace orders={orders.map((order) => ({ id: order.id, orderNumber: order.orderNumber, model: order.returnedDevice?.model.name ?? "Unidentified model", flow: order.processType?.flow ?? "regular", status: order.status }))} stock={stock.map((device) => ({ serial: device.serial, model: device.model.name }))} transfers={transfers.map((shipment) => ({ id: shipment.id, status: shipment.status, serials: shipment.units.map((unit) => unit.deviceSerial), labelFilename: shipment.labelFilename }))} /></div><section className="mt-7 rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent handoffs</h2><span className="text-sm text-black/40">{recent.length} shipments</span></div><div className="mt-5 divide-y divide-black/10">{recent.map((shipment) => <div key={shipment.id} className="grid gap-2 py-4 sm:grid-cols-[.7fr_1fr_1fr_.6fr]"><p className="text-sm font-semibold capitalize">{shipment.type.replaceAll("_", " ")}</p><p className="font-mono text-xs text-black/55">{shipment.trackingNumber ?? shipment.id.slice(0, 8)}</p><p className="text-sm text-black/55">{shipment.units.length} unit{shipment.units.length === 1 ? "" : "s"}</p><p className="text-sm font-medium capitalize">{shipment.status.replaceAll("_", " ")}</p></div>)}{!recent.length ? <p className="py-8 text-center text-sm text-black/40">No shipment handoffs recorded yet.</p> : null}</div></section></div></StaffShell>;
}
