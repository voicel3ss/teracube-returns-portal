import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashToken } from "../src/auth/secure-token";
import { PiiCipher } from "../src/security/pii-cipher";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const serialPattern = "^(20\\d{2})(0[1-9]|1[0-2])([A-Z0-9]{3})(\\d{6})$";

  const models = await Promise.all([
    prisma.deviceModel.upsert({
      where: { code: "T2E" },
      update: { name: "Teracube 2e", deviceType: "phone", serialPattern },
      create: { code: "T2E", name: "Teracube 2e", deviceType: "phone", serialPattern },
    }),
    prisma.deviceModel.upsert({
      where: { code: "T2S" },
      update: { name: "Teracube 2s", deviceType: "phone", serialPattern },
      create: { code: "T2S", name: "Teracube 2s", deviceType: "phone", serialPattern },
    }),
    prisma.deviceModel.upsert({
      where: { code: "TC4" },
      update: { name: "Teracube 4", deviceType: "phone", serialPattern },
      create: { code: "TC4", name: "Teracube 4", deviceType: "phone", serialPattern },
    }),
  ]);

  const processTypes = [
    {
      slug: "warranty-advance",
      name: "Warranty advance replacement",
      flow: "advance" as const,
      feeInCents: 0,
      depositInCents: 8000,
      description: "Receive a replacement first with a refundable deposit.",
    },
    {
      slug: "warranty-regular",
      name: "Warranty regular replacement",
      flow: "regular" as const,
      feeInCents: 0,
      depositInCents: 0,
      description: "Send the damaged device first with no deposit.",
    },
    {
      slug: "accident-advance",
      name: "Accident advance replacement",
      flow: "advance" as const,
      feeInCents: 4900,
      depositInCents: 8000,
      description: "Receive a replacement first with an accidental-damage fee and refundable deposit.",
    },
    {
      slug: "accident-regular",
      name: "Accident regular replacement",
      flow: "regular" as const,
      feeInCents: 4900,
      depositInCents: 0,
      description: "Send the damaged device first with an accidental-damage fee and no deposit.",
    },
  ];

  for (const input of processTypes) {
    const processType = await prisma.processType.upsert({
      where: { slug: input.slug },
      update: input,
      create: input,
    });
    for (const model of models) {
      await prisma.processTypeModel.upsert({
        where: { processTypeId_modelId: { processTypeId: processType.id, modelId: model.id } },
        update: {},
        create: { processTypeId: processType.id, modelId: model.id },
      });
    }
  }

  const admin = await prisma.staffUser.upsert({
    where: { email: "admin@myteracube.com" },
    update: { active: true },
    create: { email: "admin@myteracube.com", displayName: "Teracube Admin" },
  });

  await prisma.teamMembership.upsert({
    where: { staffUserId_team: { staffUserId: admin.id, team: "admin" } },
    update: {},
    create: { staffUserId: admin.id, team: "admin" },
  });

  const supportAgent = await prisma.staffUser.upsert({
    where: { email: "support@myteracube.com" },
    update: { active: true, displayName: "Support Agent" },
    create: { email: "support@myteracube.com", displayName: "Support Agent" },
  });

  await prisma.teamMembership.upsert({
    where: { staffUserId_team: { staffUserId: supportAgent.id, team: "support" } },
    update: {},
    create: { staffUserId: supportAgent.id, team: "support" },
  });

  const repairTech = await prisma.staffUser.upsert({
    where: { email: "repair@myteracube.com" },
    update: { active: true, displayName: "Repair Technician" },
    create: { email: "repair@myteracube.com", displayName: "Repair Technician" },
  });
  await prisma.teamMembership.upsert({
    where: { staffUserId_team: { staffUserId: repairTech.id, team: "repair" } },
    update: {},
    create: { staffUserId: repairTech.id, team: "repair" },
  });

  const logisticsAgent = await prisma.staffUser.upsert({
    where: { email: "logistics@myteracube.com" },
    update: { active: true, displayName: "Logistics Coordinator" },
    create: { email: "logistics@myteracube.com", displayName: "Logistics Coordinator" },
  });
  await prisma.teamMembership.upsert({
    where: { staffUserId_team: { staffUserId: logisticsAgent.id, team: "logistics" } },
    update: {},
    create: { staffUserId: logisticsAgent.id, team: "logistics" },
  });

  const opsLead = await prisma.staffUser.upsert({
    where: { email: "ops@myteracube.com" },
    update: { active: true, displayName: "Operations Lead" },
    create: { email: "ops@myteracube.com", displayName: "Operations Lead" },
  });
  await prisma.teamMembership.upsert({ where: { staffUserId_team: { staffUserId: opsLead.id, team: "ops_lead" } }, update: {}, create: { staffUserId: opsLead.id, team: "ops_lead" } });
  await prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });

  const existingTestOrder = await prisma.replacementOrder.findUnique({
    where: { id: "10000000-0000-4000-8000-000000000001" },
  });
  if (!existingTestOrder) {
    const processBySlug = new Map((await prisma.processType.findMany()).map((process) => [process.slug, process]));
    const modelByCode = new Map(models.map((model) => [model.code, model]));
    const encryptionKey = process.env.PII_ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error("PII_ENCRYPTION_KEY is required to seed test scenarios.");
    const cipher = new PiiCipher(encryptionKey);
    const testCases = [
      {
        number: 1, serial: "202112T2E235968", model: "T2E", email: "screen.parent@example.com",
        faultCategory: "screen" as const, fault: "The screen has separated from the frame and flickers when touched.",
        process: "warranty-advance", status: "awaiting_verification" as const, reviewState: "unreviewed" as const,
        workKind: "claim_verification" as const, token: "test-screen-request",
      },
      {
        number: 2, serial: "202503T2S118842", model: "T2S", email: "water.parent@example.com",
        faultCategory: "water_damage" as const, fault: "The phone was splashed and now restarts every few minutes.",
        process: "accident-regular", status: "awaiting_verification" as const, reviewState: "needs_clarification" as const,
        workKind: "needs_clarification" as const, token: "test-water-clarification",
      },
      {
        number: 3, serial: "202401TC4009317", model: "TC4", email: "camera.parent@example.com",
        faultCategory: "camera" as const, fault: "The rear camera opens to a black screen and will not focus.",
        process: "warranty-regular", status: "fulfillment_blocked" as const, reviewState: "reviewed" as const,
        workKind: "fulfillment_blocked" as const, token: "test-camera-delay",
      },
      {
        number: 4, serial: "202402TC4009418", model: "TC4", email: "battery.parent@example.com",
        faultCategory: "battery" as const, fault: "The battery drains from full to empty in under two hours.",
        process: "warranty-advance", status: "return_discrepancy" as const, reviewState: "reviewed" as const,
        workKind: "return_discrepancy" as const, token: "test-battery-discrepancy",
      },
      {
        number: 5, serial: "202403T2E236105", model: "T2E", email: "buttons.parent@example.com",
        faultCategory: "buttons" as const, fault: "The power button is stuck and the volume-down button does not respond.",
        process: "accident-regular", status: "return_received" as const, reviewState: "reviewed" as const,
        workKind: null, token: "test-buttons-repair",
      },
    ];

    for (const test of testCases) {
      const model = modelByCode.get(test.model)!;
      const process = processBySlug.get(test.process)!;
      const customerId = `20000000-0000-4000-8000-${String(test.number).padStart(12, "0")}`;
      const orderId = `10000000-0000-4000-8000-${String(test.number).padStart(12, "0")}`;
      const customer = await prisma.customer.create({ data: { id: customerId, emails: { create: { email: test.email, normalized: test.email, isPrimary: true } } } });
      await prisma.device.create({ data: { serial: test.serial, modelId: model.id, currentOwnerId: customer.id, grade: "new", circulationState: test.number === 5 ? "in_repair" : "deployed" } });
      const submittedAt = new Date(Date.now() - test.number * 24 * 60 * 60 * 1000);
      const order = await prisma.replacementOrder.create({ data: {
        id: orderId, customerId: customer.id, processTypeId: process.id, returnedDeviceSerial: test.serial,
        status: test.status, reviewState: test.reviewState, approvalState: "auto_approved",
        customerFaultCategory: test.faultCategory, customerFaultText: test.fault,
        csVerifiedFault: test.reviewState === "reviewed" ? test.fault : null,
        freeOutcomeReason: process.feeInCents === 0 && test.reviewState === "reviewed" ? "Covered hardware failure" : null,
        communicationTicketId: `local-ticket-${test.number}`, paymentReference: `local-payment-${test.number}`,
        paymentLastFour: test.number % 2 ? "4242" : null, amountPaidInCents: process.feeInCents + process.depositInCents,
        encryptedShippingAddress: cipher.encrypt(JSON.stringify({ name: `Test Parent ${test.number}`, line1: `${100 + test.number} Pine Street`, city: "Seattle", region: "WA", postalCode: `9810${test.number}`, country: "US" })),
        submittedAt,
        messages: { create: [
          { senderKind: "customer", body: test.fault },
          ...(test.number === 2 ? [{ senderKind: "staff", body: "Please confirm whether the phone was submerged or only splashed." }] : []),
          ...(test.number === 3 ? [{ senderKind: "system", body: "The correct refurbished model is temporarily unavailable. Support is sourcing one." }] : []),
        ] },
        ...(test.workKind ? { workItems: { create: { team: "support", kind: test.workKind, status: "open", lastActivityAt: submittedAt } } } : {}),
      } });
      await prisma.customerAccessToken.create({ data: { customerId: customer.id, replacementOrderId: order.id, tokenHash: hashToken(test.token), expiresAt: new Date("2030-01-01T00:00:00Z") } });
      await prisma.auditEvent.create({ data: { actorKind: "system", action: "test_scenario.seeded", entityType: "replacement_order", entityId: order.id, occurredAt: submittedAt, metadata: { scenario: test.workKind ?? "repair_in_progress", serial: test.serial } } });

      if (test.number === 4) {
        await prisma.shipment.create({ data: { replacementOrderId: order.id, type: "inbound", status: "received", carrier: "USPS", trackingNumber: "9400000000000000000004", provider: "local-shipping", providerShipmentId: "local-inbound-4", receivedAt: new Date(), contentsPresent: false, contentsNotes: "Package arrived without a phone." } });
      }
      if (test.number === 5) {
        await prisma.shipment.create({ data: { replacementOrderId: order.id, type: "inbound", status: "received", carrier: "UPS", trackingNumber: "1Z999AA10123456785", provider: "local-shipping", providerShipmentId: "local-inbound-5", receivedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), contentsPresent: true, contentsNotes: "Phone received; power button visibly jammed.", units: { create: { deviceSerial: test.serial, observed: true } } } });
        await prisma.repair.create({ data: { deviceSerial: test.serial, status: "in_repair", receivedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), detailedNotes: "Awaiting button assembly diagnosis." } });
      }
    }

    for (const [serial, modelCode] of [["202405T2E236210", "T2E"], ["202406TC4009521", "TC4"]] as const) {
      await prisma.device.create({ data: { serial, modelId: modelByCode.get(modelCode)!.id, grade: "refurbished", circulationState: "in_stock" } });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
