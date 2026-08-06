import type { ReplacementFlow, ReplacementOrderStatus, ReviewState } from "./model";

type LegState = "not_started" | "in_transit" | "delivered" | "received";

export type ReplacementProgress = {
  flow: ReplacementFlow;
  status: ReplacementOrderStatus;
  reviewState: ReviewState;
  returnLeg: LegState;
  refurbLeg: LegState;
};

export type ReplacementEvent =
  | { type: "PAYMENT_CAPTURED" }
  | { type: "VERIFICATION_QUEUED" }
  | { type: "CLAIM_REVIEWED" }
  | { type: "CLARIFICATION_REQUESTED" }
  | { type: "RETURN_TRACKING_STARTED" }
  | { type: "RETURN_RECEIVED" }
  | { type: "REFURB_DISPATCHED" }
  | { type: "REFURB_DELIVERED" }
  | { type: "CLOSE" }
  | { type: "MARK_UNIDENTIFIED" }
  | { type: "MARK_RETURN_DISCREPANCY" }
  | { type: "MARK_FULFILLMENT_BLOCKED" };

export class InvalidReplacementTransitionError extends Error {
  constructor(event: ReplacementEvent["type"], status: ReplacementOrderStatus) {
    super(`Event ${event} is not valid while an order is ${status}.`);
    this.name = "InvalidReplacementTransitionError";
  }
}

export function initialReplacementProgress(flow: ReplacementFlow): ReplacementProgress {
  return {
    flow,
    status: "submitted",
    reviewState: "unreviewed",
    returnLeg: "not_started",
    refurbLeg: "not_started",
  };
}

export function canClose(progress: ReplacementProgress): boolean {
  return progress.returnLeg === "received" && progress.refurbLeg === "delivered";
}

export function applyReplacementEvent(
  progress: ReplacementProgress,
  event: ReplacementEvent,
): ReplacementProgress {
  const invalid = () => {
    throw new InvalidReplacementTransitionError(event.type, progress.status);
  };

  switch (event.type) {
    case "PAYMENT_CAPTURED":
      if (progress.status !== "submitted") return invalid();
      return { ...progress, status: "paid" };
    case "VERIFICATION_QUEUED":
      if (progress.status !== "paid") return invalid();
      return { ...progress, status: "awaiting_verification" };
    case "CLAIM_REVIEWED":
      if (progress.status !== "awaiting_verification") return invalid();
      return { ...progress, reviewState: "reviewed" };
    case "CLARIFICATION_REQUESTED":
      if (progress.status !== "awaiting_verification") return invalid();
      return { ...progress, reviewState: "needs_clarification" };
    case "REFURB_DISPATCHED":
      if (progress.reviewState !== "reviewed") return invalid();
      if (progress.flow === "regular" && progress.returnLeg !== "in_transit" && progress.returnLeg !== "received") {
        return invalid();
      }
      if (progress.refurbLeg !== "not_started") return invalid();
      return { ...progress, status: "refurb_dispatched", refurbLeg: "in_transit" };
    case "REFURB_DELIVERED":
      if (progress.refurbLeg !== "in_transit") return invalid();
      return { ...progress, status: "refurb_delivered", refurbLeg: "delivered" };
    case "RETURN_TRACKING_STARTED":
      if (progress.reviewState !== "reviewed" || progress.returnLeg !== "not_started") return invalid();
      if (progress.flow === "advance" && progress.refurbLeg !== "delivered") return invalid();
      return { ...progress, status: "return_in_transit", returnLeg: "in_transit" };
    case "RETURN_RECEIVED":
      if (progress.returnLeg !== "in_transit") return invalid();
      return { ...progress, status: "return_received", returnLeg: "received" };
    case "CLOSE":
      if (!canClose(progress)) return invalid();
      return { ...progress, status: "closed" };
    case "MARK_UNIDENTIFIED":
      return { ...progress, status: "unidentified" };
    case "MARK_RETURN_DISCREPANCY":
      return { ...progress, status: "return_discrepancy" };
    case "MARK_FULFILLMENT_BLOCKED":
      return { ...progress, status: "fulfillment_blocked" };
  }
}
