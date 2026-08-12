"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Order = { id: string; orderNumber: number; model: string; flow: string; status: string };
type Stock = { serial: string; model: string };
type Transfer = { id: string; status: string; serials: string[]; labelFilename: string | null };
type Action = "receipt" | "dispatch" | `upload:${string}`;

export function LogisticsWorkspace({ orders, stock, transfers }: { orders: Order[]; stock: Stock[]; transfers: Transfer[] }) {
  const router = useRouter();
  const trackingInput = useRef<HTMLInputElement>(null);
  const observedInput = useRef<HTMLInputElement>(null);
  const [tracking, setTracking] = useState("");
  const [present, setPresent] = useState(true);
  const [observed, setObserved] = useState("");
  const [notes, setNotes] = useState("");
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [serial, setSerial] = useState(stock[0]?.serial ?? "");
  const [carrier, setCarrier] = useState("USPS");
  const [outboundTracking, setOutboundTracking] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"manual" | "shopify_auto">("manual");
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

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--green-strong)]">Inbound check-in</p>
        <h2 className="mt-2 text-xl font-semibold">Inspect a returned package</h2>
        <label className="mt-5 block text-sm font-semibold">Carrier tracking barcode<input ref={trackingInput} value={tracking} onChange={(event) => setTracking(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3 font-mono text-sm" /></label>
        <label className="mt-4 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={present} onChange={(event) => setPresent(event.target.checked)} className="size-4" />Device is inside</label>
        {present ? <label className="mt-4 block text-sm font-semibold">Observed device serial<input ref={observedInput} value={observed} onChange={(event) => setObserved(event.target.value.toUpperCase())} placeholder="202112T2E235968" className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3 font-mono text-sm" /></label> : null}
        <label className="mt-4 block text-sm font-semibold">Contents notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-black/15 p-3 text-sm" /></label>
        <button onClick={() => post("receipt", "/api/staff/logistics/receive", { trackingNumber: trackingInput.current?.value ?? tracking, contentsPresent: present, observedSerial: observedInput.current?.value ?? observed, notes })} disabled={receiving} className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-black text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-35">{receiving ? "Recording receipt…" : "Record receipt"}</button>
      </section>

      <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--green-strong)]">Outbound replacement</p>
        <h2 className="mt-2 text-xl font-semibold">Dispatch an in-stock refurb</h2>
        <label className="mt-5 block text-sm font-semibold">Ready order<select value={orderId} onChange={(event) => setOrderId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3 text-sm"><option value="">Select an order</option>{orders.map((order) => <option key={order.id} value={order.id}>#{String(order.orderNumber).padStart(4, "0")} · {order.model} · {order.flow}</option>)}</select></label>
        <label className="mt-4 block text-sm font-semibold">Refurbished serial<select value={serial} onChange={(event) => setSerial(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3 font-mono text-sm"><option value="">Select stock</option>{stock.map((device) => <option key={device.serial} value={device.serial}>{device.serial} · {device.model}</option>)}</select></label>
        <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Carrier<input value={carrier} onChange={(event) => setCarrier(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3" /></label><label className="text-sm font-semibold">Tracking<input value={outboundTracking} onChange={(event) => setOutboundTracking(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3" /></label></div>
        <label className="mt-4 block text-sm font-semibold">Fulfillment<select value={fulfillmentType} onChange={(event) => setFulfillmentType(event.target.value as "manual" | "shopify_auto")} className="mt-2 h-11 w-full rounded-xl border border-black/15 px-3"><option value="manual">Manual</option><option value="shopify_auto">Shopify automatic</option></select></label>
        <button onClick={() => post("dispatch", "/api/staff/logistics/dispatch", { orderId, serial, carrier, trackingNumber: outboundTracking, fulfillmentType })} disabled={dispatching || !orderId || !serial || !carrier.trim() || !outboundTracking.trim()} className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-black text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{dispatching ? "Confirming dispatch…" : "Confirm dispatch"}</button>
      </section>

      <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--green-strong)]">Internal transfers</p>
        <h2 className="mt-2 text-xl font-semibold">Attach warehouse labels</h2>
        <p className="mt-2 text-sm text-black/50">Repair batches remain traceable by their exact serial list.</p>
        <div className="mt-5 divide-y divide-black/10">{transfers.map((transfer) => {
          const uploading = busyAction === `upload:${transfer.id}`;
          return <div key={transfer.id} className="py-4"><div className="flex justify-between gap-3"><p className="font-mono text-xs font-semibold">{transfer.id.slice(0, 8)}</p><span className="text-xs capitalize text-black/45">{transfer.status.replaceAll("_", " ")}</span></div><p className="mt-2 text-sm text-black/55">{transfer.serials.length} unit{transfer.serials.length === 1 ? "" : "s"}</p><p className="mt-1 truncate font-mono text-xs text-black/40">{transfer.serials.join(", ")}</p><label className={`mt-3 inline-flex rounded-lg border border-black/15 px-3 py-2 text-xs font-semibold ${uploading ? "cursor-wait opacity-45" : "cursor-pointer hover:bg-black/[.03]"}`}>{uploading ? "Uploading label…" : transfer.labelFilename ?? "Choose label file"}<input type="file" accept="application/pdf,image/png,image/jpeg" disabled={uploading} className="sr-only" onChange={(event) => uploadLabel(transfer.id, event.target.files?.[0])} /></label></div>;
        })}{!transfers.length ? <p className="py-8 text-center text-sm text-black/40">No repair batches are waiting for transfer.</p> : null}</div>
      </section>

      {message || error ? <p role="status" className={`rounded-xl border p-3 text-sm xl:col-span-3 ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ?? message}</p> : null}
    </div>
  );
}
