"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { readJsonResponse } from "@/lib/read-json-response";

type Message = { id: string; senderKind: string; body: string; sentAt: string; photos: { id: string; name: string; dataUrl: string }[] };

export function StaffConversation({ orderId, messages: initialMessages, canReply }: { orderId: string; messages: Message[]; canReply: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [reply, setReply] = useState("");
  const [busyAction, setBusyAction] = useState<"message" | "clarify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);

  const refreshMessages = useCallback(async () => {
    if (document.visibilityState === "hidden" || refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const response = await fetch(`/api/staff/support/orders/${orderId}/review`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await readJsonResponse<{ messages: Message[] }>(response);
      if (Array.isArray(data.messages)) setMessages(data.messages);
    } catch {
      // Keep the current conversation visible during a temporary connection failure.
    } finally {
      refreshInFlight.current = false;
    }
  }, [orderId]);

  useEffect(() => {
    const interval = window.setInterval(refreshMessages, 3000);
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshMessages(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [refreshMessages]);

  async function sendReply(action: "message" | "clarify") {
    setBusyAction(action);
    setError(null);
    try {
      const response = await fetch(`/api/staff/support/orders/${orderId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, message: reply }) });
      const data = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "The message could not be sent.");
      setReply("");
      await refreshMessages();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The message could not be sent.");
    } finally {
      setBusyAction(null);
    }
  }

  return <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="font-semibold">Customer conversation</h2><p className="mt-1 text-sm text-black/45">Messages stay attached to this request and update automatically.</p></div>
      <span className="rounded-full bg-[var(--mint)]/30 px-3 py-1 text-xs font-semibold text-[var(--green-strong)]">Live secure chat</span>
    </div>
    <div className="mt-6 max-h-[34rem] space-y-3 overflow-y-auto rounded-2xl bg-[#f7f8f5] p-4 sm:p-5" aria-live="polite" aria-relevant="additions">
      {messages.map((message) => {
        const fromStaff = message.senderKind === "staff";
        const fromSystem = message.senderKind === "system";
        return <article key={message.id} className={`max-w-[88%] rounded-2xl px-4 py-3 ${fromStaff ? "ml-auto bg-black text-white" : fromSystem ? "bg-amber-50 text-black" : "bg-[var(--mint)]/35 text-black"}`}>
          <p className={`text-xs font-semibold ${fromStaff ? "text-white/55" : "text-black/45"}`}>{fromStaff ? "You · Teracube support" : fromSystem ? "Teracube update" : "Customer"}</p>
          <p className={`mt-1 whitespace-pre-wrap text-sm leading-6 ${fromStaff ? "text-white/85" : "text-black/70"}`}>{message.body}</p>
          {message.photos.length ? <div className="mt-3 grid grid-cols-3 gap-2">{message.photos.map((photo) => <PhotoLightbox key={photo.id} src={photo.dataUrl} alt={photo.name} />)}</div> : null}
          <p className={`mt-2 text-[11px] ${fromStaff ? "text-white/35" : "text-black/35"}`}>{new Date(message.sentAt).toLocaleString()}</p>
        </article>;
      })}
      {!messages.length ? <p className="py-8 text-center text-sm text-black/40">No messages yet.</p> : null}
    </div>
    <div className="mt-4 rounded-2xl border border-black/10 p-4">
      <label htmlFor="staff-chat-reply" className="text-sm font-semibold">Message customer</label>
      {!canReply ? <p className="mt-1 text-xs text-black/45">Only the assigned agent can reply.</p> : null}
      <textarea id="staff-chat-reply" value={reply} onChange={(event) => setReply(event.target.value)} rows={3} disabled={!canReply} placeholder="Ask a question or send an update" className="mt-2 w-full resize-none rounded-xl border border-black/15 p-3 text-sm outline-none focus:border-[var(--green-strong)] disabled:bg-black/[0.03]" />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-black/40">Send an update normally. Choose “Ask for reply” only when work must wait for the customer.</p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => sendReply("message")} disabled={busyAction !== null || !canReply || reply.trim().length < 5} className="h-10 cursor-pointer rounded-xl border border-black/15 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35">{busyAction === "message" ? "Sending…" : "Send update"}</button>
          <button type="button" onClick={() => sendReply("clarify")} disabled={busyAction !== null || !canReply || reply.trim().length < 5} className="h-10 cursor-pointer rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{busyAction === "clarify" ? "Sending…" : "Ask for reply"}</button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  </section>;
}
