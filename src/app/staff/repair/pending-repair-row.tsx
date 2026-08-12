"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PendingRepairRow({ serial, model, orderNumber }: { serial: string; model: string; orderNumber: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function beginRepair() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/repair/receive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serial }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Repair could not be started.");
      router.push(`/staff/repair/${data.repairId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Repair could not be started.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 bg-amber-50/55 py-4 sm:grid-cols-[1fr_.7fr_.7fr_auto] sm:items-center">
      <div><p className="font-mono text-sm font-semibold">{serial}</p><p className="mt-1 text-xs text-black/45">{model}{orderNumber ? ` · Order #${String(orderNumber).padStart(4, "0")}` : ""}</p></div>
      <p className="text-sm font-medium text-amber-800">Ready to begin</p>
      <p className="text-sm text-black/50">Received by Logistics</p>
      <div className="sm:text-right"><button type="button" onClick={beginRepair} disabled={busy} className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-40">{busy ? "Starting…" : "Begin repair"}</button>{error ? <p role="alert" className="mt-1 text-xs text-red-700">{error}</p> : null}</div>
    </div>
  );
}
