import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PiiCipher } from "../src/security/pii-cipher";

const connectionString = process.env.DATABASE_URL;
const encryptionKey = process.env.PII_ENCRYPTION_KEY;
if (!connectionString) throw new Error("DATABASE_URL is required.");
if (!encryptionKey) throw new Error("PII_ENCRYPTION_KEY is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const cipher = new PiiCipher(encryptionKey);

const samples = [
  {
    returnedSerial: "202605T2E240501",
    outboundSerial: "202605T2E249501",
    modelCode: "T2E",
    processSlug: "warranty-regular",
    email: "closed.parent01@myteracube.com",
    faultCategory: "buttons" as const,
    faultText: "The power button stopped responding unless it was pressed several times.",
    resolution: "Replaced the worn power-button flex cable and verified reliable wake and shutdown behavior.",
    inboundTracking: "94001000000000000501",
    outboundTracking: "94001000000000009501",
    submittedAt: new Date("2026-05-04T15:00:00Z"),
    receivedAt: new Date("2026-05-10T17:30:00Z"),
    completedAt: new Date("2026-05-13T19:00:00Z"),
  },
  {
    returnedSerial: "202606TC4240602",
    outboundSerial: "202606TC4249602",
    modelCode: "TC4",
    processSlug: "warranty-advance",
    email: "closed.parent02@myteracube.com",
    faultCategory: "camera" as const,
    faultText: "The rear camera showed a black preview and would not save photos.",
    resolution: "Replaced the rear camera module, calibrated focus, and passed photo and video quality checks.",
    inboundTracking: "94001000000000000602",
    outboundTracking: "94001000000000009602",
    submittedAt: new Date("2026-06-08T16:15:00Z"),
    receivedAt: new Date("2026-06-18T18:20:00Z"),
    completedAt: new Date("2026-06-21T20:10:00Z"),
  },
] as const;

const address = cipher.encrypt(JSON.stringify({ name: "Teracube Closed Sample", line1: "16625 Redmond Way", line2: "Ste M-175", city: "Redmond", region: "WA", postalCode: "98052", country: "US" }));

async function main() {
  const support = await prisma.staffUser.findUnique({ where: { email: "support@myteracube.com" } });
  const repair = await prisma.staffUser.findUnique({ where: { email: "repair@myteracube.com" } });
  const logistics = await prisma.staffUser.findUnique({ where: { email: "logistics@myteracube.com" } });
  if (!support || !repair || !logistics) throw new Error("Seeded Support, Repair, and Logistics staff accounts are required.");

  for (const sample of samples) {
    const marker = `closed-sample:${sample.returnedSerial}`;
    const existing = await prisma.replacementOrder.findFirst({ where: { communicationTicketId: marker }, select: { orderNumber: true } });
    if (existing) {
      console.log(`Already present: #${String(existing.orderNumber).padStart(4, "0")} ${sample.returnedSerial}`);
      continue;
    }
    const model = await prisma.deviceModel.findUnique({ where: { code: sample.modelCode } });
    const process = await prisma.processType.findUnique({ where: { slug: sample.processSlug } });
    if (!model || !process) throw new Error(`Missing seeded model or process for ${sample.returnedSerial}.`);

    const order = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({ data: { emails: { create: { email: sample.email, normalized: sample.email, isPrimary: true } } } });
      await tx.device.create({ data: { serial: sample.returnedSerial, modelId: model.id, grade: "refurbished", circulationState: "in_stock" } });
      await tx.device.create({ data: { serial: sample.outboundSerial, modelId: model.id, currentOwnerId: customer.id, grade: "refurbished", circulationState: "deployed" } });

      const created = await tx.replacementOrder.create({
        data: {
          customerId: customer.id,
          processTypeId: process.id,
          returnedDeviceSerial: sample.returnedSerial,
          outboundDeviceSerial: sample.outboundSerial,
          status: "closed",
          approvalState: "approved",
          reviewState: "reviewed",
          resolution: "free_refurb",
          customerFaultCategory: sample.faultCategory,
          customerFaultText: sample.faultText,
          csVerifiedFault: sample.faultText,
          communicationTicketId: marker,
          paymentReference: `closed-checkout-${sample.returnedSerial}`,
          amountPaidInCents: process.feeInCents + process.depositInCents,
          quotedFeeInCents: process.feeInCents,
          quotedDepositInCents: process.depositInCents,
          depositRefundedInCents: process.depositInCents,
          encryptedShippingAddress: address,
          submittedAt: sample.submittedAt,
          createdAt: sample.submittedAt,
          workItems: { create: { team: "support", kind: "claim_verification", status: "completed", assignedToStaffId: support.id, lastActivityAt: new Date(sample.submittedAt.getTime() + 3_600_000), createdAt: sample.submittedAt } },
          messages: { create: [
            { senderKind: "customer", body: sample.faultText, createdAt: sample.submittedAt },
            { senderKind: "staff", body: "Your claim was verified. We will keep this page updated as the device moves through shipping and repair.", createdAt: new Date(sample.submittedAt.getTime() + 3_600_000) },
            { senderKind: "system", body: "This request is complete. The replacement was delivered and the returned device was processed successfully.", createdAt: sample.completedAt },
          ] },
        },
      });

      const inbound = await tx.shipment.create({
        data: {
          replacementOrderId: created.id,
          type: "inbound",
          status: "received",
          carrier: "USPS",
          trackingNumber: sample.inboundTracking,
          provider: "sample-carrier",
          deliveredAt: new Date(sample.receivedAt.getTime() - 3_600_000),
          receivedAt: sample.receivedAt,
          contentsPresent: true,
          contentsNotes: "Device and protective packaging received in expected condition.",
          createdAt: new Date(sample.submittedAt.getTime() + 7_200_000),
          units: { create: { deviceSerial: sample.returnedSerial, observed: true } },
          trackingEvents: { create: [
            { description: "USPS accepted the return package", occurredAt: new Date(sample.receivedAt.getTime() - 259_200_000), providerCode: "ACCEPTED" },
            { description: "Return delivered to Teracube", occurredAt: new Date(sample.receivedAt.getTime() - 3_600_000), providerCode: "DELIVERED" },
          ] },
        },
      });
      const outbound = await tx.shipment.create({
        data: {
          replacementOrderId: created.id,
          type: "outbound",
          status: "delivered",
          fulfillmentType: "manual",
          carrier: "USPS",
          trackingNumber: sample.outboundTracking,
          provider: "sample-carrier",
          deliveredAt: new Date(sample.completedAt.getTime() - 86_400_000),
          createdAt: new Date(sample.submittedAt.getTime() + 10_800_000),
          units: { create: { deviceSerial: sample.outboundSerial, observed: true } },
          trackingEvents: { create: [
            { description: "Replacement departed the Teracube warehouse", occurredAt: new Date(sample.completedAt.getTime() - 259_200_000), providerCode: "IN_TRANSIT" },
            { description: "Replacement delivered to the customer", occurredAt: new Date(sample.completedAt.getTime() - 86_400_000), providerCode: "DELIVERED" },
          ] },
        },
      });
      const repairRecord = await tx.repair.create({ data: { deviceSerial: sample.returnedSerial, status: "back_to_stock", resolutionCategory: sample.faultCategory, repairTeamResolution: sample.resolution, detailedNotes: "Completed functional testing and final quality control.", receivedAt: sample.receivedAt, completedAt: sample.completedAt, createdAt: sample.receivedAt } });

      await tx.auditEvent.createMany({ data: [
        { actorKind: "customer", action: "replacement_order.submitted", entityType: "replacement_order", entityId: created.id, occurredAt: sample.submittedAt, metadata: { sample: true } },
        { actorStaffId: support.id, actorKind: "staff", action: "replacement_order.claim_reviewed", entityType: "replacement_order", entityId: created.id, occurredAt: new Date(sample.submittedAt.getTime() + 3_600_000), metadata: { confirmedCoverage: "warranty" } },
        { actorStaffId: logistics.id, actorKind: "staff", action: "shipment.inbound_received", entityType: "shipment", entityId: inbound.id, occurredAt: sample.receivedAt, metadata: { observedSerial: sample.returnedSerial, result: "matched" } },
        { actorStaffId: logistics.id, actorKind: "staff", action: "shipment.outbound_dispatched", entityType: "shipment", entityId: outbound.id, occurredAt: new Date(sample.submittedAt.getTime() + 10_800_000), metadata: { serial: sample.outboundSerial } },
        { actorStaffId: repair.id, actorKind: "staff", action: "repair.completed_and_released", entityType: "repair", entityId: repairRecord.id, occurredAt: sample.completedAt, metadata: { serial: sample.returnedSerial, resolutionCategory: sample.faultCategory } },
        { actorKind: "system", action: "replacement_order.closed", entityType: "replacement_order", entityId: created.id, occurredAt: sample.completedAt, metadata: { inboundComplete: true, outboundComplete: true } },
      ] });
      return created;
    });
    console.log(`Created closed order #${String(order.orderNumber).padStart(4, "0")} for ${sample.returnedSerial}`);
  }
}

main().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
