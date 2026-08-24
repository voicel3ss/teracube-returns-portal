import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { isUniqueConstraintError } from "@/db/prisma-errors";

const team = z.enum(["support", "ops_lead", "repair", "logistics", "admin"]);
const createSchema = z.object({ email: z.string().trim().email().max(254), displayName: z.string().trim().min(2).max(100), teams: z.array(team).min(1) });
const updateSchema = z.object({ id: z.string().uuid(), displayName: z.string().trim().min(2).max(100), active: z.boolean(), teams: z.array(team).min(1) });
const removeSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("config:manage");
  if (!staff) return Response.json({ error: "Admin authorization required." }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter a valid staff account." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (await prisma.staffUser.findUnique({ where: { email } })) return Response.json({ error: "A staff account already uses this email." }, { status: 409 });
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const user = await tx.staffUser.create({ data: { email, displayName: parsed.data.displayName, memberships: { create: [...new Set(parsed.data.teams)].map((teamName) => ({ team: teamName })) } } });
      await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "staff_user.created", entityType: "staff_user", entityId: user.id, metadata: { teams: parsed.data.teams } } });
      return user;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return Response.json({ error: "A staff account already uses this email." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true, id: created.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const staff = await getAuthorizedStaff("config:manage");
  if (!staff) return Response.json({ error: "Admin authorization required." }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter valid account settings." }, { status: 400 });
  if (parsed.data.id === staff.id && (!parsed.data.active || !parsed.data.teams.includes("admin"))) {
    return Response.json({ error: "You cannot deactivate your own account or remove your own Admin access." }, { status: 409 });
  }
  const target = await prisma.staffUser.findUnique({ where: { id: parsed.data.id }, include: { memberships: true } });
  if (!target) return Response.json({ error: "Staff account not found." }, { status: 404 });
  const removingAdminAccess = target.active && target.memberships.some((membership) => membership.team === "admin") && (!parsed.data.active || !parsed.data.teams.includes("admin"));
  if (removingAdminAccess) {
    const otherActiveAdmins = await prisma.staffUser.count({ where: { id: { not: target.id }, active: true, memberships: { some: { team: "admin" } } } });
    if (otherActiveAdmins === 0) return Response.json({ error: "Keep at least one active administrator account." }, { status: 409 });
  }
  await prisma.$transaction(async (tx) => {
    const released = !parsed.data.active ? await tx.workItem.updateMany({
      where: { assignedToStaffId: parsed.data.id, status: { in: ["claimed", "snoozed"] } },
      data: { assignedToStaffId: null, status: "open", snoozedUntil: null, pauseReason: null, assignmentNote: "Returned to the team queue because staff access was removed.", lastActivityAt: new Date() },
    }) : { count: 0 };
    await tx.teamMembership.deleteMany({ where: { staffUserId: parsed.data.id } });
    await tx.staffUser.update({ where: { id: parsed.data.id }, data: { displayName: parsed.data.displayName, active: parsed.data.active, memberships: { create: [...new Set(parsed.data.teams)].map((teamName) => ({ team: teamName })) }, ...(!parsed.data.active ? { sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } } } : {}) } });
    await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "staff_user.updated", entityType: "staff_user", entityId: parsed.data.id, metadata: { active: parsed.data.active, teams: parsed.data.teams, releasedWorkItems: released.count } } });
  });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const staff = await getAuthorizedStaff("config:manage");
  if (!staff) return Response.json({ error: "Admin authorization required." }, { status: 401 });
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid staff account." }, { status: 400 });
  if (parsed.data.id === staff.id) return Response.json({ error: "You cannot remove your own staff access." }, { status: 409 });

  const target = await prisma.staffUser.findUnique({ where: { id: parsed.data.id }, include: { memberships: true } });
  if (!target) return Response.json({ error: "Staff account not found." }, { status: 404 });
  if (!target.active) return Response.json({ ok: true, releasedWorkItems: 0 });

  if (target.memberships.some((membership) => membership.team === "admin")) {
    const otherActiveAdmins = await prisma.staffUser.count({ where: { id: { not: target.id }, active: true, memberships: { some: { team: "admin" } } } });
    if (otherActiveAdmins === 0) return Response.json({ error: "Keep at least one active administrator account." }, { status: 409 });
  }

  const releasedWorkItems = await prisma.$transaction(async (tx) => {
    const released = await tx.workItem.updateMany({
      where: { assignedToStaffId: target.id, status: { in: ["claimed", "snoozed"] } },
      data: { assignedToStaffId: null, status: "open", snoozedUntil: null, pauseReason: null, assignmentNote: "Returned to the team queue because staff access was removed.", lastActivityAt: new Date() },
    });
    await tx.staffSession.updateMany({ where: { staffUserId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.staffUser.update({ where: { id: target.id }, data: { active: false } });
    await tx.auditEvent.create({
      data: {
        actorStaffId: staff.id,
        actorKind: "staff",
        action: "staff_user.access_removed",
        entityType: "staff_user",
        entityId: target.id,
        metadata: { teams: target.memberships.map((membership) => membership.team), releasedWorkItems: released.count },
      },
    });
    return released.count;
  });

  return Response.json({ ok: true, releasedWorkItems });
}
