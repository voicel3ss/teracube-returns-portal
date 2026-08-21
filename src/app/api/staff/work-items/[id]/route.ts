import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { hasPermission } from "@/auth/permissions";
import { prisma } from "@/db/prisma";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("assign"), staffUserId: z.string().uuid(), note: z.string().trim().min(2).max(500) }),
  z.object({ action: z.literal("snooze"), days: z.union([z.literal(1), z.literal(3), z.literal(7)]), note: z.string().trim().min(2).max(500) }),
  z.object({ action: z.literal("resume") }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthorizedStaff("queue:claim");
  if (!staff) return Response.json({ error: "Staff authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid queue action." }, { status: 400 });
  const { id } = await params;
  const item = await prisma.workItem.findUnique({ where: { id } });
  if (!item || item.team !== "support") return Response.json({ error: "Queue item not found." }, { status: 404 });
  if (item.status === "completed") return Response.json({ error: "This queue item is already complete. Refresh to see the current work." }, { status: 409 });

  if (parsed.data.action === "claim") {
    const isReassignment = Boolean(item.assignedToStaffId && item.assignedToStaffId !== staff.id);
    if (isReassignment && !parsed.data.note?.trim()) {
      return Response.json({ error: "Add a note when taking an item from another agent." }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.workItem.update({
        where: { id },
        data: {
          assignedToStaffId: staff.id,
          status: "claimed",
          snoozedUntil: null,
          assignmentNote: parsed.data.note || null,
          lastActivityAt: new Date(),
        },
      }),
      prisma.auditEvent.create({
        data: {
          actorStaffId: staff.id,
          actorKind: "staff",
          action: isReassignment ? "work_item.force_reassigned" : "work_item.claimed",
          entityType: "work_item",
          entityId: id,
          metadata: { previousAssigneeId: item.assignedToStaffId, note: parsed.data.note || null },
        },
      }),
    ]);
  } else if (parsed.data.action === "assign") {
    if (!hasPermission(staff.teams, "queue:assign")) return Response.json({ error: "Ops Lead or Admin authorization required." }, { status: 403 });
    const assignee = await prisma.staffUser.findFirst({ where: { id: parsed.data.staffUserId, active: true, memberships: { some: { team: { in: ["support", "ops_lead", "admin"] } } } } });
    if (!assignee) return Response.json({ error: "Choose an active Support, Ops Lead, or Admin user." }, { status: 409 });
    await prisma.$transaction([
      prisma.workItem.update({ where: { id }, data: { assignedToStaffId: assignee.id, status: "claimed", snoozedUntil: null, assignmentNote: parsed.data.note, lastActivityAt: new Date() } }),
      prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "work_item.assigned", entityType: "work_item", entityId: id, metadata: { previousAssigneeId: item.assignedToStaffId, assigneeId: assignee.id, note: parsed.data.note } } }),
    ]);
  } else if (parsed.data.action === "snooze") {
    if (item.assignedToStaffId !== staff.id && !hasPermission(staff.teams, "queue:assign")) {
      return Response.json({ error: "Claim this item before snoozing it." }, { status: 403 });
    }
    const snoozedUntil = new Date(Date.now() + parsed.data.days * 24 * 60 * 60 * 1000);
    await prisma.$transaction([
      prisma.workItem.update({
        where: { id },
        data: { status: "snoozed", snoozedUntil, assignmentNote: parsed.data.note, lastActivityAt: new Date() },
      }),
      prisma.auditEvent.create({
        data: {
          actorStaffId: staff.id,
          actorKind: "staff",
          action: "work_item.snoozed",
          entityType: "work_item",
          entityId: id,
          metadata: { days: parsed.data.days, note: parsed.data.note },
        },
      }),
    ]);
  } else {
    if (item.status !== "snoozed") return Response.json({ error: "This item is not paused." }, { status: 409 });
    if (item.assignedToStaffId !== staff.id && !hasPermission(staff.teams, "queue:assign")) return Response.json({ error: "Only the assigned agent can resume this item." }, { status: 403 });
    await prisma.$transaction([
      prisma.workItem.update({ where: { id }, data: { status: "claimed", snoozedUntil: null, lastActivityAt: new Date() } }),
      prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "work_item.resumed", entityType: "work_item", entityId: id } }),
    ]);
  }
  return Response.json({ ok: true });
}
