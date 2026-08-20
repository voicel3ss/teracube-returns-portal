import { z } from "zod";
import { getStaffContext } from "@/auth/staff-request";
import { getPiiFieldAccess, type PiiField, type StaffTeam } from "@/auth/permissions";
import { prisma } from "@/db/prisma";
import { PrismaAuditRepository } from "@/db/audit-repository";
import { AuditService } from "@/security/audit";
import { PiiCipher } from "@/security/pii-cipher";
import { PiiAccessDeniedError, PiiRevealService } from "@/security/pii";

const schema = z.object({ field: z.enum(["parent_email", "parent_address", "payment_reference"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) return Response.json({ error: "Staff authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Choose a valid protected field." }, { status: 400 });
  const activeTeam = chooseTeam(staff.teams, parsed.data.field);
  if (!activeTeam) return Response.json({ error: "Your active role cannot reveal this field." }, { status: 403 });
  const { id } = await params;
  const order = await prisma.replacementOrder.findUnique({ where: { id }, include: { customer: { include: { emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } } } });
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  try {
    const value = await new PiiRevealService(new AuditService(new PrismaAuditRepository(prisma))).reveal({
      activeTeam, actorStaffId: staff.id, field: parsed.data.field, entityType: "replacement_order", entityId: order.id,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      loadValue: async () => loadValue(parsed.data.field, order),
    });
    return Response.json({ value });
  } catch (error) {
    if (error instanceof PiiAccessDeniedError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: "This protected value could not be revealed." }, { status: 500 });
  }
}

function chooseTeam(teams: StaffTeam[], field: PiiField) {
  const preference: StaffTeam[] = field === "parent_address" ? ["admin", "ops_lead", "support", "logistics"] : ["admin", "ops_lead", "support"];
  return preference.find((team) => teams.includes(team) && getPiiFieldAccess(team, field) !== "blocked") ?? null;
}

async function loadValue(field: "parent_email" | "parent_address" | "payment_reference", order: { paymentReference: string | null; encryptedShippingAddress: string | null; customer: { emails: Array<{ email: string }> } }) {
  if (field === "parent_email") return order.customer.emails[0]?.email ?? "Not available";
  if (field === "payment_reference") return order.paymentReference ?? "Not available";
  if (!order.encryptedShippingAddress || !process.env.PII_ENCRYPTION_KEY) return "Not available";
  const raw = new PiiCipher(process.env.PII_ENCRYPTION_KEY).decrypt(order.encryptedShippingAddress);
  const address = JSON.parse(raw) as Record<string, unknown>;
  return [address.name, address.line1, address.line2, [address.city, address.region, address.postalCode].filter(Boolean).join(", "), address.country].filter(Boolean).join("\n");
}
