import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const schema = z.object({ approvalMode: z.literal("auto"), depositRefundGate: z.enum(["return_in_transit", "return_received"]), returnReminderDays: z.number().int().min(1).max(30), returnEscalationDays: z.number().int().min(2).max(60), staleClaimDays: z.number().int().min(1).max(30), unidentifiedEscalationDays: z.number().int().min(1).max(30), stuckRepairDays: z.number().int().min(1).max(30), returnInstructions: z.string().trim().min(20).max(2000), processTypes: z.array(z.object({ id: z.string().uuid(), feeInCents: z.number().int().min(0).max(100000), depositInCents: z.number().int().min(0).max(100000), description: z.string().trim().min(10).max(500), active: z.boolean() })).max(50) });

export async function PUT(request: Request) {
  const staff = await getAuthorizedStaff("config:manage");
  if (!staff) return Response.json({ error: "Admin authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid configuration." }, { status: 400 });
  if (parsed.data.returnEscalationDays <= parsed.data.returnReminderDays) return Response.json({ error: "Return escalation must occur after the reminder." }, { status: 400 });
  await prisma.$transaction([
    prisma.appConfig.upsert({ where: { id: "default" }, update: { approvalMode: parsed.data.approvalMode, depositRefundGate: parsed.data.depositRefundGate, returnReminderDays: parsed.data.returnReminderDays, returnEscalationDays: parsed.data.returnEscalationDays, staleClaimDays: parsed.data.staleClaimDays, unidentifiedEscalationDays: parsed.data.unidentifiedEscalationDays, stuckRepairDays: parsed.data.stuckRepairDays, returnInstructions: parsed.data.returnInstructions }, create: { id: "default", approvalMode: parsed.data.approvalMode, depositRefundGate: parsed.data.depositRefundGate, returnReminderDays: parsed.data.returnReminderDays, returnEscalationDays: parsed.data.returnEscalationDays, staleClaimDays: parsed.data.staleClaimDays, unidentifiedEscalationDays: parsed.data.unidentifiedEscalationDays, stuckRepairDays: parsed.data.stuckRepairDays, returnInstructions: parsed.data.returnInstructions } }),
    ...parsed.data.processTypes.map((process) => prisma.processType.update({ where: { id: process.id }, data: { feeInCents: process.feeInCents, depositInCents: process.depositInCents, description: process.description, active: process.active } })),
    prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "configuration.updated", entityType: "app_config", entityId: "default", metadata: { processTypesUpdated: parsed.data.processTypes.length, approvalMode: "auto" } } }),
  ]);
  return Response.json({ ok: true });
}
