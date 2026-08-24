import { BrandHeader } from "@/components/brand-header";
import { RepairWizard } from "./repair-wizard";

export default async function RepairStartPage({
  searchParams,
}: {
  searchParams: Promise<{
    entry?: string | string[];
    serial?: string | string[];
    parentEmail?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const entry = typeof params.entry === "string" ? params.entry : undefined;
  const serial = typeof params.serial === "string" ? params.serial.trim() : undefined;
  const parentEmail = typeof params.parentEmail === "string" ? params.parentEmail.trim() : undefined;

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[var(--ink)]">
      <BrandHeader quietLabel="Secure replacement request" />
      <RepairWizard parentAppEntry={entry} initialSerial={serial} initialParentEmail={parentEmail} />
    </main>
  );
}
