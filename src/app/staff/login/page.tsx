import { BrandHeader } from "@/components/brand-header";
import { StaffLoginForm } from "./staff-login-form";

export default function StaffLoginPage() {
  const googleClientId = process.env.GOOGLE_STAFF_OAUTH_CLIENT_ID;
  const configuredGoogleClientId = googleClientId && !googleClientId.startsWith("replace-with") ? googleClientId : undefined;
  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <BrandHeader quietLabel="Staff workspace" />
      <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
        <section className="rounded-[1.75rem] border border-black/10 bg-white p-7 shadow-[0_20px_60px_rgba(20,30,22,0.07)] sm:p-9">
          <p className="text-sm font-semibold text-[var(--green-strong)]">Teracube team</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Sign in to Device Care</h1>
          <p className="mt-3 text-sm leading-6 text-black/50">Sign in with your assigned Google account or receive a secure code at your active Teracube staff email.</p>
          <StaffLoginForm googleClientId={configuredGoogleClientId} />
        </section>
      </div>
    </main>
  );
}
