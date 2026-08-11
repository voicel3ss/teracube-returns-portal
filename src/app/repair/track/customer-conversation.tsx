"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoLightbox } from "@/components/photo-lightbox";

type Message = { id: string; senderKind: string; body: string; sentAt: string; photos: { id: string; name: string; dataUrl: string }[] };

async function encodePhotos(files: File[]) {
  return Promise.all(files.map((file) => new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: String(reader.result).split(",")[1] ?? "" });
    reader.onerror = () => reject(new Error("A photo could not be read."));
    reader.readAsDataURL(file);
  })));
}

export function CustomerConversation({ token, messages }: { token: string; messages: Message[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reply() {
    setBusy(true); setError(null);
    try {
      const photos = await encodePhotos(files);
      const response = await fetch("/api/repair/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, message, photos }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Your reply could not be sent.");
      setMessage(""); setFiles([]); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Your reply could not be sent."); }
    finally { setBusy(false); }
  }

  return <section className="mb-8 rounded-2xl border border-black/10 bg-[#f7f8f5] p-5 sm:p-6">
    <h2 className="text-xl font-semibold">Messages</h2>
    <p className="mt-1 text-sm text-black/50">Talk directly with Teracube support here.</p>
    <div className="mt-5 space-y-3">
      {messages.map((item) => <article key={item.id} className={`max-w-[90%] rounded-2xl p-4 ${item.senderKind === "staff" ? "bg-amber-50" : "ml-auto bg-[var(--mint)]/30"}`}>
        <p className="text-xs font-semibold text-black/45">{item.senderKind === "staff" ? "Teracube support" : "You"}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-black/70">{item.body}</p>
        {item.photos.length ? <div className="mt-3 grid grid-cols-3 gap-2">{item.photos.map((photo) => <PhotoLightbox key={photo.id} src={photo.dataUrl} alt={photo.name} />)}</div> : null}
        <p className="mt-2 text-[11px] text-black/35">{new Date(item.sentAt).toLocaleString()}</p>
      </article>)}
      {messages.length === 0 ? <p className="text-sm text-black/40">No messages yet.</p> : null}
    </div>
    <label htmlFor="customer-reply" className="mt-6 block text-sm font-semibold">Reply to support</label>
    <textarea id="customer-reply" value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Type your reply" className="mt-2 w-full rounded-xl border border-black/15 bg-white p-3 text-sm outline-none focus:border-[var(--green-strong)]" />
    <input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Attach photos" onChange={(event) => { const selected = Array.from(event.target.files ?? []).slice(0, 3); if (selected.some((file) => file.size > 5_000_000)) { setError("Each photo must be 5 MB or smaller."); setFiles([]); event.target.value = ""; } else setFiles(selected); }} className="mt-3 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold" />
    <button type="button" onClick={reply} disabled={busy || message.trim().length < 2} className="mt-4 h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white disabled:opacity-35">{busy ? "Sending…" : "Send reply"}</button>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
  </section>;
}
