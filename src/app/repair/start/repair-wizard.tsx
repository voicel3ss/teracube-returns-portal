"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const faultChoices = [
  ["screen", "Screen", "Cracks, touch, or display"],
  ["charging", "Charging", "Cable or charging issues"],
  ["camera", "Camera", "Photos or camera hardware"],
  ["calls_cellular", "Calls", "Signal, calling, or cellular"],
  ["battery", "Battery", "Draining or not powering on"],
  ["buttons", "Buttons", "Power or volume buttons"],
  ["water_damage", "Water", "Liquid or moisture damage"],
  ["other", "Other", "Something else"],
] as const;

const sampleDevices = [
  { model: "Teracube 2e", serial: "202112T2E235968", phone: "(206) 555-0142" },
  { model: "Teracube 2s", serial: "202503T2S118842", phone: "(206) 555-0177" },
  { model: "Teracube 4", serial: "202401TC4009317", phone: "(206) 555-0199" },
  { model: "Teracube 4", serial: "202402TC4009418", phone: "(206) 555-0164" },
  { model: "Teracube 2e", serial: "202403T2E236105", phone: "(206) 555-0185" },
] as const;

type FaultCategory = (typeof faultChoices)[number][0];
type Device = {
  serial: string;
  modelId: string;
  modelName: string;
  deviceType: "phone" | "watch";
  manufactured: string;
  iccidMasked: string;
};
type ReplacementOption = {
  id: string;
  flow: "advance" | "regular";
  name: string;
  description: string;
  feeInCents: number;
  depositInCents: number;
  totalInCents: number;
};
type Step = "identify" | "confirm" | "fault" | "options" | "checkout" | "done";

const stepOrder: Step[] = ["identify", "confirm", "fault", "options", "checkout", "done"];

async function readApiResponse(response: Response) {
  const text = await response.text();
  if (!text) return { error: "The server could not complete that request. Check that the local database is running and try again." };
  try {
    return JSON.parse(text);
  } catch {
    return { error: "The server returned an invalid response. Please try again." };
  }
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

async function encodePhotos(files: File[]) {
  return Promise.all(files.map((file) => new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: String(reader.result).split(",")[1] ?? "" });
    reader.onerror = () => reject(new Error("A photo could not be read."));
    reader.readAsDataURL(file);
  })));
}

