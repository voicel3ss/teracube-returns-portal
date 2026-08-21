import { z } from "zod";
import { prisma } from "@/db/prisma";
import { inferCoverage } from "@/domain/repair-intake";

const faultCategories = [
  "screen",
  "charging",
  "camera",
  "calls_cellular",
  "battery",
  "buttons",
  "water_damage",
  "other",
] as const;

const optionsSchema = z.object({
  modelId: z.string().uuid(),
  faultCategory: z.enum(faultCategories),
  faultText: z.string().trim().min(3).max(1000),
});

export async function POST(request: Request) {
  const parsed = optionsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid fault details." }, { status: 400 });
  }

  const coverage = inferCoverage(parsed.data.faultCategory, parsed.data.faultText);
  const mappings = await prisma.processTypeModel.findMany({
    where: {
      modelId: parsed.data.modelId,
      processType: { active: true, slug: { startsWith: `${coverage}-` } },
    },
    include: { processType: true },
    orderBy: { processType: { flow: "asc" } },
  });

  if (mappings.length === 0) {
    return Response.json({ error: "No replacement options are configured for this device." }, { status: 409 });
  }

  return Response.json({
    coverage,
    options: mappings.map(({ processType }) => ({
      id: processType.id,
      flow: processType.flow,
      name: processType.flow === "advance" ? "Get replacement first" : "Send yours first",
      description:
        processType.flow === "advance"
          ? "We ship your refurbished replacement after verification. A refundable deposit applies."
          : "Your return starts moving first, then we ship your refurbished replacement. No deposit.",
      feeInCents: processType.feeInCents,
      depositInCents: processType.depositInCents,
      totalInCents: processType.feeInCents + processType.depositInCents,
    })),
  });
}
