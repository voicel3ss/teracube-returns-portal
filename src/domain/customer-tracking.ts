import type { ReplacementFlow, ReplacementOrderStatus, ReviewState } from "./model";
import { customerTrackingCopyDefaults, type CustomerTrackingCopy } from "./customer-tracking-copy";

export type CustomerTrackingView = {
  headline: string;
  detail: string;
  activeMilestone: number;
  tone: "normal" | "attention" | "complete";
  returnStatus: string;
  replacementStatus: string;
};

function getBaseCustomerTrackingView(
  status: ReplacementOrderStatus,
  flow?: ReplacementFlow,
  copy: CustomerTrackingCopy = customerTrackingCopyDefaults,
): CustomerTrackingView {
  switch (status) {
    case "unidentified":
      return {
        headline: copy.unidentifiedHeadline,
        detail: copy.unidentifiedDetail,
        activeMilestone: 1,
        tone: "attention",
        returnStatus: "Waiting for device details",
        replacementStatus: "Not started",
      };
    case "return_discrepancy":
      return {
        headline: copy.discrepancyHeadline,
        detail: copy.discrepancyDetail,
        activeMilestone: 2,
        tone: "attention",
        returnStatus: "Needs review",
        replacementStatus: "See latest update",
      };
    case "fulfillment_blocked":
      return {
        headline: copy.blockedHeadline,
        detail: copy.blockedDetail,
        activeMilestone: 2,
        tone: "attention",
        returnStatus: "See latest update",
        replacementStatus: "Sourcing a device",
      };
    case "closed":
      return {
        headline: copy.closedHeadline,
        detail: copy.closedDetail,
        activeMilestone: 4,
        tone: "complete",
        returnStatus: "Received",
        replacementStatus: "Delivered",
      };
    case "refurb_dispatched":
      return {
        headline: copy.dispatchedHeadline,
        detail: copy.dispatchedDetail,
        activeMilestone: 3,
        tone: "normal",
        returnStatus: flow === "advance" ? "Waiting for your return" : "In progress",
        replacementStatus: "In transit",
      };
    case "refurb_delivered":
      return {
        headline: copy.deliveredHeadline,
        detail: copy.deliveredDetail,
        activeMilestone: 3,
        tone: "normal",
        returnStatus: flow === "advance" ? "Waiting for your return" : "In progress",
        replacementStatus: "Delivered",
      };
    case "return_in_transit":
      return {
        headline: copy.returnTransitHeadline,
        detail: flow === "regular" ? copy.returnTransitRegularDetail : copy.returnTransitDetail,
        activeMilestone: 3,
        tone: "normal",
        returnStatus: "In transit",
        replacementStatus: flow === "regular" ? "Preparing to ship" : "Delivered or in progress",
      };
    case "return_received":
      return {
        headline: copy.returnReceivedHeadline,
        detail: copy.returnReceivedDetail,
        activeMilestone: 3,
        tone: "normal",
        returnStatus: "Received",
        replacementStatus: "See latest update",
      };
    case "submitted":
    case "paid":
    case "awaiting_verification":
      return {
        headline: copy.verificationHeadline,
        detail: copy.verificationDetail,
        activeMilestone: 2,
        tone: "normal",
        returnStatus: "Label pending verification",
        replacementStatus: "Pending verification",
      };
  }
}

export function getCustomerTrackingView(
  status: ReplacementOrderStatus,
  flow?: ReplacementFlow,
  shipments?: { inboundStatus?: string | null; outboundStatus?: string | null },
  reviewState?: ReviewState,
  copy: CustomerTrackingCopy = customerTrackingCopyDefaults,
): CustomerTrackingView {
  const verifiedAwaitingMovement = reviewState === "reviewed" && ["submitted", "paid", "awaiting_verification"].includes(status);
  const view = verifiedAwaitingMovement ? {
    headline: copy.verifiedHeadline,
    detail: flow === "regular"
      ? copy.verifiedRegularDetail
      : copy.verifiedAdvanceDetail,
    activeMilestone: 3,
    tone: "normal" as const,
    returnStatus: "Label ready",
    replacementStatus: flow === "regular" ? "Waiting for your return" : "Preparing to ship",
  } : getBaseCustomerTrackingView(status, flow, copy);
  if (["unidentified", "return_discrepancy", "fulfillment_blocked"].includes(status)) return view;
  const returnStatus = ["return_received", "closed"].includes(status) ? "Received"
    : status === "return_in_transit" && shipments?.inboundStatus !== "received" && shipments?.inboundStatus !== "delivered" ? "In transit"
    : shipments?.inboundStatus === "received" ? "Received"
    : shipments?.inboundStatus === "delivered" ? "Delivered to Teracube; awaiting check-in"
    : shipments?.inboundStatus === "in_transit" ? "In transit"
    : shipments?.inboundStatus === "label_ready" ? "Label ready"
    : view.returnStatus;
  const replacementStatus = ["refurb_delivered", "closed"].includes(status) ? "Delivered"
    : status === "refurb_dispatched" && shipments?.outboundStatus !== "delivered" ? "In transit"
    : shipments?.outboundStatus === "delivered" ? "Delivered"
    : shipments?.outboundStatus === "in_transit" ? "In transit"
    : shipments?.outboundStatus === "label_ready" ? "Preparing to ship"
    : view.replacementStatus;
  return {
    ...view,
    returnStatus,
    replacementStatus,
  };
}
