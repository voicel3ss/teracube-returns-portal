"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(body: object) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/repair/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  if (["back_to_stock", "terminal_fail"].includes(status)) return <section className="rounded-[1.5rem] border border-black/10 bg-white p-6"><h2 className="font-semibold">Repair complete</h2><p className="mt-2 text-sm text-black/50">This outcome is permanently recorded on the serial ledger.</p></section>;
  if (status === "qc_pass") return <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-6"><h2 className="font-semibold text-emerald-900">Awaiting batch QC</h2><p className="mt-2 text-sm leading-6 text-emerald-900/65">The resolution is saved. Add this serial to “Mark repaired units ready” on the Repair screen to finish QC and return it to refurbished inventory.</p></section>;
  if (status === "received") return <section className="rounded-[1.5rem] border border-black/10 bg-white p-6"><h2 className="font-semibold">Unit received</h2><button onClick={() => update({ action: "start" })} disabled={busy} className="mt-4 h-11 w-full rounded-xl bg-black text-sm font-semibold text-white">Begin diagnosis</button></section>;

  return <div className="space-y-4">
    <section className="rounded-[1.5rem] border border-black/10 bg-white p-6">
      <h2 className="font-semibold">Record repair resolution</h2>
      <label className="mt-4 block text-sm font-semibold">Resolution category</label>
      <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm">{["screen", "charging", "camera", "calls_cellular", "battery", "buttons", "water_damage", "other"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
      <label className="mt-4 block text-sm font-semibold">What was actually fixed?</label>
      <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-black/15 p-3 text-sm" />
      <label className="mt-4 block text-sm font-semibold">Detailed notes</label>
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-black/15 p-3 text-sm" />
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 3))} className="mt-4 block w-full text-xs file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-black file:px-3 file:py-2 file:text-white" />
      <button onClick={async () => update({ action: "complete", resolutionCategory: category, resolution, notes, photos: await encode(files) })} disabled={busy || resolution.trim().length < 3} className="mt-4 h-11 w-full rounded-xl bg-[var(--green-strong)] text-sm font-semibold text-white disabled:opacity-35">Save resolution &amp; send to batch QC</button>
    </section>
    <section className="rounded-[1.5rem] border border-red-200 bg-white p-6">
      <h2 className="font-semibold">Terminal failure</h2>
      <select value={disposition} onChange={(event) => setDisposition(event.target.value)} className="mt-3 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm"><option value="scrap">Scrap</option><option value="parts_harvest">Parts harvest</option><option value="beyond_economic_repair">Beyond economic repair</option></select>
      <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Required reason" className="mt-3 w-full rounded-xl border border-black/15 p-3 text-sm" />
      <button onClick={() => update({ action: "terminal", disposition, reason })} disabled={busy || reason.trim().length < 3} className="mt-3 h-10 w-full rounded-xl border border-red-300 text-sm font-semibold text-red-700 disabled:opacity-35">Retire unit</button>
    </section>
    {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
  </div>;
}
