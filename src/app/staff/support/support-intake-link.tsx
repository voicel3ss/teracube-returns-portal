"use client";

import { useState } from "react";

export function SupportIntakeLink() {
  const [parentEmail, setParentEmail] = useState("");
  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const absoluteUrl = path && typeof window !== "undefined" ? new URL(path, window.location.origin).toString() : path;

  async function generate() {
    setBusy(true);
    setError("");
    setPath("");
    setCopied(false);
    try {
      const response = await fetch("/api/staff/support/intake-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parentEmail, deviceIdentifier }),
      });
      const body = (await response.json()) as { path?: string; error?: string };
      if (!response.ok || !body.path) throw new Error(body.error ?? "The secure link could not be created.");
      setPath(body.path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The secure link could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(absoluteUrl);
    setCopied(true);
  }

  return (
    <section className="mt-7 rounded-2xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_rgba(20,30,22,0.025)]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Start a request for a parent</h2>
          <p className="mt-1 text-sm text-black/50">Create a secure seven-day link with the device already identified.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="grid gap-1.5 text-sm font-semibold">
          Parent email
          <input value={parentEmail} onChange={(event) => setParentEmail(event.target.value)} type="email" placeholder="parent@example.com" className="h-11 rounded-xl border border-black/15 px-4 font-normal outline-none focus:border-[var(--green-strong)]" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Device serial or child phone
          <input value={deviceIdentifier} onChange={(event) => setDeviceIdentifier(event.target.value)} placeholder="202112T2E235968" className="h-11 rounded-xl border border-black/15 px-4 font-normal outline-none focus:border-[var(--green-strong)]" />
        </label>
        <button type="button" onClick={generate} disabled={busy || !parentEmail.trim() || !deviceIdentifier.trim()} className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">
          {busy ? "Creating…" : "Create secure link"}
        </button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
      {path ? (
        <div className="mt-4 rounded-xl bg-[var(--mint)]/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--green-strong)]">Ready to share</p>
          <p className="mt-1 break-all text-sm">{absoluteUrl}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={copy} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">{copied ? "Copied" : "Copy link"}</button>
            <a href={path} target="_blank" rel="noreferrer" className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-semibold">Open link</a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
