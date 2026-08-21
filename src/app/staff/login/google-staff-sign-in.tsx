"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/read-json-response";

declare global {
  interface Window {
    google?: { accounts: { id: { initialize(input: { client_id: string; callback(response: { credential: string }): void }): void; renderButton(element: HTMLElement, options: { theme: string; size: string; width: number }): void } } };
  }
}

export function GoogleStaffSignIn({ clientId }: { clientId: string }) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [error, setError] = useState("");

  function initialize() {
    if (!window.google || !container.current || initialized.current) return;
    initialized.current = true;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        setError("");
        const response = await fetch("/api/staff/auth/google", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential }) });
        const body = await readJsonResponse<{ error?: string; destination?: string }>(response);
        if (!response.ok) { setError(body.error ?? "Google sign-in failed."); return; }
        router.push(body.destination ?? "/staff/support");
        router.refresh();
      },
    });
    window.google.accounts.id.renderButton(container.current, { theme: "outline", size: "large", width: 320 });
  }

  return (
    <div className="mt-7">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={initialize} />
      <div ref={container} className="flex min-h-11 justify-center" />
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-black/35"><span className="h-px flex-1 bg-black/10" /><span>or use email</span><span className="h-px flex-1 bg-black/10" /></div>
    </div>
  );
}
