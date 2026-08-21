import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const copyField = z.string().trim().min(5).max(500);
const customerTrackingCopy = z.object({ unidentifiedHeadline: copyField, unidentifiedDetail: copyField, discrepancyHeadline: copyField, discrepancyDetail: copyField, blockedHeadline: copyField, blockedDetail: copyField, closedHeadline: copyField, closedDetail: copyField, dispatchedHeadline: copyField, dispatchedDetail: copyField, deliveredHeadline: copyField, deliveredDetail: copyField, returnTransitHeadline: copyField, returnTransitDetail: copyField, returnTransitRegularDetail: copyField, returnReceivedHeadline: copyField, returnReceivedDetail: copyField, verificationHeadline: copyField, verificationDetail: copyField, verifiedHeadline: copyField, verifiedAdvanceDetail: copyField, verifiedRegularDetail: copyField });
const schema = z.object({ approvalMode: z.literal("auto"), depositRefundGate: z.enum(["return_in_transit", "return_received"]), returnReminderDays: z.number().int().min(1).max(30), returnEscalationDays: z.number().int().min(2).max(60), staleClaimDays: z.number().int().min(1).max(30), unidentifiedEscalationDays: z.number().int().min(1).max(30), stuckRepairDays: z.number().int().min(1).max(30), returnInstructions: z.string().trim().min(20).max(2000), customerTrackingCopy, processTypes: z.array(z.object({ id: z.string().uuid(), feeInCents: z.number().int().min(0).max(100000), depositInCents: z.number().int().min(0).max(100000), description: z.string().trim().min(10).max(500), active: z.boolean() })).max(50) });

export async function PUT(request: Request) {
  const staff = await getAuthorizedStaff("config:manage");
  if (!staff) return Response.json({ error: "Admin authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid configuration." }, { status: 400 });
  if (parsed.data.returnEscalationDays <= parsed.data.returnReminderDays) return Response.json({ error: "Return escalation must occur after the reminder." }, { status: 400 });
  const processIds = parsed.data.processTypes.map((process) => process.id);
  if (new Set(processIds).size !== processIds.length) return Response.json({ error: "Each replacement option can appear only once." }, { status: 400 });
  if (await prisma.processType.count({ where: { id: { in: processIds } } }) !== processIds.length) return Response.json({ error: "One of these replacement options no longer exists. Refresh before saving." }, { status: 409 });
  await prisma.$transaction([
    prisma.appConfig.upsert({ where: { id: "default" }, update: { approvalMode: parsed.data.approvalMode, depositRefundGate: parsed.data.depositRefundGate, returnReminderDays: parsed.data.returnReminderDays, returnEscalationDays: parsed.data.returnEscalationDays, staleClaimDays: parsed.data.staleClaimDays, unidentifiedEscalationDays: parsed.data.unidentifiedEscalationDays, stuckRepairDays: parsed.data.stuckRepairDays, returnInstructions: parsed.data.returnInstructions, customerTrackingCopy: parsed.data.customerTrackingCopy }, create: { id: "default", approvalMode: parsed.data.approvalMode, depositRefundGate: parsed.data.depositRefundGate, returnReminderDays: parsed.data.returnReminderDays, returnEscalationDays: parsed.data.returnEscalationDays, staleClaimDays: parsed.data.staleClaimDays, unidentifiedEscalationDays: parsed.data.unidentifiedEscalationDays, stuckRepairDays: parsed.data.stuckRepairDays, returnInstructions: parsed.data.returnInstructions, customerTrackingCopy: parsed.data.customerTrackingCopy } }),
    ...parsed.data.processTypes.map((process) => prisma.processType.update({ where: { id: process.id }, data: { feeInCents: process.feeInCents, depositInCents: process.depositInCents, description: process.description, active: process.active } })),
    prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "configuration.updated", entityType: "app_config", entityId: "default", metadata: { processTypesUpdated: parsed.data.processTypes.length, approvalMode: "auto" } } }),
  ]);
  return Response.json({ ok: true });
}
