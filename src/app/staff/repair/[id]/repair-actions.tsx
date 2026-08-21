"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/read-json-response";

async function encode(files: File[]) {
  return Promise.all(files.map((file) => new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: String(reader.result).split(",")[1] ?? "" });
    reader.onerror = () => reject(new Error("Photo could not be read."));
    reader.readAsDataURL(file);
  })));
}

export function RepairActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [category, setCategory] = useState("screen");
  const [resolution, setResolution] = useState("");
  const [notes, setNotes] = useState("");
  const [disposition, setDisposition] = useState("scrap");
  const [terminalSubDisposition, setTerminalSubDisposition] = useState("");
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(body: object) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/repair/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  if (["back_to_stock", "terminal_fail"].includes(status)) return <section className="rounded-[1.5rem] border border-black/10 bg-white p-6"><h2 className="font-semibold">Repair complete</h2><p className="mt-2 text-sm text-black/50">This outcome is permanently recorded on the serial ledger.</p></section>;
  if (status === "qc_pass") return <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-6"><h2 className="font-semibold text-emerald-900">Resolution saved</h2><p className="mt-2 text-sm leading-6 text-emerald-900/65">Finish the quality check here—there is no need to enter the serial again.</p><button onClick={() => update({ action: "release" })} disabled={busy} className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-black text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-35">{busy ? "Finishing…" : "Pass QC and send to warehouse"}</button>{error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}</section>;
  if (status === "received") return <section className="rounded-[1.5rem] border border-black/10 bg-white p-6"><h2 className="font-semibold">Unit received</h2><button onClick={() => update({ action: "start" })} disabled={busy} className="mt-4 h-11 w-full rounded-xl bg-black text-sm font-semibold text-white">Begin diagnosis</button></section>;

  return <div className="space-y-4">
    <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
      <h2 className="font-semibold">Record repair resolution</h2>
      <label htmlFor="resolution-category" className="mt-4 block text-sm font-semibold">Resolution category</label>
      <select id="resolution-category" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm">{["screen", "charging", "camera", "calls_cellular", "battery", "buttons", "water_damage", "other"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
      <label htmlFor="repair-resolution" className="mt-4 block text-sm font-semibold">What was actually fixed?</label>
      <textarea id="repair-resolution" value={resolution} onChange={(event) => setResolution(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-black/15 p-3 text-sm" />
      <label htmlFor="repair-notes" className="mt-4 block text-sm font-semibold">Detailed notes</label>
      <textarea id="repair-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-black/15 p-3 text-sm" />
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Repair photos" onChange={(event) => { const selected = Array.from(event.target.files ?? []).slice(0, 3); if (selected.some((file) => file.size > 5_000_000)) { setError("Each photo must be 5 MB or smaller."); setFiles([]); event.target.value = ""; } else { setError(null); setFiles(selected); } }} className="mt-4 block w-full cursor-pointer text-xs file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-black file:px-3 file:py-2 file:text-white" />
      <button onClick={async () => update({ action: "complete_and_release", resolutionCategory: category, resolution, notes, photos: await encode(files) })} disabled={busy || resolution.trim().length < 3} className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-[var(--green-strong)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{busy ? "Completing repair…" : "Complete repair and send to warehouse"}</button>
    </section>
    <details className="group rounded-[1.5rem] border border-red-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden"><div><h2 className="font-semibold">Device cannot be repaired</h2><p className="mt-1 text-sm text-black/45">Use only when the normal repair cannot be completed.</p></div><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 border-b-2 border-r-2 border-black/50 transition-transform group-open:-rotate-[135deg]" /></summary>
      <section className="border-t border-red-100 px-6 pb-6 pt-5">
        <label htmlFor="terminal-disposition" className="block text-sm font-semibold">Disposition</label><select id="terminal-disposition" value={disposition} onChange={(event) => setDisposition(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm"><option value="scrap">Scrap</option><option value="parts_harvest">Parts harvest</option><option value="beyond_economic_repair">Beyond economic repair</option></select>
        {disposition === "beyond_economic_repair" ? <><label htmlFor="terminal-sub-disposition" className="mt-3 block text-sm font-semibold">Why is repair not economical?</label><select id="terminal-sub-disposition" value={terminalSubDisposition} onChange={(event) => setTerminalSubDisposition(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm"><option value="">Choose a reason</option><option value="water_damage">Water damage</option><option value="destroyed">Device destroyed</option></select></> : null}
        <label htmlFor="terminal-reason" className="mt-3 block text-sm font-semibold">Reason</label><textarea id="terminal-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Required reason" className="mt-2 w-full rounded-xl border border-black/15 p-3 text-sm" />
        <button onClick={() => update({ action: "terminal", disposition, terminalSubDisposition: terminalSubDisposition || undefined, reason })} disabled={busy || reason.trim().length < 3 || (disposition === "beyond_economic_repair" && !terminalSubDisposition)} className="mt-3 h-10 w-full cursor-pointer rounded-xl border border-red-300 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-35">Retire unit</button>
      </section>
    </details>
    {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
  </div>;
}
