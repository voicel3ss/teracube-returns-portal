import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { buildOversightCsv } from "@/domain/oversight-csv";
import { oversightNeedsAttention, oversightStage, oversightStatusLabel, oversightWorkLabel } from "@/domain/oversight-case";
import { PiiCipher } from "@/security/pii-cipher";

const schema = z.object({ caseIds: z.array(z.string().uuid()).min(1).max(1000) });

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("pii:export");
  if (!staff) return Response.json({ error: "Admin authorization is required for bulk PII exports." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose between 1 and 1,000 active cases to export." }, { status: 400 });

  const config = await prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const staleBefore = new Date(Date.now() - config.staleClaimDays * 86_400_000);
  const orders = await prisma.replacementOrder.findMany({
    where: { id: { in: [...new Set(parsed.data.caseIds)] }, status: { not: "closed" } },
    include: {
      customer: { include: { emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
      processType: { select: { flow: true } },
      returnedDevice: {
        include: {
          model: { select: { name: true } },
          repairs: { where: { status: { in: ["received", "in_repair"] } }, orderBy: { updatedAt: "desc" }, take: 1 },
        },
      },
      workItems: {
        where: { status: { in: ["open", "claimed", "snoozed"] } },
        include: { assignedToStaff: { select: { id: true, displayName: true } } },
        orderBy: { lastActivityAt: "desc" },
      },
    },
  });
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const ordered = parsed.data.caseIds.map((id) => orderById.get(id)).filter((order): order is NonNullable<typeof order> => Boolean(order));

  const csv = buildOversightCsv(ordered.map((order) => {
    const assignments = order.workItems.filter((item) => item.assignedToStaff);
    const uniqueAssignments = assignments.filter((item, index) => assignments.findIndex((candidate) => candidate.assignedToStaffId === item.assignedToStaffId && candidate.kind === item.kind) === index);
    return {
      orderNumber: order.orderNumber,
      deviceSerial: order.returnedDeviceSerial,
      model: order.returnedDevice?.model.name ?? "Device not identified",
      statusLabel: oversightStatusLabel(order.status),
      stage: oversightStage(order.status, order.workItems, Boolean(order.returnedDevice?.repairs.length)),
      issue: order.customerFaultText?.trim() || order.customerFaultCategory?.replaceAll("_", " ") || "No customer description provided",
      flow: order.processType?.flow ?? null,
      needsAttention: oversightNeedsAttention(order.status, order.workItems, order.updatedAt, staleBefore),
      updatedAt: order.updatedAt.toISOString(),
      assignments: uniqueAssignments.map((item) => ({ name: item.assignedToStaff!.displayName, work: oversightWorkLabel(item.kind), team: item.team })),
      parentEmail: order.customer.emails[0]?.email ?? "Not available",
      shippingAddress: revealAddress(order.encryptedShippingAddress),
    };
  }));

  await prisma.auditEvent.create({
    data: {
      actorStaffId: staff.id,
      actorKind: "staff",
      action: "pii.bulk_exported",
      entityType: "oversight_export",
      entityId: new Date().toISOString(),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      metadata: { caseCount: ordered.length, fields: ["parent_email", "parent_address"] },
    },
  });

  const filename = `active-repair-cases-with-pii-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function revealAddress(encrypted: string | null): string {
  if (!encrypted || !process.env.PII_ENCRYPTION_KEY) return "Not available";
  try {
    const address = JSON.parse(new PiiCipher(process.env.PII_ENCRYPTION_KEY).decrypt(encrypted)) as Record<string, unknown>;
    const locality = [address.city, address.region, address.postalCode].filter(Boolean).join(" ");
    return [address.name, address.line1, address.line2, locality, address.country].filter(Boolean).join(", ");
  } catch {
    return "Not available";
  }
}
