import type { ReplacementFlow, ReplacementOrderStatus } from "./model";

export type CustomerTrackingView = {
  headline: string;
  detail: string;
  activeMilestone: number;
  tone: "normal" | "attention" | "complete";
  returnStatus: string;
  replacementStatus: string;
};

export function getCustomerTrackingView(
  status: ReplacementOrderStatus,
  flow?: ReplacementFlow,
): CustomerTrackingView {
  switch (status) {
    case "unidentified":
      return {
        headline: "We’re identifying your device",
        detail: "A support agent will follow up through your Teracube ticket.",
        activeMilestone: 1,
        tone: "attention",
        returnStatus: "Waiting for device details",
        replacementStatus: "Not started",
      };
    case "return_discrepancy":
      return {
        headline: "Support is checking your return",
        detail: "Something received did not match the expected return. We’ll contact you if anything is needed.",
        activeMilestone: 2,
        tone: "attention",
        returnStatus: "Needs review",
        replacementStatus: "See latest update",
      };
    case "fulfillment_blocked":
      return {
        headline: "Your replacement is slightly delayed",
        detail: "Support is sourcing the right unit and will keep you updated.",
        activeMilestone: 2,
        tone: "attention",
        returnStatus: "See latest update",
        replacementStatus: "Sourcing a device",
      };
    case "closed":
      return {
        headline: "Replacement complete",
        detail: "Your replacement and return are complete. This history stays with both devices.",
        activeMilestone: 4,
        tone: "complete",
        returnStatus: "Received",
        replacementStatus: "Delivered",
      };
    case "refurb_dispatched":
      return {
        headline: "Your replacement is on the way",
        detail: "We’ll update this page as the carrier moves your refurbished device.",
        activeMilestone: 3,
        tone: "normal",
        returnStatus: flow === "advance" ? "Waiting for your return" : "In progress",
        replacementStatus: "In transit",
      };
    case "refurb_delivered":
      return {
        headline: "Your replacement has arrived",
        detail: "Move your SIM to the replacement and remember to return the original device.",
        activeMilestone: 3,
        tone: "normal",
        returnStatus: flow === "advance" ? "Waiting for your return" : "In progress",
        replacementStatus: "Delivered",
      };
    case "return_in_transit":
      return {
        headline: "Your return is in transit",
        detail: flow === "regular" ? "Your return is moving, so the replacement can now be prepared." : "We’re watching the return tracking.",
        activeMilestone: 3,
        tone: "normal",
        returnStatus: "In transit",
        replacementStatus: flow === "regular" ? "Preparing to ship" : "Delivered or in progress",
      };
    case "return_received":
      return {
        headline: "We received your device",
        detail: "The returned unit is checked in and will begin its own repair lifecycle.",
        activeMilestone: 3,
        tone: "normal",
        returnStatus: "Received",
        replacementStatus: "See latest update",
      };
    case "submitted":
    case "paid":
    case "awaiting_verification":
      return {
        headline: "We’re verifying your request",
        detail: "A support agent checks every claim before a label or replacement is released.",
        activeMilestone: 2,
        tone: "normal",
        returnStatus: "Label pending verification",
        replacementStatus: "Pending verification",
      };
  }
}
