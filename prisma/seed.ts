import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
