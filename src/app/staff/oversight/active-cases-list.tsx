"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
};

const stageLabels: Record<string, string> = {
  support: "Support",
  repair: "Repair",
  logistics: "Logistics",
  ops_lead: "Operations",
  admin: "Admin",
};

export function ActiveCasesList({ cases }: { cases: ActiveCaseRow[] }) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [assignment, setAssignment] = useState("all");
  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => cases.filter((item) => {
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
  }), [assignment, cases, normalizedSearch, stage]);

  return (
    <section className="rounded-[1.5rem] border border-black/10 bg-white">
      <div className="border-b border-black/10 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-xl font-semibold">All active cases</h2>
            <p className="mt-1 text-sm text-black/50">Every request that still needs customer, Support, Repair, or Logistics work.</p>
          </div>
          <p className="text-sm font-semibold text-black/55">{filtered.length} of {cases.length} cases</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(15rem,1fr)_12rem_12rem]">
          <label className="block">
            <span className="sr-only">Search active cases</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, serial, model, issue, or person" className="h-12 w-full rounded-xl border border-black/15 px-4 text-sm outline-none focus:border-[var(--green-strong)]" />
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
          <Link key={item.id} href={`/staff/support/orders/${item.id}`} className="block px-5 py-5 transition-colors hover:bg-black/[.025] sm:px-6 lg:grid lg:grid-cols-[.55fr_1.05fr_1fr_1.25fr_1.2fr_.65fr] lg:items-center lg:gap-4">
            <div className="flex items-center justify-between gap-3 lg:block">
              <p className="font-semibold">#{String(item.orderNumber).padStart(4, "0")}</p>
              {item.needsAttention ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 lg:mt-2 lg:inline-block">Needs attention</span> : null}
            </div>
            <div className="mt-4 lg:mt-0">
              <p className="text-sm font-semibold">{item.model}</p>
              <p className="mt-1 font-mono text-xs text-black/45">{item.deviceSerial ?? "Serial not identified"}</p>
              {item.flow ? <p className="mt-1 text-xs capitalize text-black/40">{item.flow} replacement</p> : null}
            </div>
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
            <p className="mt-4 text-xs text-black/45 lg:mt-0">{new Date(item.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
          </Link>
        ))}
        {!filtered.length ? <div className="px-6 py-12 text-center"><p className="font-semibold">No cases match these filters</p><p className="mt-1 text-sm text-black/45">Clear the search or choose a different filter.</p></div> : null}
      </div>
    </section>
  );
}
