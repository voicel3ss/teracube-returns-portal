"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";

type Message = { id: string; senderKind: string; body: string; sentAt: string; photos: { id: string; name: string; dataUrl: string }[] };

export function StaffConversation({ orderId, messages, canReply }: { orderId: string; messages: Message[]; canReply: boolean }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendReply() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/staff/support/orders/${orderId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clarify", message: reply }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The message could not be sent.");
      setReply(""); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The message could not be sent."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="font-semibold">Customer conversation</h2><p className="mt-1 text-sm text-black/45">Messages stay attached to this request.</p></div>
      <span className="rounded-full bg-[var(--mint)]/30 px-3 py-1 text-xs font-semibold text-[var(--green-strong)]">Secure chat</span>
    </div>
    <div className="mt-6 max-h-[34rem] space-y-3 overflow-y-auto rounded-2xl bg-[#f7f8f5] p-4 sm:p-5">
      {messages.map((message) => <article key={message.id} className={`max-w-[88%] rounded-2xl px-4 py-3 ${message.senderKind === "staff" ? "ml-auto bg-black text-white" : "bg-[var(--mint)]/35 text-black"}`}>
        <p className={`text-xs font-semibold ${message.senderKind === "staff" ? "text-white/55" : "text-black/45"}`}>{message.senderKind === "staff" ? "You · Teracube support" : "Customer"}</p>
        <p className={`mt-1 whitespace-pre-wrap text-sm leading-6 ${message.senderKind === "staff" ? "text-white/85" : "text-black/70"}`}>{message.body}</p>
        {message.photos.length ? <div className="mt-3 grid grid-cols-3 gap-2">{message.photos.map((photo) => <PhotoLightbox key={photo.id} src={photo.dataUrl} alt={photo.name} />)}</div> : null}
        <p className={`mt-2 text-[11px] ${message.senderKind === "staff" ? "text-white/35" : "text-black/35"}`}>{new Date(message.sentAt).toLocaleString()}</p>
      </article>)}
      {messages.length === 0 ? <p className="py-8 text-center text-sm text-black/40">No messages yet.</p> : null}
    </div>
    <div className="mt-4 rounded-2xl border border-black/10 p-4">
      <label htmlFor="staff-chat-reply" className="text-sm font-semibold">Message customer</label>
      <textarea id="staff-chat-reply" value={reply} onChange={(event) => setReply(event.target.value)} rows={3} disabled={!canReply} placeholder={canReply ? "Ask a question or send an update" : "Claim this item before messaging the customer"} className="mt-2 w-full resize-none rounded-xl border border-black/15 p-3 text-sm outline-none focus:border-[var(--green-strong)] disabled:bg-black/[0.03]" />
      <div className="mt-3 flex items-center justify-between gap-4"><p className="text-xs text-black/40">The customer can reply from their update page.</p><button type="button" onClick={sendReply} disabled={busy || !canReply || reply.trim().length < 5} className="h-10 shrink-0 rounded-xl bg-black px-5 text-sm font-semibold text-white disabled:opacity-35">{busy ? "Sending…" : "Send message"}</button></div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  </section>;
}
