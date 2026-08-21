"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/read-json-response";

export function RepairTools() {
  const router = useRouter(); const [serial, setSerial] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function receive() { setBusy(true); setError(null); try { const response = await fetch("/api/staff/repair/receive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serial }) }); const data = await readJsonResponse<{ error?: string; repairId: string }>(response); if (!response.ok) throw new Error(data.error ?? "The device could not be received."); router.push(`/staff/repair/${data.repairId}`); } catch (caught) { setError(caught instanceof Error ? caught.message : "The device could not be received."); } finally { setBusy(false); } }
  return <div>
    <section className="max-w-2xl rounded-[1.5rem] border border-black/10 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--green-strong)]">Start here</p><h2 className="mt-2 text-xl font-semibold">Scan the device serial</h2><p className="mt-2 text-sm text-black/50">We’ll open the device record so you can diagnose and complete the repair in one place.</p><div className="mt-4 flex gap-2"><input value={serial} onChange={(e) => setSerial(e.target.value.toUpperCase())} placeholder="202112T2E235968" aria-label="Device serial" className="h-11 min-w-0 flex-1 rounded-xl border border-black/15 px-3 font-mono text-sm" /><button onClick={receive} disabled={busy || !serial} className="cursor-pointer rounded-xl bg-black px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{busy ? "Opening…" : "Open repair"}</button></div></section>
    {error ? <p role="alert" className="mt-4 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
  </div>;
}
