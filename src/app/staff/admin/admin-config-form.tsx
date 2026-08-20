"use client";

import { useState } from "react";
import type { CustomerTrackingCopy } from "@/domain/customer-tracking-copy";

type Config = {
  approvalMode: string;
  depositRefundGate: string;
  returnReminderDays: number;
  returnEscalationDays: number;
  staleClaimDays: number;
  unidentifiedEscalationDays: number;
  stuckRepairDays: number;
  returnInstructions: string;
  customerTrackingCopy: CustomerTrackingCopy;
};

const trackingCopyFields: Array<{ key: keyof CustomerTrackingCopy; label: string }> = [
  { key: "unidentifiedHeadline", label: "Unidentified device headline" },
  { key: "unidentifiedDetail", label: "Unidentified device detail" },
  { key: "discrepancyHeadline", label: "Return discrepancy headline" },
  { key: "discrepancyDetail", label: "Return discrepancy detail" },
  { key: "blockedHeadline", label: "Fulfillment delay headline" },
  { key: "blockedDetail", label: "Fulfillment delay detail" },
  { key: "closedHeadline", label: "Completed request headline" },
  { key: "closedDetail", label: "Completed request detail" },
  { key: "dispatchedHeadline", label: "Replacement dispatched headline" },
  { key: "dispatchedDetail", label: "Replacement dispatched detail" },
  { key: "deliveredHeadline", label: "Replacement delivered headline" },
  { key: "deliveredDetail", label: "Replacement delivered detail" },
  { key: "returnTransitHeadline", label: "Return in transit headline" },
  { key: "returnTransitDetail", label: "Return in transit detail" },
  { key: "returnTransitRegularDetail", label: "Regular return in transit detail" },
  { key: "verifiedHeadline", label: "Verified headline" },
  { key: "verifiedAdvanceDetail", label: "Verified advance-replacement detail" },
  { key: "verifiedRegularDetail", label: "Verified regular-replacement detail" },
  { key: "returnReceivedHeadline", label: "Return received headline" },
  { key: "returnReceivedDetail", label: "Return received detail" },
  { key: "verificationHeadline", label: "Verification headline" },
  { key: "verificationDetail", label: "Verification detail" },
];

type Process = {
  id: string;
  name: string;
  flow: string;
  feeInCents: number;
  depositInCents: number;
  description: string;
  active: boolean;
};

const timingFields: Array<{
  key: keyof Pick<Config, "returnReminderDays" | "returnEscalationDays" | "staleClaimDays" | "unidentifiedEscalationDays" | "stuckRepairDays">;
  label: string;
}> = [
  { key: "returnReminderDays", label: "Remind customer to return device after" },
  { key: "returnEscalationDays", label: "Escalate an overdue return after" },
  { key: "staleClaimDays", label: "Mark assigned staff work as inactive after" },
  { key: "unidentifiedEscalationDays", label: "Escalate an unidentified device after" },
  { key: "stuckRepairDays", label: "Flag a device as stuck in repair after" },
];

