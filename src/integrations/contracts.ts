import type { ShipmentStatus } from "@/domain/model";

export type Money = { amountInCents: number; currency: "USD" };

export type PostalAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: "US";
};

export interface AddressValidationProvider {
  validate(address: PostalAddress): Promise<
    | { valid: true; validationId: string; normalizedAddress: PostalAddress }
    | { valid: false; reason: string }
  >;
}

export interface CommerceProvider {
  createCheckout(input: {
    orderId: string;
    fee: Money;
    deposit: Money;
    customerEmail: string;
  }): Promise<{ checkoutId: string; checkoutUrl: string }>;
  refund(input: { paymentReference: string; amount: Money }): Promise<{ refundReference: string }>;
  dispatchReplacement(input: { orderId: string; modelId: string; suppressCustomerEmail: true }): Promise<{
    fulfillmentReference: string;
    trackingNumber?: string;
  }>;
}

export interface ShippingProvider {
  createInboundLabel(input: { orderId: string; destinationCode: string }): Promise<{
    providerShipmentId: string;
    labelBytes: Uint8Array;
    qrCodeBytes?: Uint8Array;
    trackingNumber: string;
  }>;
  getTracking(providerShipmentId: string): Promise<{
    status: ShipmentStatus;
    events: Array<{ occurredAt: Date; description: string }>;
  }>;
}

export interface HelpdeskProvider {
  createOrderTicket(input: { orderId: string; customerEmail: string; subject: string }): Promise<{ ticketId: string }>;
  reply(input: { ticketId: string; body: string }): Promise<{ messageId: string }>;
}

export interface IdentityProvider {
  resolveDevice(input: { serial?: string; childPhone?: string }): Promise<{
    serial: string;
    iccid: string;
    parentEmail?: string;
    childName?: string;
  } | null>;
  backfillOutboundSerial(orderId: string): Promise<{ serial: string } | null>;
}

export interface PlanProvider {
  getPlanByIccid(iccid: string): Promise<{ planId: string; status: string } | null>;
}

export interface ObjectStorageProvider {
  put(input: { key: string; bytes: Uint8Array; contentType: string }): Promise<void>;
  createSignedReadUrl(key: string): Promise<string>;
}
