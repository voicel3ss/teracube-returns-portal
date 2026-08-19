import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const team = z.enum(["support", "ops_lead", "repair", "logistics", "admin"]);
const createSchema = z.object({ email: z.string().trim().email().max(254), displayName: z.string().trim().min(2).max(100), teams: z.array(team).min(1) });
const updateSchema = z.object({ id: z.string().uuid(), displayName: z.string().trim().min(2).max(100), active: z.boolean(), teams: z.array(team).min(1) });

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("config:manage");
  if (!staff) return Response.json({ error: "Admin authorization required." }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter a valid staff account." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (await prisma.staffUser.findUnique({ where: { email } })) return Response.json({ error: "A staff account already uses this email." }, { status: 409 });
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.staffUser.create({ data: { email, displayName: parsed.data.displayName, memberships: { create: [...new Set(parsed.data.teams)].map((teamName) => ({ team: teamName })) } } });
    await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "staff_user.created", entityType: "staff_user", entityId: user.id, metadata: { teams: parsed.data.teams } } });
    return user;
  });
  return Response.json({ ok: true, id: created.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const staff = await getAuthorizedStaff("config:manage");
  if (!staff) return Response.json({ error: "Admin authorization required." }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter valid account settings." }, { status: 400 });
  if (parsed.data.id === staff.id && (!parsed.data.active || !parsed.data.teams.includes("admin"))) {
    return Response.json({ error: "You cannot deactivate your own account or remove your own Admin access." }, { status: 409 });
  }
  if (!await prisma.staffUser.findUnique({ where: { id: parsed.data.id } })) return Response.json({ error: "Staff account not found." }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.teamMembership.deleteMany({ where: { staffUserId: parsed.data.id } });
    await tx.staffUser.update({ where: { id: parsed.data.id }, data: { displayName: parsed.data.displayName, active: parsed.data.active, memberships: { create: [...new Set(parsed.data.teams)].map((teamName) => ({ team: teamName })) }, ...(!parsed.data.active ? { sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } } } : {}) } });
    await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "staff_user.updated", entityType: "staff_user", entityId: parsed.data.id, metadata: { active: parsed.data.active, teams: parsed.data.teams } } });
  });
  return Response.json({ ok: true });
}
