"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function PhotoLightbox({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Enlarge ${alt}`} title="View full size" className="group block w-full overflow-hidden rounded-lg text-left outline-none ring-[var(--green-strong)] focus-visible:ring-2">
      <Image src={src} alt={alt} width={240} height={240} unoptimized className="aspect-square w-full object-cover transition group-hover:scale-[1.03]" />
    </button>
    {open ? <div role="dialog" aria-modal="true" aria-label={`Full-size preview of ${alt}`} onClick={() => setOpen(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8">
      <button type="button" onClick={() => setOpen(false)} aria-label="Close image preview" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white text-2xl font-medium text-black shadow-lg sm:right-7 sm:top-7">×</button>
      <div onClick={(event) => event.stopPropagation()} className="flex max-h-full max-w-full items-center justify-center">
        <Image src={src} alt={alt} width={1800} height={1400} unoptimized priority className="h-auto max-h-[calc(100vh-4rem)] w-auto max-w-[calc(100vw-2rem)] rounded-lg object-contain shadow-2xl" />
      </div>
    </div> : null}
  </>;
}
