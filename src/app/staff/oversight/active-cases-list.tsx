"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildOversightCsv } from "@/domain/oversight-csv";

export type ActiveCaseRow = {
  id: string;
  orderNumber: number;
  status: string;
  statusLabel: string;
  stage: string;
  deviceSerial: string | null;
  model: string;
  issue: string;
  flow: string | null;
  assignments: Array<{ staffId: string; name: string; team: string; work: string; status: string; pauseReason: string | null }>;
  updatedAt: string;
  needsAttention: boolean;
  overdue: boolean;
  active: boolean;
};

const stageLabels: Record<string, string> = {
  support: "Support",
  repair: "Repair",
  logistics: "Logistics",
  ops_lead: "Operations",
  admin: "Admin",
};

export function ActiveCasesList({ cases, canExportPii }: { cases: ActiveCaseRow[]; canExportPii: boolean }) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [assignment, setAssignment] = useState("all");
  const [scope, setScope] = useState("active");
  const [exportingPii, setExportingPii] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => cases.filter((item) => {
    if (scope === "active" && !item.active) return false;
    if (scope === "closed" && item.active) return false;
    if (stage !== "all" && item.stage !== stage) return false;
    if (assignment === "unassigned" && item.assignments.length) return false;
    if (assignment === "assigned" && !item.assignments.length) return false;
    if (assignment === "attention" && !item.needsAttention) return false;
    if (!normalizedSearch) return true;
    const searchable = [
      item.orderNumber.toString(), item.statusLabel, item.deviceSerial ?? "", item.model,
      item.issue, ...item.assignments.map((person) => person.name),
    ].join(" ").toLowerCase();
    return searchable.includes(normalizedSearch);
  }), [assignment, cases, normalizedSearch, scope, stage]);

  function exportCsv() {
    const csv = buildOversightCsv(filtered);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `repair-cases-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function exportCsvWithPii() {
    setExportingPii(true);
    setExportError(null);
    try {
      const response = await fetch("/api/staff/oversight/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseIds: filtered.map((item) => item.id) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "The protected export could not be created.");
      }
      downloadBlob(await response.blob(), `repair-cases-with-pii-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The protected export could not be created.");
    } finally {
      setExportingPii(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[1.5rem] border border-black/10 bg-white">
      <div className="border-b border-black/10 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-xl font-semibold">Case overview</h2>
            <p className="mt-1 text-sm text-black/50">Browse active work or search the complete history of closed requests.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3"><p className="text-sm font-semibold text-black/55">{filtered.length} of {cases.length} cases</p><button type="button" onClick={exportCsv} disabled={!filtered.length} className="h-10 cursor-pointer rounded-xl border border-black/15 px-4 text-sm font-semibold hover:border-black/35 disabled:cursor-not-allowed disabled:opacity-35">Export CSV</button>{canExportPii ? <button type="button" onClick={exportCsvWithPii} disabled={!filtered.length || exportingPii} className="h-10 cursor-pointer rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{exportingPii ? "Preparing…" : "Export CSV with PII"}</button> : null}</div>
        </div>
        {exportError ? <p role="alert" className="mt-3 text-sm text-red-700">{exportError}</p> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(15rem,1fr)_11rem_11rem_11rem]">
          <label className="block">
            <span className="sr-only">Search active cases</span>
            <input value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value.trim() && scope === "active") setScope("all"); }} placeholder="Search order, serial, model, issue, or person" className="h-12 w-full rounded-xl border border-black/15 px-4 text-sm outline-none focus:border-[var(--green-strong)]" />
          </label>
          <label className="block">
            <span className="sr-only">Choose active or closed cases</span>
            <select value={scope} onChange={(event) => setScope(event.target.value)} className="h-12 w-full cursor-pointer rounded-xl border border-black/15 bg-white px-4 text-sm font-medium outline-none focus:border-[var(--green-strong)]">
              <option value="active">Active cases</option>
              <option value="all">All cases</option>
              <option value="closed">Closed cases</option>
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Filter by current team</span>
            <select value={stage} onChange={(event) => setStage(event.target.value)} className="h-12 w-full cursor-pointer rounded-xl border border-black/15 bg-white px-4 text-sm font-medium outline-none focus:border-[var(--green-strong)]">
              <option value="all">All teams</option>
              <option value="support">Support</option>
              <option value="repair">Repair</option>
              <option value="logistics">Logistics</option>
              <option value="ops_lead">Operations</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Filter by assignment</span>
            <select value={assignment} onChange={(event) => setAssignment(event.target.value)} className="h-12 w-full cursor-pointer rounded-xl border border-black/15 bg-white px-4 text-sm font-medium outline-none focus:border-[var(--green-strong)]">
              <option value="all">All assignments</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
              <option value="attention">Needs attention</option>
            </select>
          </label>
        </div>
      </div>

      <div className="hidden grid-cols-[.55fr_1.05fr_1fr_1.25fr_1.2fr_.65fr] gap-4 border-b border-black/10 bg-black/[.025] px-6 py-3 text-xs font-semibold uppercase tracking-[.08em] text-black/45 lg:grid">
        <span>Case</span><span>Device</span><span>Current status</span><span>Assigned personnel</span><span>Customer issue</span><span>Updated</span>
      </div>
      <div className="divide-y divide-black/10">
        {filtered.map((item) => (
          <article key={item.id} className={`px-5 py-5 transition-colors sm:px-6 lg:grid lg:grid-cols-[.55fr_1.05fr_1fr_1.25fr_1.2fr_.65fr] lg:items-center lg:gap-4 ${item.overdue ? "bg-red-50/80 hover:bg-red-100/70" : "hover:bg-black/[.025]"}`}>
            <div className="flex items-center justify-between gap-3 lg:block">
              <Link href={`/staff/support/orders/${item.id}`} className="font-semibold underline decoration-black/15 underline-offset-4 hover:decoration-black">#{String(item.orderNumber).padStart(4, "0")}</Link>
              {item.needsAttention ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 lg:mt-2 lg:inline-block">Needs attention</span> : null}
              {item.overdue ? <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-800 lg:mt-2 lg:inline-block lg:ml-1">Over 24h</span> : null}
            </div>
            {item.deviceSerial ? <Link href={`/staff/oversight/devices/${item.deviceSerial}`} className="mt-4 block rounded-lg outline-none hover:text-[var(--green-strong)] focus-visible:ring-2 focus-visible:ring-[var(--green-strong)] lg:mt-0">
              <p className="text-sm font-semibold">{item.model}</p>
              <p className="mt-1 font-mono text-xs text-black/45">{item.deviceSerial}</p>
              {item.flow ? <p className="mt-1 text-xs capitalize text-black/40">{item.flow} replacement</p> : null}
              <p className="mt-1 text-xs font-semibold text-[var(--green-strong)]">View complete history →</p>
            </Link> : <div className="mt-4 lg:mt-0"><p className="text-sm font-semibold">{item.model}</p><p className="mt-1 text-xs text-black/45">Serial not identified</p></div>}
            <div className="mt-4 lg:mt-0">
              <p className="text-sm font-semibold">{item.statusLabel}</p>
              <p className="mt-1 text-xs text-black/45">With {stageLabels[item.stage] ?? item.stage}</p>
            </div>
            <div className="mt-4 space-y-2 lg:mt-0">
              {item.assignments.length ? item.assignments.map((person) => (
                <div key={`${person.staffId}-${person.work}`}>
                  <p className="text-sm font-semibold">{person.name}</p>
                  <p className="mt-0.5 text-xs text-black/45">{person.work} · {stageLabels[person.team] ?? person.team}{person.status === "snoozed" ? person.pauseReason === "admin_review" ? " · waiting for admin" : " · waiting for customer" : ""}</p>
                </div>
              )) : <><p className="text-sm font-semibold text-amber-800">Unassigned</p><p className="mt-1 text-xs text-black/45">{stageLabels[item.stage] ?? item.stage} team</p></>}
            </div>
            <p className="mt-4 line-clamp-2 text-sm leading-5 text-black/60 lg:mt-0">{item.issue}</p>
            <p className={`mt-4 text-xs lg:mt-0 ${item.overdue ? "font-semibold text-red-700" : "text-black/45"}`}>{new Date(item.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
          </article>
        ))}
        {!filtered.length ? <div className="px-6 py-12 text-center"><p className="font-semibold">No cases match these filters</p><p className="mt-1 text-sm text-black/45">Clear the search, include closed cases, or choose a different filter.</p></div> : null}
      </div>
    </section>
  );
}