export function RepairWizard({ parentAppEntry }: { parentAppEntry?: string }) {
  const [step, setStep] = useState<Step>("identify");
  const [lookupType, setLookupType] = useState<"serial" | "phone">("serial");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [emailChallengeId, setEmailChallengeId] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [emailVerificationToken, setEmailVerificationToken] = useState<string | null>(null);
  const [localEmailCode, setLocalEmailCode] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [faultCategory, setFaultCategory] = useState<FaultCategory | null>(null);
  const [faultText, setFaultText] = useState("");
  const [faultPhotos, setFaultPhotos] = useState<File[]>([]);
  const [coverage, setCoverage] = useState<"warranty" | "accident" | null>(null);
  const [options, setOptions] = useState<ReplacementOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [address, setAddress] = useState({
    name: "",
    line1: "",
    line2: "",
    city: "",
    region: "WA",
    postalCode: "",
  });
  const [addressValidationToken, setAddressValidationToken] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderNumber: number; trackingUrl: string } | null>(null);
  const [activeRequest, setActiveRequest] = useState<{ orderNumber: number; trackingUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appEntryLoaded = useRef(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedOptionId) ?? null,
    [options, selectedOptionId],
  );

  const identify = useCallback(
    async (appEntry?: string) => {
      setBusy(true);
      setError(null);
      setLookupFailed(false);
      try {
        const response = await fetch("/api/repair/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            appEntry
              ? { parentAppEntry: appEntry }
              : lookupType === "serial"
                ? { serial: identifier, parentEmail: email, emailVerificationToken }
                : { childPhone: identifier, parentEmail: email, emailVerificationToken },
          ),
        });
        const body = await readApiResponse(response);
        if (!response.ok) throw new Error(body.error ?? "We couldn't check that device.");
        if (body.status === "unidentified") {
          setLookupFailed(true);
          return;
        }
        if (body.status === "active_request") {
          setActiveRequest({ orderNumber: body.orderNumber, trackingUrl: body.trackingUrl });
          return;
        }
        setDevice(body.device);
        setIdentifier(body.device.serial);
        if (body.parentEmail) setEmail(body.parentEmail);
        if (body.emailVerificationToken) setEmailVerificationToken(body.emailVerificationToken);
        setStep("confirm");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "We couldn't check that device.");
      } finally {
        setBusy(false);
      }
    },
    [email, emailVerificationToken, identifier, lookupType],
  );

  useEffect(() => {
    if (parentAppEntry && !appEntryLoaded.current) {
      appEntryLoaded.current = true;
      void identify(parentAppEntry);
    }
  }, [identify, parentAppEntry]);

  async function loadOptions() {
    if (!device || !faultCategory || faultText.trim().length < 3) {
      setError("Choose a problem and add a short description.");
      return;
    }
    setBusy(true);
    setError(null);
    setActiveRequest(null);
    try {
      const response = await fetch("/api/repair/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: device.modelId, faultCategory, faultText }),
      });
      const body = await readApiResponse(response);
      if (!response.ok) throw new Error(body.error ?? "Replacement options are unavailable.");
      setCoverage(body.coverage);
      setOptions(body.options);
      setSelectedOptionId(null);
      setStep("options");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Replacement options are unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function requestIdentificationHelp() {
    if (!emailVerificationToken) {
      setError("Verify the parent email so support can follow up securely.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/repair/unidentified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentEmail: email, emailVerificationToken }),
      });
      const body = await readApiResponse(response);
      if (!response.ok) throw new Error(body.error ?? "We couldn't create the request.");
      setResult(body);
      setStep("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't create the request.");
    } finally {
      setBusy(false);
    }
  }

  function changeEmail(value: string) {
    setEmail(value);
    setEmailChallengeId(null);
    setEmailCode("");
    setEmailVerificationToken(null);
    setLocalEmailCode(null);
  }

  async function sendEmailCode() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/repair/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await readApiResponse(response);
      if (!response.ok) throw new Error(body.error ?? "We couldn't send a verification code.");
      setEmailChallengeId(body.challengeId);
      setLocalEmailCode(body.verificationCode ?? null);
      setEmailCode("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't send a verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail() {
    if (!emailChallengeId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/repair/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, challengeId: emailChallengeId, code: emailCode }),
      });
      const body = await readApiResponse(response);
      if (!response.ok) throw new Error(body.error ?? "We couldn't verify that email.");
      setEmail(body.email);
      setEmailVerificationToken(body.verificationToken);
      setLocalEmailCode(null);
      setEmailCode("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't verify that email.");
    } finally {
      setBusy(false);
    }
  }

  function changeAddress(key: keyof typeof address, value: string) {
    setAddress((current) => ({ ...current, [key]: value }));
    setAddressValidationToken(null);
  }

  function useSampleAddress() {
    setAddress({
      name: "Teracube",
      line1: "16625 Redmond Way",
      line2: "Ste M-175",
      city: "Redmond",
      region: "WA",
      postalCode: "98052",
    });
    setAddressValidationToken(null);
  }

  async function validateAddress() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/repair/address/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: { ...address, country: "US" } }),
      });
      const body = await readApiResponse(response);
      if (!response.ok) throw new Error(body.error ?? "We couldn't validate that address.");
      const { country: _country, ...normalizedAddress } = body.normalizedAddress;
      void _country;
      setAddress(normalizedAddress);
      setAddressValidationToken(body.validationToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't validate that address.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!device || !faultCategory || !selectedOption) return;
    setBusy(true);
    setError(null);
    try {
      const photos = await encodePhotos(faultPhotos);
      const response = await fetch("/api/repair/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentEmail: email,
          serial: device.serial,
          modelId: device.modelId,
          faultCategory,
          faultText,
          processTypeId: selectedOption.id,
          emailVerificationToken,
          shippingAddress: { ...address, country: "US" },
          addressValidationToken,
          photos,
        }),
      });
      const body = await readApiResponse(response);
      if (response.status === 409 && body.code === "ACTIVE_REQUEST_EXISTS") {
        setActiveRequest({ orderNumber: body.orderNumber, trackingUrl: body.trackingUrl });
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "We couldn't complete the request.");
      setResult(body);
      setStep("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't complete the request.");
    } finally {
      setBusy(false);
    }
  }

  const progressIndex = Math.min(stepOrder.indexOf(step), 4);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {step !== "done" ? (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold text-black/45">
            <span>Replacement request</span>
            <span>Step {Math.max(1, progressIndex + 1)} of 5</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/8">
            <div
              className="h-full rounded-full bg-[var(--green)] transition-all"
              style={{ width: `${((progressIndex + 1) / 5) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(20,30,22,0.07)] sm:p-10">
        {activeRequest ? (
          <div role="status" className="rounded-2xl border border-[var(--green-strong)]/25 bg-[var(--mint)]/25 p-6">
            <p className="text-sm font-semibold text-[var(--green-strong)]">Existing request found</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">A request is already in progress for this device</h1>
            <p className="mt-3 text-sm leading-6 text-black/60">Your verified email is now connected to order #{String(activeRequest.orderNumber).padStart(4, "0")}. Continue to its update page instead of starting another request.</p>
            <Link href={activeRequest.trackingUrl} className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white">View existing request</Link>
          </div>
        ) : null}

        {!activeRequest && parentAppEntry && busy && step === "identify" ? (
          <div className="py-16 text-center">
            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-black/15 border-t-[var(--green-strong)]" />
            <p className="mt-5 text-sm text-black/55">Finding the device from your Parent app…</p>
          </div>
        ) : null}

        {!activeRequest && step === "identify" && !(parentAppEntry && busy) ? (
          <div>
            <p className="text-sm font-semibold text-[var(--green-strong)]">Let’s find the device</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Which device needs care?</h1>
            <p className="mt-3 max-w-xl leading-7 text-black/55">
              Use the serial number or the child’s phone number. We’ll pull the device details for you.
            </p>

            <div className="mt-8 grid grid-cols-2 rounded-xl bg-black/[0.045] p-1">
              {(["serial", "phone"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setLookupType(type);
                    setIdentifier("");
                    setLookupFailed(false);
                  }}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${lookupType === type ? "bg-white shadow-sm" : "text-black/50"}`}
                >
                  {type === "serial" ? "Serial number" : "Child phone"}
                </button>
              ))}
            </div>

            <label className="mt-6 block text-sm font-semibold" htmlFor="identifier">
              {lookupType === "serial" ? "Device serial" : "Child’s phone number"}
            </label>
            <input
              id="identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={lookupType === "serial" ? "202112T2E235968" : "(206) 555-0142"}
              className="mt-2 h-12 w-full rounded-xl border border-black/15 px-4 outline-none transition focus:border-[var(--green-strong)] focus:ring-3 focus:ring-[var(--mint)]/40"
            />
            <label className="mt-5 block text-sm font-semibold" htmlFor="parent-email">
              Parent email
            </label>
            <input
              id="parent-email"
              type="email"
              value={email}
              onChange={(event) => changeEmail(event.target.value)}
              placeholder="Enter email"
              className="mt-2 h-12 w-full rounded-xl border border-black/15 px-4 outline-none transition focus:border-[var(--green-strong)] focus:ring-3 focus:ring-[var(--mint)]/40"
            />

            {emailVerificationToken ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                Email verified. Changing it will require a new code.
              </div>
            ) : emailChallengeId ? (
              <div className="mt-3 rounded-xl border border-black/10 bg-[#f7f8f5] p-4">
                <label className="text-sm font-semibold" htmlFor="email-code">Six-digit code</label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="email-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ""))}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-black/15 px-4 font-mono tracking-[0.25em] outline-none focus:border-[var(--green-strong)]"
                  />
                  <button
                    type="button"
                    onClick={verifyEmail}
                    disabled={busy || emailCode.length !== 6}
                    className="rounded-xl bg-black px-5 text-sm font-semibold text-white disabled:opacity-35"
                  >
                    Verify
                  </button>
                </div>
                {localEmailCode ? (
                  <p className="mt-3 text-xs leading-5 text-black/50">
                    Verification code for local testing: <strong className="font-mono text-black">{localEmailCode}</strong>
                  </p>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={sendEmailCode}
                disabled={busy || !email.includes("@")}
                className="mt-3 h-11 w-full rounded-xl border border-black/15 text-sm font-semibold hover:border-black/35 disabled:opacity-35"
              >
                Send verification code
              </button>
            )}

            <div className="mt-5 rounded-xl border border-[var(--green)]/35 bg-[var(--mint)]/20 p-4">
              <p className="text-sm font-semibold text-black/65">Try a sample device</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {sampleDevices.map((sampleDevice) => {
                  const sampleIdentifier = lookupType === "serial" ? sampleDevice.serial : sampleDevice.phone;
                  return (
                    <button
                      key={sampleDevice.serial}
                      type="button"
                      onClick={() => {
                        setIdentifier(sampleIdentifier);
                        setLookupFailed(false);
                      }}
                      className="rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-left transition hover:border-black/25 hover:bg-white"
                    >
                      <span className="block text-xs font-semibold text-black/70">{sampleDevice.model}</span>
                      <span className="mt-1 block font-mono text-[11px] text-black/50">{sampleIdentifier}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {lookupFailed ? (
              <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
                <h2 className="font-semibold">We couldn’t identify it yet</h2>
                <p className="mt-2 text-sm leading-6 text-black/60">
                  In the Parent app, open the child’s device and look for its serial. If the phone is unusable, support can identify it with you.
                </p>
                <button
                  type="button"
                  onClick={requestIdentificationHelp}
                  disabled={busy}
                  className="mt-4 text-sm font-semibold text-black underline decoration-[var(--green)] decoration-2 underline-offset-4"
                >
                  Ask support to identify it
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => identify()}
              disabled={busy || !identifier.trim() || !emailVerificationToken}
              className="mt-7 h-12 w-full rounded-xl bg-black px-5 font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {busy ? "Checking…" : "Find my device"}
            </button>
          </div>
        ) : null}

        {step === "confirm" && device ? (
          <div>
            <p className="text-sm font-semibold text-[var(--green-strong)]">Device found</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Is this your device?</h1>
            <div className="mt-8 rounded-2xl border border-black/10 bg-[#f7f8f5] p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-2xl font-semibold">{device.modelName}</p>
                  <p className="mt-2 font-mono text-sm text-black/55">{device.serial}</p>
                </div>
                <span className="rounded-full bg-[var(--mint)] px-3 py-1 text-xs font-semibold text-black/65">Active plan</span>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-black/10 pt-5 text-sm">
                <div><dt className="text-black/45">Manufactured</dt><dd className="mt-1 font-medium">{device.manufactured}</dd></div>
                <div><dt className="text-black/45">ICCID</dt><dd className="mt-1 font-medium">{device.iccidMasked}</dd></div>
              </dl>
            </div>
            <button
              type="button"
              onClick={() => setStep("fault")}
              className="mt-7 h-12 w-full rounded-xl bg-black font-semibold text-white hover:bg-black/80"
            >
              Yes, that’s it
            </button>
            <button
              type="button"
              onClick={() => {
                setDevice(null);
                setStep("identify");
              }}
              className="mt-3 h-11 w-full text-sm font-semibold text-black/55"
            >
              No, try another device
            </button>
          </div>
        ) : null}

        {step === "fault" ? (
          <div>
            <p className="text-sm font-semibold text-[var(--green-strong)]">Describe the problem</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">What’s wrong?</h1>
            <p className="mt-3 text-black/55">Choose the closest match, then tell us briefly what happened.</p>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {faultChoices.map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFaultCategory(value)}
                  title={hint}
                  className={`min-h-20 rounded-xl border p-3 text-left transition ${faultCategory === value ? "border-[var(--green-strong)] bg-[var(--mint)]/25 ring-2 ring-[var(--mint)]" : "border-black/10 hover:border-black/25"}`}
                >
                  <span className="block font-semibold">{label}</span>
                  <span className="mt-1 block text-xs leading-4 text-black/45">{hint}</span>
                </button>
              ))}
            </div>
            <label className="mt-6 block text-sm font-semibold" htmlFor="fault-text">What happened?</label>
            <textarea
              id="fault-text"
              value={faultText}
              onChange={(event) => setFaultText(event.target.value)}
              placeholder="For example: The screen cracked after a drop."
              rows={4}
              className="mt-2 w-full resize-none rounded-xl border border-black/15 p-4 outline-none focus:border-[var(--green-strong)] focus:ring-3 focus:ring-[var(--mint)]/40"
            />
            <label className="mt-5 block text-sm font-semibold" htmlFor="fault-photos">Photos <span className="font-normal text-black/40">(optional, up to 3)</span></label>
            <input
              id="fault-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []).slice(0, 3);
                if (files.some((file) => file.size > 5_000_000)) {
                  setError("Each photo must be 5 MB or smaller.");
                  event.target.value = "";
                  setFaultPhotos([]);
                  return;
                }
                setError(null);
                setFaultPhotos(files);
              }}
              className="mt-2 block w-full rounded-xl border border-dashed border-black/20 bg-black/[0.025] p-4 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:font-semibold file:text-white"
            />
            {faultPhotos.length > 0 ? <p className="mt-2 text-xs text-black/45">{faultPhotos.length} photo{faultPhotos.length === 1 ? "" : "s"} selected</p> : null}
            <button
              type="button"
              onClick={loadOptions}
              disabled={busy || !faultCategory || faultText.trim().length < 3}
              className="mt-7 h-12 w-full rounded-xl bg-black font-semibold text-white hover:bg-black/80 disabled:opacity-35"
            >
              {busy ? "Loading options…" : "Continue"}
            </button>
          </div>
        ) : null}

        {step === "options" ? (
          <div>
            <p className="text-sm font-semibold text-[var(--green-strong)]">Choose your replacement path</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">How would you like it handled?</h1>
            <div className="mt-5 rounded-xl bg-[var(--purple)]/15 px-4 py-3 text-sm leading-6 text-black/65">
              You’ll receive a different, refurbished {device?.modelName}. Your original device will not be returned.
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedOptionId(option.id)}
                  className={`rounded-2xl border p-5 text-left transition ${selectedOptionId === option.id ? "border-black bg-black text-white ring-4 ring-[var(--mint)]" : "border-black/10 hover:border-black/30"}`}
                >
                  <span className="text-lg font-semibold">{option.name}</span>
                  <span className={`mt-2 block text-sm leading-6 ${selectedOptionId === option.id ? "text-white/65" : "text-black/55"}`}>
                    {option.description}
                  </span>
                </button>
              ))}
            </div>

            {selectedOption ? (
              <div className="mt-5 rounded-2xl border border-black/10 bg-[#f7f8f5] p-5">
                <div className="flex justify-between text-sm"><span>Replacement fee</span><strong>{money(selectedOption.feeInCents)}</strong></div>
                <div className="mt-2 flex justify-between text-sm"><span>Refundable deposit</span><strong>{money(selectedOption.depositInCents)}</strong></div>
                <div className="mt-4 flex justify-between border-t border-black/10 pt-4"><span className="font-semibold">Due today</span><strong className="text-xl">{money(selectedOption.totalInCents)}</strong></div>
                <p className="mt-3 text-xs leading-5 text-black/45">
                  {coverage === "warranty" ? "Based on what you reported, this starts as a warranty claim." : "Based on what you reported, the accidental-damage fee applies."} Support verifies every claim before anything ships.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setStep("checkout")}
              disabled={!selectedOption}
              className="mt-7 h-12 w-full rounded-xl bg-black font-semibold text-white hover:bg-black/80 disabled:opacity-35"
            >
              Continue to checkout
            </button>
          </div>
        ) : null}

        {step === "checkout" && selectedOption ? (
          <form onSubmit={submitOrder}>
            <p className="text-sm font-semibold text-[var(--green-strong)]">Secure checkout</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Confirm your shipping address</h1>
            <p className="mt-3 text-sm leading-6 text-black/55">
              Confirm where the replacement and return materials should be sent. Card information is never stored by Teracube.
            </p>
            {!emailVerificationToken ? (
              <div className="mt-6 rounded-2xl border border-black/10 p-5">
                <p className="font-semibold">Verify your contact email</p>
                <p className="mt-1 text-sm leading-6 text-black/50">We use this inbox for the receipt, tracking, and support follow-up.</p>
                <input
                  type="email"
                  aria-label="Parent email"
                  value={email}
                  onChange={(event) => changeEmail(event.target.value)}
                  placeholder="Enter email"
                  className="mt-4 h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--green-strong)]"
                />
                {emailChallengeId ? (
                  <>
                    <div className="mt-3 flex gap-2">
                      <input
                        aria-label="Six-digit email code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={emailCode}
                        onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ""))}
                        className="h-11 min-w-0 flex-1 rounded-xl border border-black/15 px-4 font-mono tracking-[0.25em] outline-none"
                      />
                      <button type="button" onClick={verifyEmail} disabled={busy || emailCode.length !== 6} className="rounded-xl bg-black px-5 text-sm font-semibold text-white disabled:opacity-35">
                        Verify
                      </button>
                    </div>
                    {localEmailCode ? <p className="mt-3 text-xs text-black/50">Local verification code: <strong className="font-mono text-black">{localEmailCode}</strong></p> : null}
                  </>
                ) : (
                  <button type="button" onClick={sendEmailCode} disabled={busy || !email.includes("@")} className="mt-3 h-11 w-full rounded-xl border border-black/15 text-sm font-semibold disabled:opacity-35">
                    Send verification code
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                Receipt email verified: {email}
              </div>
            )}
            <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-[var(--green)]/35 bg-[var(--mint)]/20 px-4 py-3 text-sm">
              <p className="leading-5 text-black/60">Use Teracube&apos;s public Redmond address while testing this form.</p>
              <button type="button" onClick={useSampleAddress} className="shrink-0 font-semibold underline underline-offset-4">
                Use testing address
              </button>
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {[
                ["name", "Full name", "Name receiving the package", true],
                ["line1", "Address", "Street address", true],
                ["line2", "Apartment or suite", "Optional", false],
                ["city", "City", "City", true],
                ["region", "State", "WA"],
                ["postalCode", "ZIP code", "5-digit ZIP", true],
              ].map(([key, label, placeholder, required = true]) => (
                <label key={String(key)} className={key === "line1" || key === "line2" ? "sm:col-span-2" : ""}>
                  <span className="text-sm font-semibold">{label}</span>
                  <input
                    required={Boolean(required)}
                    value={address[key as keyof typeof address]}
                    onChange={(event) => changeAddress(key as keyof typeof address, event.target.value)}
                    placeholder={String(placeholder)}
                    className="mt-2 h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--green-strong)] focus:ring-3 focus:ring-[var(--mint)]/40"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={validateAddress}
              disabled={busy || Object.entries(address).some(([key, value]) => key !== "line2" && !value.trim())}
              className="mt-5 h-11 w-full rounded-xl border border-black/15 text-sm font-semibold hover:border-black/35 disabled:opacity-35"
            >
              {addressValidationToken ? "✓ Address validated" : busy ? "Checking address…" : "Validate shipping address"}
            </button>
            {addressValidationToken ? (
              <p className="mt-3 text-sm font-medium text-emerald-700">Validated and standardized for delivery.</p>
            ) : null}
            <div className="mt-6 rounded-2xl bg-[#f7f8f5] p-5">
              <div className="flex items-end justify-between gap-4">
                <div><p className="font-semibold">{selectedOption.name}</p><p className="mt-1 text-xs text-black/45">Fee + refundable deposit</p></div>
                <p className="text-2xl font-semibold">{money(selectedOption.totalInCents)}</p>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || !emailVerificationToken || !addressValidationToken}
              className="mt-7 h-12 w-full rounded-xl bg-black font-semibold text-white hover:bg-black/80 disabled:opacity-35"
            >
              {busy ? "Completing request…" : selectedOption.totalInCents === 0 ? "Confirm $0 order" : `Simulate payment of ${money(selectedOption.totalInCents)}`}
            </button>
          </form>
        ) : null}

        {step === "done" && result ? (
          <div className="py-4 text-center sm:py-8">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--mint)] text-2xl font-bold">✓</div>
            <p className="mt-6 text-sm font-semibold text-[var(--green-strong)]">Order #{String(result.orderNumber).padStart(4, "0")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">You’re all set.</h1>
            <p className="mx-auto mt-4 max-w-lg leading-7 text-black/55">
              Support will verify the request before releasing a return label or replacement. We’ll keep every update in one place.
            </p>
            <Link
              href={result.trackingUrl}
              className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-black px-7 font-semibold text-white hover:bg-black/80"
            >
              Track this request
            </Link>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
      </section>

      <p className="mt-6 text-center text-xs leading-5 text-black/40">
        Teracube keeps your request history secure. Payment details stay with the payment provider.
      </p>
    </div>
  );
}
