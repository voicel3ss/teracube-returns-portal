import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";

const journeys = [
  {
    label: "Parent",
    title: "Request and track a replacement",
    description: "Identify the device, describe the fault, choose a replacement path, and follow every shipment.",
  },
  {
    label: "Support",
    title: "Verify and move every claim",
    description: "Work a routed queue, release labels, resolve exceptions, and refund deposits with a complete audit trail.",
  },
  {
    label: "Repair",
    title: "Write the permanent serial ledger",
    description: "Scan returned units, record the actual fix, complete QC, and return viable devices to circulation.",
  },
  {
    label: "Logistics",
    title: "Reconcile and dispatch units",
    description: "Receive packages, compare expected and observed serials, and coordinate outbound and internal shipments.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <BrandHeader quietLabel="Parent and team portal" />

      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--green-strong)]">
            One system · every physical unit
          </p>
          <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-7xl">
            A repair workflow built around the device, not the ticket.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-black/65">
            Every Teracube serial keeps a permanent history while parents, support, repair, and logistics work from one coordinated application.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/repair/start" className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-6 font-semibold text-white hover:bg-black/80">
              Start a replacement
            </Link>
            <Link href="/repair/start?entry=demo-parent-app" className="inline-flex h-12 items-center justify-center rounded-xl border border-black/15 bg-white px-6 font-semibold text-black/65 hover:border-black/30">
              Try Parent app entry
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2">
          {journeys.map((journey, index) => (
            <article
              key={journey.label}
              className="rounded-[1.75rem] border border-black/10 bg-white p-7 shadow-[0_18px_50px_rgba(13,18,14,0.06)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-black/55">{journey.label}</span>
                <span
                  className={`size-3 rounded-full ${index === 1 ? "bg-[var(--purple)]" : "bg-[var(--green)]"}`}
                  aria-hidden="true"
                />
              </div>
              <h2 className="mt-8 text-2xl font-semibold tracking-[-0.025em]">{journey.title}</h2>
              <p className="mt-3 leading-7 text-black/60">{journey.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-[1.75rem] bg-[var(--ink)] p-8 text-white sm:flex sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-[var(--mint)]">Permanent unit history</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Broken unit in. Different refurbished unit out.</h2>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/60 sm:mt-0">
            Replacement orders, repairs, and shipments remain separate lifecycles connected by serial number.
          </p>
        </div>
      </section>
    </main>
  );
}
