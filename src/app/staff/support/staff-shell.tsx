"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function StaffShell({ name, children, area = "support" }: { name: string; children: React.ReactNode; area?: "support" | "repair" | "logistics" | "oversight" | "admin" }) {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/staff/auth/logout", { method: "POST" });
    router.push("/staff/login");
    router.refresh();
  }
  return (
    <main className="min-h-screen bg-[#f3f5f0] text-[var(--ink)]">
      <header className="border-b border-black/10 border-t-[3px] border-t-[var(--green)] bg-white">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-5 px-5 sm:px-7">
          <div className="flex items-center gap-7">
            <Link href={`/staff/${area}`} className="font-semibold tracking-[-0.02em]">teracube <span className="text-black/35">/ {area}</span></Link>
            <nav className="hidden gap-5 text-sm font-medium text-black/50 sm:flex">
              <Link href="/staff/support" className={area === "support" ? "text-black" : ""}>Support</Link>
              {area === "support" ? <Link href="/staff/support/customers">Customers</Link> : null}
              <Link href="/staff/repair" className={area === "repair" ? "text-black" : ""}>Repair</Link>
              <Link href="/staff/logistics" className={area === "logistics" ? "text-black" : ""}>Logistics</Link>
              <Link href="/staff/oversight" className={area === "oversight" ? "text-black" : ""}>Oversight</Link>
              <Link href="/staff/admin" className={area === "admin" ? "text-black" : ""}>Admin</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-black/45 sm:inline">{name}</span>
            <button type="button" onClick={signOut} className="rounded-lg border border-black/10 px-3 py-2 font-semibold">Sign out</button>
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
