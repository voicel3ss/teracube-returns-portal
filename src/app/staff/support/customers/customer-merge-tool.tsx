"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CustomerChoice = { id: string; label: string; emails: Array<{ id: string; masked: string }> };
type Preview = { moved: { emails: number; devices: number; orders: number }; serialConflicts: string[]; survivor: { emails: Array<{ id: string; masked: string }> }; source: { emails: Array<{ id: string; masked: string }> } };

export function CustomerMergeTool({ customers }: { customers: CustomerChoice[] }) {
  const router = useRouter();
  const [survivorId, setSurvivorId] = useState(customers[0]?.id ?? "");
  const [sourceId, setSourceId] = useState(customers[1]?.id ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [primaryEmailId, setPrimaryEmailId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(action: "preview" | "confirm") {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/staff/support/customers/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, survivorId, sourceId, ...(action === "confirm" ? { primaryEmailId } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to merge customers.");
      if (action === "preview") { setPreview(data); setPrimaryEmailId(data.survivor.emails[0]?.id ?? data.source.emails[0]?.id ?? ""); }
      else { setPreview(null); router.refresh(); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to merge customers."); }
    finally { setBusy(false); }
  }

  return <section className="h-fit rounded-2xl border border-black/10 bg-white p-5"><h2 className="font-semibold">Merge duplicate records</h2><p className="mt-2 text-sm leading-6 text-black/50">Preview first. Orders, devices, tokens, and every email move to the survivor; nothing is deleted.</p><label className="mt-5 block text-xs font-semibold uppercase tracking-[0.1em] text-black/40">Surviving customer</label><select value={survivorId} onChange={(e) => { setSurvivorId(e.target.value); setPreview(null); }} className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm">{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}</select><label className="mt-4 block text-xs font-semibold uppercase tracking-[0.1em] text-black/40">Customer to merge</label><select value={sourceId} onChange={(e) => { setSourceId(e.target.value); setPreview(null); }} className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm">{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}</select><button onClick={() => send("preview")} disabled={busy || !survivorId || !sourceId || survivorId === sourceId} className="mt-5 h-11 w-full rounded-xl bg-black text-sm font-semibold text-white disabled:opacity-35">Preview merge</button>{preview ? <div className="mt-5 rounded-xl bg-[#f5f6f2] p-4 text-sm"><p><strong>Moving:</strong> {preview.moved.orders} orders, {preview.moved.devices} devices, {preview.moved.emails} emails</p>{preview.serialConflicts.length ? <p className="mt-2 text-amber-700"><strong>Serial overlap:</strong> {preview.serialConflicts.join(", ")}</p> : null}<label className="mt-4 block font-semibold">Primary email after merge</label><select value={primaryEmailId} onChange={(e) => setPrimaryEmailId(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-black/15 bg-white px-3">{[...preview.survivor.emails, ...preview.source.emails].map((email) => <option key={email.id} value={email.id}>{email.masked}</option>)}</select><button onClick={() => send("confirm")} disabled={busy || !primaryEmailId} className="mt-4 h-10 w-full rounded-xl bg-[var(--green-strong)] font-semibold text-white">Confirm audited merge</button></div> : null}{error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}</section>;
}
