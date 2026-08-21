import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { staffDestination } from "@/auth/staff-destination";
import { prisma } from "@/db/prisma";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { StaffShell } from "../../support/staff-shell";
import { RepairActions } from "./repair-actions";

export const dynamic = "force-dynamic";

export default async function RepairDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) redirect("/staff/login");
  if (!hasPermission(staff.teams, "repair:record")) redirect(staffDestination(staff.teams));
  const { id } = await params;
  const repair = await prisma.repair.findUnique({ where: { id }, include: { device: { include: { model: true, repairs: { include: { photos: true }, orderBy: { createdAt: "desc" } }, returnedForOrders: { orderBy: { createdAt: "desc" } }, dispatchedForOrders: { orderBy: { createdAt: "desc" } } } }, photos: true } });
  if (!repair) notFound();

  return <StaffShell name={staff.displayName} teams={staff.teams} area="repair"><div className="mx-auto max-w-7xl px-5 py-8 sm:px-7">
    <Link href="/staff/repair" className="text-sm font-semibold text-black/45">← Back to repair queue</Link>
    <div className="mt-5 grid gap-7 lg:grid-cols-[1fr_.62fr]">
      <div className="space-y-5">
        <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8"><p className="text-sm font-semibold text-[var(--green-strong)]">Permanent serial ledger</p><h1 className="mt-1 font-mono text-2xl font-semibold">{repair.deviceSerial}</h1><dl className="mt-6 grid gap-5 border-t border-black/10 pt-5 sm:grid-cols-3"><Data label="Model">{repair.device.model.name}</Data><Data label="Grade">{repair.device.grade}</Data><Data label="Circulation">{repair.device.circulationState.replaceAll("_", " ")}</Data></dl></section>
        <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8"><h2 className="font-semibold">Repair history</h2><div className="mt-5 space-y-4">{repair.device.repairs.map((item) => <article key={item.id} className="rounded-2xl bg-[#f7f8f5] p-5"><div className="flex justify-between gap-4"><p className="font-semibold capitalize">{item.status.replaceAll("_", " ")}</p><p className="text-xs text-black/40">{item.createdAt.toLocaleDateString("en-US")}</p></div><p className="mt-2 text-sm text-black/60">{item.repairTeamResolution ?? (item.terminalDisposition ? "Unit retired without a repair resolution." : "Resolution pending")}</p>{item.terminalDisposition ? <p className="mt-2 text-sm text-red-700">{item.terminalDisposition.replaceAll("_", " ")}{item.terminalSubDisposition ? ` · ${item.terminalSubDisposition.replaceAll("_", " ")}` : ""}: {item.terminalReason}</p> : null}{item.photos.length ? <div className="mt-3 grid grid-cols-4 gap-2">{item.photos.map((photo) => <PhotoLightbox key={photo.id} src={photo.objectKey} alt={photo.caption ?? "Repair photo"} />)}</div> : null}</article>)}</div></section>
        <section className="rounded-[1.5rem] border border-black/10 bg-white p-6 sm:p-8"><h2 className="font-semibold">Order &amp; custody history</h2><p className="mt-3 text-sm text-black/50">Returned on {repair.device.returnedForOrders.length} order(s) · dispatched on {repair.device.dispatchedForOrders.length} order(s).</p></section>
      </div>
      <aside className="sticky top-5 self-start"><RepairActions id={repair.id} status={repair.status} /></aside>
    </div>
  </div></StaffShell>;
}

function Data({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-[.1em] text-black/35">{label}</dt><dd className="mt-1.5 text-sm font-medium capitalize">{children}</dd></div>;
}
