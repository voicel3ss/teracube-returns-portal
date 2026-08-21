"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/read-json-response";

export function PaymentDue({ token, balanceInCents }: { token: string; balanceInCents: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/repair/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Payment could not be completed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6">
      <p className="text-sm font-semibold text-amber-900">Payment required</p>
      <p className="mt-2 text-2xl font-semibold">${(balanceInCents / 100).toFixed(2)}</p>
      <p className="mt-2 text-sm leading-6 text-amber-950/65">Support confirmed accidental damage. Pay the additional service fee so verification can continue.</p>
      <button onClick={pay} disabled={busy} className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-black px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">{busy ? "Processing…" : `Simulate payment of $${(balanceInCents / 100).toFixed(2)}`}</button>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