export function AdminConfigForm({ config: initial, processTypes: initialProcesses }: { config: Config; processTypes: Process[] }) {
  const [config, setConfig] = useState(initial);
  const [processTypes, setProcessTypes] = useState(initialProcesses);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/staff/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, processTypes }),
      });
      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};
      if (!response.ok) throw new Error(data.error ?? "The settings could not be saved. Check the server log and try again.");
      setNotice("Settings saved. New workflow actions will use these values.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Request settings</h2>
        <p className="mt-2 text-sm leading-6 text-black/50">Open a section to review or change its settings.</p>

        <div className="mt-6 space-y-3">
          <details open className="group rounded-2xl border border-black/10 bg-black/[.015]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div><p className="font-semibold">Workflow defaults</p><p className="mt-1 text-sm text-black/50">How requests continue and when deposits can be refunded</p></div>
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 border-b-2 border-r-2 border-black/50 transition-transform group-open:-rotate-[135deg]" />
            </summary>
            <div className="grid gap-5 border-t border-black/10 bg-white px-5 py-5 sm:grid-cols-2">
              <label className="flex flex-col text-sm font-semibold">
                <span className="flex min-h-10 items-end">How new requests enter the workflow</span>
                <div className="relative mt-2">
                  <select disabled value="auto" className="h-11 w-full appearance-none rounded-xl border border-black/15 bg-black/[.04] px-3 pr-10">
                    <option value="auto">Continue automatically</option>
                  </select>
                  <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-2 w-2 -translate-y-2/3 rotate-45 border-b-2 border-r-2 border-black/60" />
                </div>
              </label>
              <label className="flex flex-col text-sm font-semibold">
                <span className="flex min-h-10 items-end">When Support can refund an advance-replacement deposit</span>
                <div className="relative mt-2">
                  <select value={config.depositRefundGate} onChange={(event) => setConfig({ ...config, depositRefundGate: event.target.value })} className="h-11 w-full appearance-none truncate rounded-xl border border-black/15 bg-white px-3 pr-10">
                    <option value="return_in_transit">As soon as carrier tracking starts</option>
                    <option value="return_received">Only after Teracube receives the device</option>
                  </select>
                  <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-2 w-2 -translate-y-2/3 rotate-45 border-b-2 border-r-2 border-black/60" />
                </div>
              </label>
            </div>
          </details>

          <details className="group rounded-2xl border border-black/10 bg-black/[.015]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div><p className="font-semibold">Reminders and staff alerts</p><p className="mt-1 text-sm text-black/50">Five timing rules measured in days</p></div>
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 border-b-2 border-r-2 border-black/50 transition-transform group-open:-rotate-[135deg]" />
            </summary>
            <div className="grid gap-4 border-t border-black/10 bg-white px-5 py-5 sm:grid-cols-2">
              {timingFields.map((field) => (
                <label key={field.key} className="flex items-center justify-between gap-4 rounded-xl border border-black/10 px-4 py-3 text-sm font-semibold">
                  <span>{field.label}</span>
                  <div className="relative w-28 shrink-0">
                    <input type="number" min={1} value={config[field.key]} onChange={(event) => setConfig({ ...config, [field.key]: Number(event.target.value) })} className="h-10 w-full rounded-lg border border-black/15 px-3 pr-12 text-right" />
                    <span className="pointer-events-none absolute right-3 top-3 text-xs font-medium text-black/40">days</span>
                  </div>
                </label>
              ))}
            </div>
          </details>

          <details className="group rounded-2xl border border-black/10 bg-black/[.015]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div><p className="font-semibold">Customer return instructions</p><p className="mt-1 text-sm text-black/50">Instructions shown after Support verifies a request</p></div>
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 border-b-2 border-r-2 border-black/50 transition-transform group-open:-rotate-[135deg]" />
            </summary>
            <div className="border-t border-black/10 bg-white px-5 py-5">
              <label className="block text-sm font-semibold">Instructions<textarea rows={3} value={config.returnInstructions} onChange={(event) => setConfig({ ...config, returnInstructions: event.target.value })} className="mt-2 w-full rounded-xl border border-black/15 p-3 text-sm font-normal" /></label>
            </div>
          </details>

          <details className="group rounded-2xl border border-black/10 bg-black/[.015]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div><p className="font-semibold">Customer tracking messages</p><p className="mt-1 text-sm text-black/50">Headlines and explanations shown on the secure request-status page</p></div>
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 border-b-2 border-r-2 border-black/50 transition-transform group-open:-rotate-[135deg]" />
            </summary>
            <div className="grid gap-4 border-t border-black/10 bg-white px-5 py-5 sm:grid-cols-2">
              {trackingCopyFields.map((field) => <label key={field.key} className="block text-xs font-semibold">{field.label}<textarea rows={2} value={config.customerTrackingCopy[field.key]} onChange={(event) => setConfig({ ...config, customerTrackingCopy: { ...config.customerTrackingCopy, [field.key]: event.target.value } })} className="mt-1.5 w-full rounded-lg border border-black/15 p-3 text-sm font-normal" /></label>)}
            </div>
          </details>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Replacement options and customer charges</h2>
        <p className="mt-2 text-sm leading-6 text-black/50">Open an option to change its availability, charges, or customer-facing description.</p>
        <div className="mt-5 space-y-4">
          {processTypes.map((process, index) => (
            <details key={process.id} className="group rounded-2xl border border-black/10 bg-black/[.015]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{process.name}</p><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${process.active ? "bg-[#87F5CB] text-black" : "bg-black/10 text-black/55"}`}>{process.active ? "Available" : "Hidden"}</span></div><p className="mt-1 text-sm text-black/50">{process.flow === "advance" ? "Replacement ships before the return" : "Customer sends their device first"} · ${(process.feeInCents / 100).toFixed(2)} fee{process.depositInCents ? ` · $${(process.depositInCents / 100).toFixed(2)} deposit` : " · No deposit"}</p></div>
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 border-b-2 border-r-2 border-black/50 transition-transform group-open:-rotate-[135deg]" />
              </summary>
              <div className="border-t border-black/10 bg-white px-5 py-5">
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={process.active} onChange={(event) => setProcessTypes(processTypes.map((item, i) => i === index ? { ...item, active: event.target.checked } : item))} />Offer this option to customers</label>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col text-xs font-semibold"><span className="flex min-h-8 items-end">Nonrefundable service fee, in cents</span><input type="number" min={0} value={process.feeInCents} onChange={(event) => setProcessTypes(processTypes.map((item, i) => i === index ? { ...item, feeInCents: Number(event.target.value) } : item))} className="mt-1.5 h-10 w-full rounded-lg border border-black/15 px-3" /></label>
                <label className="flex flex-col text-xs font-semibold"><span className="flex min-h-8 items-end">Refundable device-return deposit, in cents</span><input type="number" min={0} value={process.depositInCents} onChange={(event) => setProcessTypes(processTypes.map((item, i) => i === index ? { ...item, depositInCents: Number(event.target.value) } : item))} className="mt-1.5 h-10 w-full rounded-lg border border-black/15 px-3" /></label>
              </div>
              <label className="mt-4 block text-xs font-semibold">Description customers see when choosing this option<textarea value={process.description} onChange={(event) => setProcessTypes(processTypes.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} rows={2} className="mt-1.5 w-full rounded-lg border border-black/15 p-3 text-sm font-normal" /></label>
              </div>
            </details>
          ))}
        </div>
      </section>

      <button onClick={save} disabled={busy} className="h-12 w-full rounded-xl bg-black font-semibold text-white disabled:opacity-35">{busy ? "Saving settings…" : "Save admin settings"}</button>
      {notice ? <p role="status" className="text-sm text-black/60">{notice}</p> : null}
    </div>
  );
}
