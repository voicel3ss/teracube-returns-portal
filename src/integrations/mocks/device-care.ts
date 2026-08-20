import type {
  CommerceProvider,
  HelpdeskProvider,
  IdentityProvider,
  Money,
  PlanProvider,
  ShippingProvider,
  ObjectStorageProvider,
} from "../contracts";

type MockDeviceRecord = {
  serial: string;
  childPhone: string;
  iccid: string;
  parentEmail: string;
};

const DEVICE_RECORDS: MockDeviceRecord[] = [
  {
    serial: "202112T2E235968",
    childPhone: "+12065550142",
    iccid: "8901260123456789012",
    parentEmail: "sarah@example.com",
  },
  {
    serial: "202503T2S118842",
    childPhone: "+12065550177",
    iccid: "8901260123456789055",
    parentEmail: "jordan@example.com",
  },
  {
    serial: "202401TC4009317",
    childPhone: "+12065550199",
    iccid: "8901260123456789099",
    parentEmail: "alex@example.com",
  },
  {
    serial: "202402TC4009418",
    childPhone: "+12065550164",
    iccid: "8901260123456789064",
    parentEmail: "casey@example.com",
  },
  {
    serial: "202403T2E236105",
    childPhone: "+12065550185",
    iccid: "8901260123456789085",
    parentEmail: "morgan@example.com",
  },
];

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

export class MockIdentityProvider implements IdentityProvider {
  async resolveDevice(input: { serial?: string; childPhone?: string }) {
    const serial = input.serial?.trim().toUpperCase();
    const childPhone = input.childPhone ? normalizePhone(input.childPhone) : undefined;
    const record = DEVICE_RECORDS.find(
      (candidate) => candidate.serial === serial || candidate.childPhone === childPhone,
    );
    return record ? { serial: record.serial, iccid: record.iccid, parentEmail: record.parentEmail } : null;
  }

  async backfillOutboundSerial(): Promise<{ serial: string } | null> {
    return null;
  }

}

export class MockPlanProvider implements PlanProvider {
  async getPlanByIccid(iccid: string) {
    if (!DEVICE_RECORDS.some((record) => record.iccid === iccid)) return null;
    return { planId: `mock-plan-${iccid.slice(-4)}`, status: "active" };
  }
}

export class MockCommerceProvider implements CommerceProvider {
  async createCheckout(input: { orderId: string; fee: Money; deposit: Money; customerEmail: string }) {
    return {
      checkoutId: `mock-checkout-${input.orderId}`,
      checkoutUrl: `/repair/mock-checkout/${input.orderId}`,
    };
  }

  async refund(_input: { paymentReference: string; amount: Money }) {
    void _input;
    return { refundReference: `mock-refund-${crypto.randomUUID()}` };
  }

  async dispatchReplacement(_input: { orderId: string; modelId: string; suppressCustomerEmail: true }): Promise<{ fulfillmentReference: string; trackingNumber?: string }> {
    void _input;
    return { fulfillmentReference: `mock-fulfillment-${crypto.randomUUID()}` };
  }
}

export class MockHelpdeskProvider implements HelpdeskProvider {
  async createOrderTicket(input: { orderId: string; customerEmail: string; subject: string }) {
    return { ticketId: `mock-freshdesk-${input.orderId}` };
  }

  async reply(input: { ticketId: string; body: string }) {
    return { messageId: `mock-message-${input.ticketId}-${crypto.randomUUID()}` };
  }
}

export class MockShippingProvider implements ShippingProvider {
  async createInboundLabel(input: { orderId: string; destinationCode: string }) {
    const trackingNumber = `9400${input.orderId.replace(/-/g, "").slice(0, 18)}`;
    return { providerShipmentId: `local-shipment-${input.orderId}`, trackingNumber, labelBytes: new TextEncoder().encode(`Teracube return ${input.orderId} to ${input.destinationCode}`), qrCodeBytes: new TextEncoder().encode(trackingNumber) };
  }
  async getTracking() { return { status: "created" as const, events: [] }; }
}

export class MockObjectStorageProvider implements ObjectStorageProvider {
  private objects = new Map<string, Uint8Array>();
  async put(input: { key: string; bytes: Uint8Array; contentType: string }) { this.objects.set(input.key, input.bytes); }
  async createSignedReadUrl(key: string) { return this.objects.has(key) ? `/api/local-objects/${encodeURIComponent(key)}` : ""; }
}

export const mockIdentityProvider = new MockIdentityProvider();
export const mockPlanProvider = new MockPlanProvider();
export const mockCommerceProvider = new MockCommerceProvider();
export const mockHelpdeskProvider = new MockHelpdeskProvider();
export const mockShippingProvider = new MockShippingProvider();
export const mockObjectStorageProvider = new MockObjectStorageProvider();
