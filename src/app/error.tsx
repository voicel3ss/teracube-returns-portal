"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f8f5] px-5"><section className="max-w-lg rounded-[1.75rem] border border-black/10 bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold text-[var(--green-strong)]">Teracube Device Care</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.035em]">Something didn’t load.</h1><p className="mt-3 leading-7 text-black/55">Your information is safe. Try this page again, or return in a moment.</p><button onClick={reset} className="mt-6 rounded-xl bg-black px-6 py-3 font-semibold text-white">Try again</button></section></main>;
}
