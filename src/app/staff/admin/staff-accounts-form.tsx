"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const teamOptions = ["support", "ops_lead", "repair", "logistics", "admin"] as const;
type Team = (typeof teamOptions)[number];
type Account = { id: string; email: string; displayName: string; active: boolean; teams: Team[] };

export function StaffAccountsForm({ accounts, currentStaffId }: { accounts: Account[]; currentStaffId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [teams, setTeams] = useState<Team[]>(["support"]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function toggleTeam(team: Team, selected: Team[], update: (teams: Team[]) => void) {
    update(selected.includes(team) ? selected.filter((item) => item !== team) : [...selected, team]);
  }

  async function request(method: "POST" | "PATCH", body: object) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/staff/admin/users", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The staff account could not be saved.");
      setNotice("Staff account saved.");
      if (method === "POST") { setEmail(""); setDisplayName(""); setTeams(["support"]); }
      router.refresh();
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "The staff account could not be saved."); }
    finally { setBusy(false); }
  }

  return <aside className="rounded-[1.5rem] border border-black/10 bg-white p-6">
    <h2 className="font-semibold">Staff accounts and teams</h2>
    <details className="mt-4 rounded-xl border border-black/10 p-4">
      <summary className="cursor-pointer font-semibold">Add staff account</summary>
      <label className="mt-4 block text-xs font-semibold">Name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/15 px-3 text-sm" /></label>
      <label className="mt-3 block text-xs font-semibold">Teracube email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/15 px-3 text-sm" /></label>
      <TeamChecks teams={teams} onToggle={(team) => toggleTeam(team, teams, setTeams)} />
      <button type="button" onClick={() => request("POST", { email, displayName, teams })} disabled={busy || displayName.trim().length < 2 || !email.includes("@") || !teams.length} className="mt-4 h-10 w-full cursor-pointer rounded-lg bg-black text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">Add account</button>
    </details>
    <div className="mt-4 divide-y divide-black/10">{accounts.map((account) => <AccountEditor key={`${account.id}-${account.displayName}-${account.active}-${account.teams.join()}`} account={account} current={account.id === currentStaffId} busy={busy} onSave={(next) => request("PATCH", next)} />)}</div>
    {notice ? <p role="status" className="mt-4 text-xs leading-5 text-black/60">{notice}</p> : null}
  </aside>;
}

function AccountEditor({ account, current, busy, onSave }: { account: Account; current: boolean; busy: boolean; onSave: (account: Account) => void }) {
  const [displayName, setDisplayName] = useState(account.displayName);
  const [active, setActive] = useState(account.active);
  const [teams, setTeams] = useState<Team[]>(account.teams);
  return <details className="py-3">
    <summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{account.displayName}{current ? " (you)" : ""}</p><p className="mt-1 text-xs text-black/45">{account.email}</p></div><span className={`text-[11px] font-semibold ${active ? "text-emerald-700" : "text-red-700"}`}>{active ? "Active" : "Inactive"}</span></div><p className="mt-1 text-xs capitalize text-[var(--green-strong)]">{teams.map((team) => team.replaceAll("_", " ")).join(", ")}</p></summary>
    <label className="mt-4 block text-xs font-semibold">Name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/15 px-3 text-sm" /></label>
    <label className="mt-3 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={active} disabled={current} onChange={(event) => setActive(event.target.checked)} />Account active</label>
    <TeamChecks teams={teams} onToggle={(team) => setTeams(teams.includes(team) ? teams.filter((item) => item !== team) : [...teams, team])} />
    <button type="button" onClick={() => onSave({ ...account, displayName, active, teams })} disabled={busy || displayName.trim().length < 2 || !teams.length} className="mt-4 h-10 w-full cursor-pointer rounded-lg border border-black/15 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35">Save account</button>
  </details>;
}

function TeamChecks({ teams, onToggle }: { teams: Team[]; onToggle: (team: Team) => void }) {
  return <fieldset className="mt-3"><legend className="text-xs font-semibold">Assigned teams</legend><div className="mt-2 flex flex-wrap gap-2">{teamOptions.map((team) => <label key={team} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/10 px-2.5 py-1.5 text-[11px] font-medium capitalize"><input type="checkbox" checked={teams.includes(team)} onChange={() => onToggle(team)} />{team.replaceAll("_", " ")}</label>)}</div></fieldset>;
}
