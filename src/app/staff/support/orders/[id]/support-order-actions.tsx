"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WorkItem = { id: string; status: string; assignedToStaffId: string | null; assignedToName: string | null };

export function SupportOrderActions({ orderId, workItem, staffId, reviewState, initialFault, coverage, requiresFreeReason, refundableDepositInCents, refundEligible }: {
  orderId: string;
  workItem: WorkItem | null;
  staffId: string;
  reviewState: string;
  initialFault: string;
  coverage: "warranty" | "accident";
  requiresFreeReason: boolean;
  refundableDepositInCents: number;
  refundEligible: boolean;
}) {
  const router = useRouter();
  const [fault, setFault] = useState(initialFault);
  const [confirmedCoverage, setConfirmedCoverage] = useState(coverage);
  const [freeReason, setFreeReason] = useState("");
  const [clarification, setClarification] = useState("");
  const [note, setNote] = useState("");
  const [refundDollars, setRefundDollars] = useState((refundableDepositInCents / 100).toFixed(2));
  const [customerLink, setCustomerLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = workItem?.assignedToStaffId === staffId;

  async function mutate(url: string, method: string, body: object) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The action could not be completed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally { setBusy(false); }
  }

  async function generateCustomerLink() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/staff/support/orders/${orderId}/customer-link`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The link could not be created.");
      setCustomerLink(`${window.location.origin}${data.path}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The link could not be created.");
    } finally { setBusy(false); }
  }

  return (
    <div className="sticky top-5 space-y-4">
      {workItem && !mine ? (
        <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
          <h2 className="font-semibold">{workItem.assignedToName ? `Assigned to ${workItem.assignedToName}` : "Claim this item"}</h2>
          <p className="mt-2 text-sm leading-6 text-black/50">Claiming places it in your personal work list.</p>
          {workItem.assignedToStaffId ? <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required note for reassignment" rows={3} className="mt-3 w-full rounded-xl border border-black/15 p-3 text-sm" /> : null}
          <button onClick={() => mutate(`/api/staff/work-items/${workItem.id}`, "PATCH", { action: "claim", note })} disabled={busy} className="mt-4 h-11 w-full rounded-xl bg-black text-sm font-semibold text-white disabled:opacity-35">{workItem.assignedToStaffId ? "Reassign to me" : "Claim item"}</button>
        </section>
      ) : null}

      {reviewState === "reviewed" ? <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-6"><p className="font-semibold text-emerald-900">Claim verified</p><p className="mt-2 text-sm leading-6 text-emerald-800/70">The label gate is released. Shipping automation is connected in a later milestone.</p></section> : <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--green-strong)]">Verification gate</p>
        <label className="mt-4 block text-sm font-semibold">Support-verified fault</label>
        <textarea value={fault} onChange={(event) => setFault(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-black/15 p-3 text-sm outline-none focus:border-[var(--green-strong)]" />
        <label className="mt-4 block text-sm font-semibold">Confirmed coverage</label>
        <select value={confirmedCoverage} onChange={(event) => setConfirmedCoverage(event.target.value as "warranty" | "accident")} className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm">
          <option value="warranty">Warranty</option><option value="accident">Accidental damage</option>
        </select>
        {requiresFreeReason ? <><label className="mt-4 block text-sm font-semibold">Internal reason for free outcome</label><textarea value={freeReason} onChange={(event) => setFreeReason(event.target.value)} rows={3} placeholder="Required for every $0 warranty fee" className="mt-2 w-full rounded-xl border border-black/15 p-3 text-sm" /></> : null}
        <button onClick={() => mutate(`/api/staff/support/orders/${orderId}/review`, "POST", { action: "verify", csVerifiedFault: fault, confirmedCoverage, freeOutcomeReason: freeReason })} disabled={busy || !mine || fault.trim().length < 3 || (requiresFreeReason && freeReason.trim().length < 3)} className="mt-5 h-11 w-full rounded-xl bg-[var(--green-strong)] text-sm font-semibold text-white disabled:opacity-35">Verify and release gate</button>
        {!mine ? <p className="mt-2 text-center text-xs text-black/40">Claim the item before verifying it.</p> : null}
      </section>}

      {mine && workItem ? <section className="rounded-[1.5rem] border border-black/10 bg-white p-6"><h2 className="font-semibold">Pause or clarify</h2><textarea value={clarification} onChange={(event) => setClarification(event.target.value)} rows={3} placeholder="Notes or customer clarification message" className="mt-3 w-full rounded-xl border border-black/15 p-3 text-sm" /><div className="mt-3 grid grid-cols-3 gap-2">{[1,3,7].map((days) => <button key={days} onClick={() => mutate(`/api/staff/work-items/${workItem.id}`, "PATCH", { action: "snooze", days, note: clarification })} disabled={busy || clarification.trim().length < 2} className="rounded-lg border border-black/10 py-2 text-xs font-semibold">Wait {days}d</button>)}</div><button onClick={() => mutate(`/api/staff/support/orders/${orderId}/review`, "POST", { action: "clarify", message: clarification })} disabled={busy || clarification.trim().length < 5} className="mt-3 h-10 w-full rounded-xl border border-black/15 text-sm font-semibold">Request clarification</button></section> : null}
      <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
        <h2 className="font-semibold">Customer access</h2>
        <p className="mt-2 text-sm leading-6 text-black/50">Create a secure 30-day tracking link for this customer.</p>
        <button onClick={generateCustomerLink} disabled={busy} className="mt-3 h-10 w-full rounded-xl border border-black/15 text-sm font-semibold">Generate customer link</button>
        {customerLink ? <input readOnly value={customerLink} onFocus={(event) => event.currentTarget.select()} aria-label="Secure customer link" className="mt-3 w-full rounded-xl bg-black/[0.04] p-3 text-xs" /> : null}
      </section>
      {refundableDepositInCents > 0 ? <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
        <h2 className="font-semibold">Refund deposit</h2>
        <p className="mt-2 text-sm leading-6 text-black/50">Up to ${(refundableDepositInCents / 100).toFixed(2)} remains refundable.</p>
        <label className="mt-3 block text-sm font-semibold">Refund amount</label>
        <div className="mt-2 flex items-center rounded-xl border border-black/15 px-3"><span className="text-sm text-black/45">$</span><input value={refundDollars} onChange={(event) => setRefundDollars(event.target.value)} inputMode="decimal" className="h-11 min-w-0 flex-1 px-2 text-sm outline-none" /></div>
        <button onClick={() => { const cents = Math.round(Number(refundDollars) * 100); if (window.confirm(`Refund $${(cents / 100).toFixed(2)} to the original payment method?`)) void mutate(`/api/staff/support/orders/${orderId}/refund`, "POST", { amountInCents: cents }); }} disabled={busy || !refundEligible || !Number.isFinite(Number(refundDollars)) || Number(refundDollars) <= 0} className="mt-3 h-10 w-full rounded-xl bg-black text-sm font-semibold text-white disabled:opacity-35">Confirm refund</button>
        {!refundEligible ? <p className="mt-2 text-xs text-black/40">Available once the return is in transit.</p> : null}
      </section> : null}
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
