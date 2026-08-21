import { BrandHeader } from "@/components/brand-header";
import { RepairWizard } from "./repair-wizard";

export default async function RepairStartPage({
  searchParams,
}: {
  searchParams: Promise<{ entry?: string | string[]; lookup?: string | string[] }>;
}) {
  const params = await searchParams;
  const entry = typeof params.entry === "string" ? params.entry : undefined;
  const initialLookupType = params.lookup === "phone" ? "phone" : "serial";

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[var(--ink)]">
      <BrandHeader quietLabel="Secure replacement request" />
      <RepairWizard parentAppEntry={entry} initialLookupType={initialLookupType} />
    </main>
  );
}
