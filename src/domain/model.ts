export const deviceTypes = ["phone", "watch"] as const;
export type DeviceType = (typeof deviceTypes)[number];

export const deviceGrades = ["new", "refurbished"] as const;
export type DeviceGrade = (typeof deviceGrades)[number];

export const circulationStates = ["in_stock", "deployed", "in_repair", "in_transfer", "retired"] as const;
export type CirculationState = (typeof circulationStates)[number];

export const replacementFlows = ["advance", "regular"] as const;
export type ReplacementFlow = (typeof replacementFlows)[number];

export const approvalStates = ["auto_approved", "pending_review", "approved", "rejected"] as const;
export type ApprovalState = (typeof approvalStates)[number];

export const reviewStates = ["unreviewed", "reviewed", "needs_clarification"] as const;
export type ReviewState = (typeof reviewStates)[number];

export const replacementResolutions = [
  "free_refurb",
  "paid_refurb",
  "upgrade",
  "no_replacement",
  "exception",
] as const;
export type ReplacementResolution = (typeof replacementResolutions)[number];

export const replacementOrderStatuses = [
  "submitted",
  "paid",
  "awaiting_verification",
  "refurb_dispatched",
  "refurb_delivered",
  "return_in_transit",
  "return_received",
  "closed",
  "unidentified",
  "return_discrepancy",
  "fulfillment_blocked",
] as const;
export type ReplacementOrderStatus = (typeof replacementOrderStatuses)[number];

export const shipmentTypes = ["inbound", "outbound", "internal_transfer"] as const;
export type ShipmentType = (typeof shipmentTypes)[number];

export const shipmentStatuses = ["created", "label_ready", "in_transit", "delivered", "received", "exception"] as const;
export type ShipmentStatus = (typeof shipmentStatuses)[number];

export const repairStatuses = ["received", "in_repair", "qc_pass", "back_to_stock", "terminal_fail"] as const;
export type RepairStatus = (typeof repairStatuses)[number];

export const terminalDispositions = ["scrap", "parts_harvest", "beyond_economic_repair"] as const;
export type TerminalDisposition = (typeof terminalDispositions)[number];

export interface Customer {
  id: string;
  primaryEmailId: string;
  emailIds: string[];
}

export interface DeviceModel {
  id: string;
  name: string;
  code: string;
  deviceType: DeviceType;
}

export interface Device {
  serial: string;
  modelId: string;
  grade: DeviceGrade;
  circulationState: CirculationState;
  currentOwnerId?: string;
  iccid?: string;
  imei?: string;
}

export interface ProcessType {
  id: string;
  name: string;
  flow: ReplacementFlow;
  feeInCents: number;
  depositInCents: number;
  applicableModelIds: string[];
  description: string;
}

export interface ReplacementOrder {
  id: string;
  customerId: string;
  processTypeId?: string;
  status: ReplacementOrderStatus;
  approvalState: ApprovalState;
  reviewState: ReviewState;
  resolution?: ReplacementResolution;
  returnedDeviceSerial?: string;
  outboundDeviceSerial?: string;
  originationTicketId?: string;
  communicationTicketId?: string;
}

export interface Repair {
  id: string;
  deviceSerial: string;
  status: RepairStatus;
  customerReportedFault?: string;
  csVerifiedFault?: string;
  repairTeamResolution?: string;
  terminalDisposition?: TerminalDisposition;
}

export interface Shipment {
  id: string;
  type: ShipmentType;
  status: ShipmentStatus;
  replacementOrderId?: string;
  trackingNumber?: string;
  carrier?: string;
  unitSerials: string[];
}
