"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasPermission, type StaffTeam } from "@/auth/permissions";

export type StaffArea = "support" | "customers" | "repair" | "logistics" | "oversight" | "admin";

export function StaffHeader({ name, teams, area }: { name: string; teams: StaffTeam[]; area: StaffArea }) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/staff/auth/logout", { method: "POST" });
    router.push("/staff/login");
    router.refresh();
  }

  return (
    <header className="border-b border-black/10 border-t-[3px] border-t-[var(--green)] bg-white">
      <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-3 sm:flex-nowrap sm:px-7 sm:py-0">
        <div className="flex min-w-0 items-center gap-7">
          <Link href={`/staff/${area}`} className="font-semibold tracking-[-0.02em]">teracube <span className="text-black/35">/ {area}</span></Link>
          <nav className="hidden gap-5 text-sm font-medium text-black/50 sm:flex">
            {hasPermission(teams, "order:view_all") ? <Link href="/staff/support" className={area === "support" ? "text-black" : ""}>Support</Link> : null}
            {hasPermission(teams, "repair:record") ? <Link href="/staff/repair" className={area === "repair" ? "text-black" : ""}>Repair</Link> : null}
            {hasPermission(teams, "shipment:dispatch") ? <Link href="/staff/logistics" className={area === "logistics" ? "text-black" : ""}>Logistics</Link> : null}
            {hasPermission(teams, "oversight:view") ? <Link href="/staff/oversight" className={area === "oversight" ? "text-black" : ""}>Oversight</Link> : null}
            {hasPermission(teams, "order:view_all") ? <Link href="/staff/customers" className={area === "customers" ? "text-black" : ""}>Customers</Link> : null}
            {hasPermission(teams, "config:manage") ? <Link href="/staff/admin" className={area === "admin" ? "text-black" : ""}>Admin</Link> : null}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-black/45 sm:inline">{name}</span>
          <button type="button" onClick={signOut} className="cursor-pointer rounded-lg border border-black/10 px-3 py-2 font-semibold">Sign out</button>
        </div>
        <nav className="flex w-full gap-5 overflow-x-auto pb-1 text-sm font-medium text-black/50 sm:hidden" aria-label="Staff sections">
          {hasPermission(teams, "order:view_all") ? <Link href="/staff/support" className={area === "support" ? "text-black" : ""}>Support</Link> : null}
          {hasPermission(teams, "repair:record") ? <Link href="/staff/repair" className={area === "repair" ? "text-black" : ""}>Repair</Link> : null}
          {hasPermission(teams, "shipment:dispatch") ? <Link href="/staff/logistics" className={area === "logistics" ? "text-black" : ""}>Logistics</Link> : null}
          {hasPermission(teams, "oversight:view") ? <Link href="/staff/oversight" className={area === "oversight" ? "text-black" : ""}>Oversight</Link> : null}
          {hasPermission(teams, "order:view_all") ? <Link href="/staff/customers" className={area === "customers" ? "text-black" : ""}>Customers</Link> : null}
          {hasPermission(teams, "config:manage") ? <Link href="/staff/admin" className={area === "admin" ? "text-black" : ""}>Admin</Link> : null}
        </nav>
      </div>
    </header>
  );
}
