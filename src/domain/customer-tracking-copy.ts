export const customerTrackingCopyDefaults = {
  unidentifiedHeadline: "We’re identifying your device",
  unidentifiedDetail: "A support agent will follow up through your secure request conversation.",
  discrepancyHeadline: "Support is checking your return",
  discrepancyDetail: "Something received did not match the expected return. We’ll contact you if anything is needed.",
  blockedHeadline: "Your replacement is slightly delayed",
  blockedDetail: "Support is sourcing the right unit and will keep you updated.",
  closedHeadline: "Replacement complete",
  closedDetail: "Your replacement and return are complete. This history stays with both devices.",
  dispatchedHeadline: "Your replacement is on the way",
  dispatchedDetail: "We’ll update this page as the carrier moves your replacement device.",
  deliveredHeadline: "Your replacement has arrived",
  deliveredDetail: "Move your SIM to the replacement and remember to return the original device.",
  returnTransitHeadline: "Your return is in transit",
  returnTransitDetail: "We’re watching the return tracking.",
  returnTransitRegularDetail: "Your return is moving, so the replacement can now be prepared.",
  returnReceivedHeadline: "We received your device",
  returnReceivedDetail: "The returned unit is checked in and will begin its own repair lifecycle.",
  verificationHeadline: "We’re verifying your request",
  verificationDetail: "A support agent checks every claim before a label or replacement is released.",
  verifiedHeadline: "Your request is verified",
  verifiedAdvanceDetail: "Your return label is ready and the replacement is being prepared.",
  verifiedRegularDetail: "Your return label is ready. Once your device starts moving, we’ll prepare the replacement.",
} as const;

export type CustomerTrackingCopy = { [K in keyof typeof customerTrackingCopyDefaults]: string };

export function resolveCustomerTrackingCopy(value: unknown): CustomerTrackingCopy {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(customerTrackingCopyDefaults).map(([key, fallback]) => [key, typeof input[key] === "string" && input[key].trim() ? input[key] : fallback])) as CustomerTrackingCopy;
}
