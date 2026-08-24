"use client";

import { useState } from "react";
import { readJsonResponse } from "@/lib/read-json-response";

export function DevicePiiField({ serial, field, masked }: { serial: string; field: "iccid" | "imei"; masked: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/oversight/devices/${serial}/pii`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const data = await readJsonResponse<{ error?: string; value: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Reveal failed.");
      setValue(data.value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reveal failed.");
    } finally {
      setBusy(false);
    }
  }

  return <span><span>{value ?? masked}</span>{value === null ? <button type="button" onClick={reveal} disabled={busy} className="ml-2 cursor-pointer text-xs font-semibold text-[var(--green-strong)] underline underline-offset-2 disabled:cursor-wait disabled:opacity-50">{busy ? "Revealing…" : "Reveal"}</button> : null}{error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}</span>;
}
