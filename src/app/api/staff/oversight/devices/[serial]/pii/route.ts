import { z } from "zod";
import { getStaffContext } from "@/auth/staff-request";
import { getPiiFieldAccess, hasPermission, type PiiField, type StaffTeam } from "@/auth/permissions";
import { prisma } from "@/db/prisma";
import { PrismaAuditRepository } from "@/db/audit-repository";
import { AuditService } from "@/security/audit";
import { PiiAccessDeniedError, PiiRevealService } from "@/security/pii";

const schema = z.object({ field: z.enum(["iccid", "imei"]) });

export async function POST(request: Request, { params }: { params: Promise<{ serial: string }> }) {
  const staff = await getStaffContext();
  if (!staff || !hasPermission(staff.teams, "oversight:view")) return Response.json({ error: "Oversight authorization required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid protected field." }, { status: 400 });
  const activeTeam = chooseTeam(staff.teams, parsed.data.field);
  if (!activeTeam) return Response.json({ error: "Your active role cannot reveal this field." }, { status: 403 });
  const { serial } = await params;
  const device = await prisma.device.findUnique({
    where: { serial: serial.toUpperCase() },
  });
  if (!device) return Response.json({ error: "Device not found." }, { status: 404 });

  try {
    const value = await new PiiRevealService(new AuditService(new PrismaAuditRepository(prisma))).reveal({
      activeTeam,
      actorStaffId: staff.id,
      field: parsed.data.field,
      entityType: "device",
      entityId: device.serial,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      loadValue: async () => parsed.data.field === "iccid" ? device.iccid ?? "Not available" : device.imei ?? "Not available",
    });
    return Response.json({ value });
  } catch (error) {
    if (error instanceof PiiAccessDeniedError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: "This protected value could not be revealed." }, { status: 500 });
  }
}

function chooseTeam(teams: StaffTeam[], field: PiiField): StaffTeam | null {
  const preference: StaffTeam[] = ["admin", "ops_lead", "support"];
  return preference.find((team) => teams.includes(team) && getPiiFieldAccess(team, field) !== "blocked") ?? null;
}
