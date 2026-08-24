import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PiiCipher } from "../src/security/pii-cipher";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const samples = [
  {
    serial: "202607T2E240701",
    modelCode: "T2E",
    email: "queue.parent01@myteracube.com",
    faultCategory: "screen" as const,
    faultText: "The screen flickers intermittently and briefly goes black when the device is unlocked.",
  },
  {
    serial: "202607T2S240702",
    modelCode: "T2S",
    email: "queue.parent02@myteracube.com",
    faultCategory: "battery" as const,
    faultText: "The battery drops from a full charge to below 20% before the end of the school day.",
  },
  {
    serial: "202607TC4240703",
    modelCode: "TC4",
    email: "queue.parent03@myteracube.com",
    faultCategory: "charging" as const,
    faultText: "The charging cable only works at an angle and disconnects whenever the phone is moved.",
  },
  {
    serial: "202607T2E240704",
    modelCode: "T2E",
    email: "queue.parent04@myteracube.com",
    faultCategory: "camera" as const,
    faultText: "The rear camera will not focus and every photo remains blurry after restarting the device.",
  },
  {
    serial: "202608T2E240805",
    modelCode: "T2E",
    email: "stale.parent@myteracube.com",
    faultCategory: "calls_cellular" as const,
    faultText: "Calls and alarms are nearly silent even when every volume control is set to maximum.",
    daysOld: 7,
  },
] as const;

const sampleAddress = {
  name: "Teracube Queue Sample",
  line1: "16625 Redmond Way",
  line2: "Ste M-175",
  city: "Redmond",
  region: "WA",
  postalCode: "98052",
  country: "US",
};

async function main() {
  const processType = await prisma.processType.findFirst({
    where: { slug: "warranty-regular", active: true },
  });
  if (!processType) throw new Error("The warranty-regular process type is not seeded.");

  const encryptionKey = process.env.PII_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("PII_ENCRYPTION_KEY is required to create usable queue samples.");
  const encryptedShippingAddress = new PiiCipher(encryptionKey).encrypt(JSON.stringify(sampleAddress));

  const created: Array<{ orderNumber: number; serial: string; issue: string }> = [];
  const skipped: string[] = [];

  for (const sample of samples) {
    const marker = `local-team-queue:${sample.serial}`;
    const existing = await prisma.replacementOrder.findFirst({
      where: { communicationTicketId: marker },
      select: { orderNumber: true },
    });
    if (existing) {
      skipped.push(`${sample.serial} (order #${String(existing.orderNumber).padStart(4, "0")})`);
      continue;
    }

    const model = await prisma.deviceModel.findUnique({ where: { code: sample.modelCode } });
    if (!model) throw new Error(`Device model ${sample.modelCode} is not seeded.`);

    const sampleTime = "daysOld" in sample ? new Date(Date.now() - sample.daysOld * 86_400_000) : new Date();
    const order = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          emails: {
            create: {
              email: sample.email,
              normalized: sample.email.toLowerCase(),
              isPrimary: true,
            },
          },
        },
      });

      await tx.device.upsert({
        where: { serial: sample.serial },
        update: {
          modelId: model.id,
          currentOwnerId: customer.id,
          grade: "new",
          circulationState: "deployed",
        },
        create: {
          serial: sample.serial,
          modelId: model.id,
          currentOwnerId: customer.id,
          grade: "new",
          circulationState: "deployed",
        },
      });

      const createdOrder = await tx.replacementOrder.create({
        data: {
          customerId: customer.id,
          processTypeId: processType.id,
          returnedDeviceSerial: sample.serial,
          status: "awaiting_verification",
          approvalState: "auto_approved",
          reviewState: "unreviewed",
          customerFaultCategory: sample.faultCategory,
          customerFaultText: sample.faultText,
          communicationTicketId: marker,
          quotedFeeInCents: processType.feeInCents,
          quotedDepositInCents: processType.depositInCents,
          amountPaidInCents: processType.feeInCents + processType.depositInCents,
          encryptedShippingAddress,
          submittedAt: sampleTime,
          createdAt: sampleTime,
          updatedAt: sampleTime,
          workItems: {
            create: {
              team: "support",
              kind: "claim_verification",
              status: "open",
              createdAt: sampleTime,
              updatedAt: sampleTime,
              lastActivityAt: sampleTime,
            },
          },
          messages: {
            create: {
              senderKind: "customer",
              body: sample.faultText,
              createdAt: sampleTime,
            },
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          actorKind: "system",
          action: "local_team_queue_sample.created",
          entityType: "replacement_order",
          entityId: createdOrder.id,
          metadata: { serial: sample.serial, source: "scripts/create-team-queue-samples.ts" },
        },
      });

      return createdOrder;
    });

    created.push({ orderNumber: order.orderNumber, serial: sample.serial, issue: sample.faultCategory });
  }

  if (created.length) {
    console.log("Created unassigned Support team-queue cases:");
    for (const item of created) {
      console.log(`  #${String(item.orderNumber).padStart(4, "0")}  ${item.serial}  ${item.issue}`);
    }
  }
  if (skipped.length) {
    console.log("Already present (left unchanged):");
    for (const item of skipped) console.log(`  ${item}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
