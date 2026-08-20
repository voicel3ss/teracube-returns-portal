"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PiiField } from "@/components/pii-field";

type Order = { id: string; orderNumber: number; model: string; flow: string; status: string; customerSince: string; priorOrderCount: number; returnedSerial: string | null; repairHistory: Array<{ status: string; resolution: string | null }> };
type Stock = { serial: string; model: string; grade: "new" | "refurbished" };
type Transfer = { id: string; status: string; serials: string[]; observedSerials: string[]; labelFilename: string | null };
type PendingOutbound = { id: string; orderNumber: number; model: string };
type Action = "receipt" | "dispatch" | `upload:${string}` | `internal:${string}` | `allocate:${string}`;

export function LogisticsWorkspace({ orders, stock, transfers, pendingOutbound }: { orders: Order[]; stock: Stock[]; transfers: Transfer[]; pendingOutbound: PendingOutbound[] }) {
  const router = useRouter();
  const trackingInput = useRef<HTMLInputElement>(null);
  const observedInput = useRef<HTMLInputElement>(null);
  const [tracking, setTracking] = useState("");
  const [present, setPresent] = useState(true);
  const [observed, setObserved] = useState("");
  const [notes, setNotes] = useState("");
  const [orderId, setOrderId] = useState("");
  const [serial, setSerial] = useState("");
  const [unitGrade, setUnitGrade] = useState<"new" | "refurbished">("refurbished");
  const [carrier, setCarrier] = useState("USPS");
  const [outboundTracking, setOutboundTracking] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"manual" | "shopify_auto">("manual");
  const [transferInputs, setTransferInputs] = useState<Record<string, { serials: string; notes: string }>>({});
  const [allocationInputs, setAllocationInputs] = useState<Record<string, { serial: string; carrier: string; tracking: string }>>({});
  const [busyAction, setBusyAction] = useState<Action | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(action: Action, url: string, body: object) {
    setBusyAction(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action failed.");
      setMessage(data.result ? `Package recorded: ${data.result}.` : "Shipment updated.");
      if (action === "receipt") {
        setTracking("");
        setPresent(true);
        setObserved("");
        setNotes("");
      } else if (action === "dispatch") {
        setOrderId("");
        setSerial("");
        setCarrier("USPS");
        setOutboundTracking("");
        setFulfillmentType("manual");
        setUnitGrade("refurbished");
      } else if (action.startsWith("internal:")) {
        setTransferInputs((current) => ({ ...current, [action.slice(9)]: { serials: "", notes: "" } }));
      } else if (action.startsWith("allocate:")) {
        setAllocationInputs((current) => ({ ...current, [action.slice(9)]: { serial: "", carrier: "USPS", tracking: "" } }));
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadLabel(shipmentId: string, file: File | undefined) {
    if (!file) return;
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    await post(`upload:${shipmentId}`, "/api/staff/logistics/transfer-label", { shipmentId, filename: file.name, contentType: file.type, data });
  }

  const receiving = busyAction === "receipt";
  const dispatching = busyAction === "dispatch";
  const selectedOrder = orders.find((order) => order.id === orderId);
  const availableStock = stock.filter((device) => device.grade === unitGrade && (!selectedOrder || device.model === selectedOrder.model));

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--green-strong)]">Inbound check-in</p>
        <h2 className="mt-2 text-xl font-semibold">Inspect a returned package</h2>
        <label className="mt-5 block text-sm font-semibold">Carrier tracking barcode<input ref={trackingInput} value={tracking} onChange={(event) => setTracking(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3 font-mono text-sm" /></label>
        <label className="mt-4 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={present} onChange={(event) => setPresent(event.target.checked)} className="size-4" />Device is inside</label>
        {present ? <label className="mt-4 block text-sm font-semibold">Observed device serial<input ref={observedInput} value={observed} onChange={(event) => setObserved(event.target.value.toUpperCase())} placeholder="202112T2E235968" className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3 font-mono text-sm" /></label> : null}
        <label className="mt-4 block text-sm font-semibold">Contents notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-black/15 p-3 text-sm" /></label>
        <button onClick={() => post("receipt", "/api/staff/logistics/receive", { trackingNumber: trackingInput.current?.value ?? tracking, contentsPresent: present, observedSerial: observedInput.current?.value ?? observed, notes })} disabled={receiving || !tracking.trim() || (present && !observed.trim())} className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-black text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{receiving ? "Recording receipt…" : "Record receipt"}</button>
      </section>

      <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--green-strong)]">Outbound replacement</p>
        <h2 className="mt-2 text-xl font-semibold">Dispatch a replacement</h2>
        <label className="mt-5 block text-sm font-semibold">Ready order<select value={orderId} onChange={(event) => setOrderId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3 text-sm"><option value="">Select an order</option>{orders.map((order) => <option key={order.id} value={order.id}>#{String(order.orderNumber).padStart(4, "0")} · {order.model} · {order.flow}</option>)}</select></label>
        {selectedOrder ? <div className="mt-3 rounded-xl bg-black/[.035] p-3 text-xs leading-5 text-black/60"><p><span className="font-semibold text-black/75">Returned serial:</span> {selectedOrder.returnedSerial ?? "Not identified"}</p><p><span className="font-semibold text-black/75">Customer since:</span> {new Date(selectedOrder.customerSince).toLocaleDateString("en-US")} · {selectedOrder.priorOrderCount} prior request{selectedOrder.priorOrderCount === 1 ? "" : "s"}</p><p><span className="font-semibold text-black/75">Repair history:</span> {selectedOrder.repairHistory.length ? selectedOrder.repairHistory.map((repair) => repair.resolution ?? repair.status.replaceAll("_", " ")).join("; ") : "No prior repairs recorded"}</p><p><span className="font-semibold text-black/75">Ship to:</span> <PiiField orderId={selectedOrder.id} field="parent_address" masked="••••••••" /></p></div> : null}
        <label className="mt-4 block text-sm font-semibold">Replacement condition<select value={unitGrade} onChange={(event) => { setUnitGrade(event.target.value as "new" | "refurbished"); setSerial(""); }} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3 text-sm"><option value="refurbished">Refurbished</option><option value="new">New</option></select></label>
        <label className="mt-4 block text-sm font-semibold">Assigned serial <span className="font-normal text-black/45">{fulfillmentType === "shopify_auto" ? "(optional until allocated)" : "(required)"}</span><select value={serial} onChange={(event) => setSerial(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3 font-mono text-sm"><option value="">{fulfillmentType === "shopify_auto" ? "Assign later" : "Select stock"}</option>{availableStock.map((device) => <option key={device.serial} value={device.serial}>{device.serial} · {device.model}</option>)}</select></label>
        <label className="mt-4 block text-sm font-semibold">Fulfillment<select value={fulfillmentType} onChange={(event) => setFulfillmentType(event.target.value as "manual" | "shopify_auto")} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3"><option value="manual">Manual</option><option value="shopify_auto">Shopify automatic</option></select></label>
        {fulfillmentType === "manual" ? <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Carrier<input value={carrier} onChange={(event) => setCarrier(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3" /></label><label className="text-sm font-semibold">Tracking<input value={outboundTracking} onChange={(event) => setOutboundTracking(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3" /></label></div> : <p className="mt-3 rounded-xl bg-[#87F5CB]/25 p-3 text-xs leading-5 text-black/65">Shopify creates the fulfillment now. A serial and tracking number can be attached later when Shopify allocates the package.</p>}
        <button onClick={() => post("dispatch", "/api/staff/logistics/dispatch", { orderId, serial, unitGrade, carrier, trackingNumber: outboundTracking, fulfillmentType })} disabled={dispatching || !orderId || (fulfillmentType === "manual" && (!serial || !carrier.trim() || !outboundTracking.trim()))} className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-black text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{dispatching ? "Confirming dispatch…" : fulfillmentType === "shopify_auto" ? "Create Shopify fulfillment" : "Confirm dispatch"}</button>
      </section>

      <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--green-strong)]">Internal transfers</p>
        <h2 className="mt-2 text-xl font-semibold">Attach warehouse labels</h2>
        <p className="mt-2 text-sm text-black/50">Repair batches remain traceable by their exact serial list.</p>
        <div className="mt-5 divide-y divide-black/10">{transfers.map((transfer) => {
          const uploading = busyAction === `upload:${transfer.id}`;
          const receivingTransfer = busyAction === `internal:${transfer.id}`;
          const input = transferInputs[transfer.id] ?? { serials: transfer.observedSerials.join("\n"), notes: "" };
          return <div key={transfer.id} className="py-4"><div className="flex justify-between gap-3"><p className="font-mono text-xs font-semibold">{transfer.id.slice(0, 8)}</p><span className="text-xs capitalize text-black/45">{transfer.status.replaceAll("_", " ")}</span></div><p className="mt-2 text-sm font-semibold text-black/65">Expected serials ({transfer.serials.length})</p><p className="mt-1 break-all font-mono text-xs leading-5 text-black/45">{transfer.serials.join(", ")}</p><label className={`mt-3 inline-flex rounded-lg border border-black/15 px-3 py-2 text-xs font-semibold ${uploading ? "cursor-wait opacity-45" : "cursor-pointer hover:bg-black/[.03]"}`}>{uploading ? "Uploading label…" : transfer.labelFilename ?? "Choose label file"}<input type="file" accept="application/pdf,image/png,image/jpeg" disabled={uploading} className="sr-only" onChange={(event) => uploadLabel(transfer.id, event.target.files?.[0])} /></label><label className="mt-4 block text-xs font-semibold">Observed serials, one per line<textarea rows={3} value={input.serials} onChange={(event) => setTransferInputs((current) => ({ ...current, [transfer.id]: { ...input, serials: event.target.value.toUpperCase() } }))} className="mt-1.5 w-full rounded-lg border border-black/15 p-3 font-mono text-xs" /></label><label className="mt-3 block text-xs font-semibold">Warehouse notes<input value={input.notes} onChange={(event) => setTransferInputs((current) => ({ ...current, [transfer.id]: { ...input, notes: event.target.value } }))} className="mt-1.5 h-10 w-full rounded-lg border border-black/15 px-3 text-sm" /></label><button onClick={() => post(`internal:${transfer.id}`, "/api/staff/logistics/internal-receive", { shipmentId: transfer.id, observedSerials: input.serials.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean), notes: input.notes })} disabled={receivingTransfer || !input.serials.trim()} className="mt-3 h-10 w-full cursor-pointer rounded-lg bg-black text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{receivingTransfer ? "Reconciling…" : transfer.status === "exception" ? "Recheck warehouse receipt" : "Record warehouse receipt"}</button></div>;
        })}{!transfers.length ? <p className="py-8 text-center text-sm text-black/40">No repair batches are waiting for transfer.</p> : null}</div>
      </section>

      <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 xl:col-span-3">
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--green-strong)]">Pending Shopify allocation</p>
        <h2 className="mt-2 text-xl font-semibold">Attach the serial and tracking when Shopify fulfills</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">{pendingOutbound.map((shipment) => {
          const input = allocationInputs[shipment.id] ?? { serial: "", carrier: "USPS", tracking: "" };
          const allocating = busyAction === `allocate:${shipment.id}`;
          const matchingStock = stock.filter((device) => device.model === shipment.model);
          return <div key={shipment.id} className="rounded-2xl border border-black/10 p-4"><p className="font-semibold">#{String(shipment.orderNumber).padStart(4, "0")} · {shipment.model}</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><select aria-label="Allocated serial" value={input.serial} onChange={(event) => setAllocationInputs((current) => ({ ...current, [shipment.id]: { ...input, serial: event.target.value } }))} className="h-10 rounded-lg border border-black/15 px-3 font-mono text-xs"><option value="">Select serial</option>{matchingStock.map((device) => <option key={device.serial} value={device.serial}>{device.serial} · {device.grade}</option>)}</select><input aria-label="Carrier" value={input.carrier} onChange={(event) => setAllocationInputs((current) => ({ ...current, [shipment.id]: { ...input, carrier: event.target.value } }))} className="h-10 rounded-lg border border-black/15 px-3 text-sm" /><input aria-label="Tracking number" placeholder="Tracking number" value={input.tracking} onChange={(event) => setAllocationInputs((current) => ({ ...current, [shipment.id]: { ...input, tracking: event.target.value } }))} className="h-10 rounded-lg border border-black/15 px-3 text-sm" /></div><button onClick={() => post(`allocate:${shipment.id}`, "/api/staff/logistics/allocate-outbound", { shipmentId: shipment.id, serial: input.serial, carrier: input.carrier, trackingNumber: input.tracking })} disabled={allocating || !input.serial || !input.carrier.trim() || !input.tracking.trim()} className="mt-3 h-10 w-full cursor-pointer rounded-lg bg-black text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{allocating ? "Attaching…" : "Attach and dispatch"}</button></div>;
        })}{!pendingOutbound.length ? <p className="text-sm text-black/40">No Shopify fulfillments are waiting for serial allocation.</p> : null}</div>
      </section>

      {message || error ? <p role="status" className={`rounded-xl border p-3 text-sm xl:col-span-3 ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ?? message}</p> : null}
    </div>
  );
}
