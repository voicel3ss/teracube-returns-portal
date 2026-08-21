"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/read-json-response";

type Address = { name: string; line1: string; line2?: string; city: string; region: string; postalCode: string; country: "US" };
const emptyAddress: Address = { name: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "US" };

export function ShippingAddressDue({ token }: { token: string }) {
  const router = useRouter();
  const [address, setAddress] = useState(emptyAddress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = address.name.trim().length >= 2 && address.line1.trim().length >= 3 && address.city.trim().length >= 2 && address.region.trim().length === 2 && /^\d{5}(?:-\d{4})?$/.test(address.postalCode.trim());
  function update(key: keyof Address, value: string) { setAddress((current) => ({ ...current, [key]: key === "region" ? value.toUpperCase().slice(0, 2) : value })); }
  function useTestingAddress() { setAddress({ name: "Teracube", line1: "16625 Redmond Way", line2: "Ste M-175", city: "Redmond", region: "WA", postalCode: "98052", country: "US" }); }
  async function save() {
    setBusy(true); setError(null);
    try {
      const validationResponse = await fetch("/api/repair/address/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      const validation = await readJsonResponse<{ error?: string; normalizedAddress: Address; validationToken: string }>(validationResponse);
      if (!validationResponse.ok) throw new Error(validation.error ?? "The address could not be validated.");
      const saveResponse = await fetch("/api/repair/address/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, address: validation.normalizedAddress, addressValidationToken: validation.validationToken }) });
      const result = await readJsonResponse<{ error?: string }>(saveResponse);
      if (!saveResponse.ok) throw new Error(result.error ?? "The address could not be saved.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The address could not be saved."); }
    finally { setBusy(false); }
  }
  return <section className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6">
    <h2 className="text-lg font-semibold text-amber-950">Add your shipping address</h2>
    <p className="mt-2 text-sm leading-6 text-amber-950/65">Support identified your device. Add the US address where the replacement should be delivered.</p>
    <button type="button" onClick={useTestingAddress} className="mt-3 cursor-pointer text-sm font-semibold text-amber-950 underline underline-offset-4">Use Teracube’s testing address</button>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {([ ["name", "Full name"], ["line1", "Street address"], ["line2", "Apartment or suite (optional)"], ["city", "City"], ["region", "State"], ["postalCode", "ZIP code"] ] as Array<[keyof Address, string]>).map(([key, label]) => <label key={key} className={key === "line1" || key === "line2" ? "sm:col-span-2" : ""}><span className="text-sm font-semibold text-amber-950">{label}</span><input value={address[key] ?? ""} onChange={(event) => update(key, event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm" /></label>)}
    </div>
    <button type="button" onClick={save} disabled={busy || !complete} className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-black text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{busy ? "Validating and saving…" : "Validate and save address"}</button>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
  </section>;
}
