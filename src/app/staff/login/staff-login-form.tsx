"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StaffLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("support@myteracube.com");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to issue a code.");
      if (!body.challengeId) throw new Error("No active staff account was found for this local demo.");
      setChallengeId(body.challengeId);
      setDemoCode(body.demoCode ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to issue a code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, challengeId, code }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to sign in.");
      router.push(body.destination ?? "/staff/support");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={verifyCode} className="mt-7">
      <label className="text-sm font-semibold" htmlFor="staff-email">Staff email</label>
      <input
        id="staff-email"
        type="email"
        value={email}
        disabled={Boolean(challengeId)}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-2 h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--green-strong)] disabled:bg-black/[0.04]"
      />
      {challengeId ? (
        <>
          <label className="mt-5 block text-sm font-semibold" htmlFor="staff-code">Verification code</label>
          <input
            id="staff-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="mt-2 h-12 w-full rounded-xl border border-black/15 px-4 font-mono tracking-[0.25em] outline-none focus:border-[var(--green-strong)]"
          />
          {demoCode ? <p className="mt-3 rounded-xl bg-[var(--mint)]/25 px-4 py-3 text-xs text-black/55">Mock delivery code: <strong className="font-mono text-black">{demoCode}</strong></p> : null}
          <button disabled={busy || code.length !== 6} className="mt-5 h-12 w-full rounded-xl bg-black font-semibold text-white disabled:opacity-35">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </>
      ) : (
        <button type="button" onClick={requestCode} disabled={busy || !email.includes("@")} className="mt-5 h-12 w-full rounded-xl bg-black font-semibold text-white disabled:opacity-35">
          {busy ? "Issuing code…" : "Send staff code"}
        </button>
      )}
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
