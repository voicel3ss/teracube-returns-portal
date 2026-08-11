import Link from "next/link";
import Image from "next/image";
import { BrandHeader } from "@/components/brand-header";

const steps = [
  {
    number: "01",
    title: "Tell us which device",
    description: "Use the serial number on the phone or watch, or look it up with the child’s phone number.",
  },
  {
    number: "02",
    title: "Describe what happened",
    description: "We’ll show the replacement options, cost, and refundable deposit before you decide.",
  },
  {
    number: "03",
    title: "Follow the replacement",
    description: "Get one place to check approval, shipping, return progress, and deposit status.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <BrandHeader quietLabel="Help with your device" landing />

      <section className="border-b border-black/[0.07] bg-[var(--green)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[1fr_0.7fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--green-strong)]">
              Teracube repairs &amp; replacements
            </p>
            <h1 className="text-balance text-5xl font-semibold leading-[1.01] tracking-[-0.05em] sm:text-7xl">
              Let’s get their device working again.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-black/62">
              Start a repair or replacement request in a few minutes. We’ll identify the device, explain your options clearly, and keep you updated from start to finish.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/repair/start" className="inline-flex h-13 items-center justify-center rounded-full bg-black px-8 font-semibold text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
                Start a request
              </Link>
              <Link href="/repair/start?entry=parent-app-preview" className="inline-flex h-13 items-center justify-center rounded-full border border-black/15 bg-white px-8 font-semibold text-black/65 transition hover:border-black/30 hover:text-black">
                Continue from Parent app
              </Link>
            </div>
            <p className="mt-4 text-sm text-black/45">No account needed. Have the device or child’s phone number nearby.</p>
          </div>

          <aside className="rounded-3xl border border-white/35 bg-white/55 p-7 shadow-[0_20px_60px_rgba(9,9,9,0.07)] backdrop-blur-sm sm:p-9">
            <p className="text-sm font-semibold text-[var(--green-strong)]">Before you begin</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">You’ll need just a few things</h2>
            <ul className="mt-6 space-y-5">
              <CheckItem title="The Teracube device" detail="Or the child’s phone number if you don’t have it with you." />
              <CheckItem title="An email you can open" detail="We’ll send a quick verification code." />
              <CheckItem title="A US shipping address" detail="For the replacement and return shipment." />
            </ul>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl bg-white px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--green-strong)]">What to expect</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">A straightforward path back to connected.</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.number} className="rounded-3xl bg-[var(--green-soft)] p-7">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--green)] text-sm font-semibold text-black">{step.number}</span>
              <h3 className="mt-7 text-xl font-semibold tracking-[-0.025em]">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-black/55">{step.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-5 rounded-3xl bg-[var(--ink)] p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.025em]">Already started a request?</h2>
            <p className="mt-2 text-sm text-white/60">Open the secure link in your confirmation email to see the latest status at any time.</p>
          </div>
          <p className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/75">Updates stay in one place</p>
        </div>
      </section>

      <footer className="bg-[#0b0d0b] text-white">
        <div className="mx-auto max-w-7xl px-6 py-12 sm:px-8 sm:py-14">
          <div className="grid gap-10 md:grid-cols-2 md:items-end">
            <div>
              <Image
                src="/brand/teracube-wordmark.png"
                alt="Teracube"
                width={2196}
                height={478}
                className="h-auto w-36 brightness-0 invert"
              />
              <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">
                Straightforward repairs and replacements for Teracube families.
              </p>
            </div>
            <div className="md:justify-self-end">
              <p className="text-lg font-semibold">Need help with a device?</p>
              <p className="mt-2 text-sm text-white/55">We’ll help you identify it and understand your options.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/repair/start" className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-black transition hover:bg-[var(--green)]">
                  Start a request
                </Link>
                <a href="https://myteracube.com/" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition hover:border-white/45">
                  Visit Teracube
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-white/15 pt-6">
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-7 gap-y-3 text-sm font-medium text-white/65">
              <Link href="/repair/start" className="transition hover:text-white">Start a request</Link>
              <Link href="/repair/start?entry=parent-app-preview" className="transition hover:text-white">Parent app entry</Link>
              <a href="https://myteracube.com/pages/contact-us" target="_blank" rel="noreferrer" className="transition hover:text-white">Contact Teracube</a>
              <a href="https://myteracube.com/pages/privacy-policy" target="_blank" rel="noreferrer" className="transition hover:text-white">Privacy</a>
              <Link href="/staff/login" className="transition hover:text-white">Staff sign in</Link>
            </nav>
            <p className="mt-6 text-xs text-white/35">© 2026 Teracube. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function CheckItem({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--green)] text-sm font-bold text-white" aria-hidden="true">✓</span>
      <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-black/50">{detail}</p></div>
    </li>
  );
}
