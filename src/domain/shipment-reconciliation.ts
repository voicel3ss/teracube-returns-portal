export type ReconciliationResult = "matched" | "mismatch" | "missing" | "unidentified";

export function reconcileInbound(expectedSerial: string | null, contentsPresent: boolean, observedSerial: string | null): ReconciliationResult {
  if (!contentsPresent || !observedSerial) return "missing";
  if (!expectedSerial) return "unidentified";
  return expectedSerial === observedSerial ? "matched" : "mismatch";
}
