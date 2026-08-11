import type {
  CommerceProvider,
  HelpdeskProvider,
  IdentityProvider,
  Money,
  PlanProvider,
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

  async resolveParentAppEntry(entryToken: string) {
    const index = entryToken === "parent-app-preview" ? 0 : -1;
    const record = DEVICE_RECORDS[index];
    return record ? { serial: record.serial, parentEmail: record.parentEmail } : null;
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

  async dispatchReplacement() {
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

export const mockIdentityProvider = new MockIdentityProvider();
export const mockPlanProvider = new MockPlanProvider();
export const mockCommerceProvider = new MockCommerceProvider();
export const mockHelpdeskProvider = new MockHelpdeskProvider();
