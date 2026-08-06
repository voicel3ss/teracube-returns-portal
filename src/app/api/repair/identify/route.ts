import { z } from "zod";
import { prisma } from "@/db/prisma";
import { parseTeracubeSerial } from "@/domain/serial-number";
import { mockIdentityProvider, mockPlanProvider } from "@/integrations/mocks/device-care";

const identifySchema = z
  .object({
    serial: z.string().trim().optional(),
    childPhone: z.string().trim().optional(),
    parentAppEntry: z.string().trim().optional(),
  })
  .refine((value) => value.serial || value.childPhone || value.parentAppEntry, {
    message: "Enter a serial number or child phone number.",
  });

export async function POST(request: Request) {
  const parsed = identifySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid lookup." }, { status: 400 });
  }

  let lookup = parsed.data;
  let trustedParentEmail: string | undefined;

  if (parsed.data.parentAppEntry) {
    const appEntry = await mockIdentityProvider.resolveParentAppEntry(parsed.data.parentAppEntry);
    if (!appEntry) return Response.json({ error: "This Parent app link is invalid or expired." }, { status: 401 });
    lookup = { serial: appEntry.serial };
    trustedParentEmail = appEntry.parentEmail;
  }

  const identity = await mockIdentityProvider.resolveDevice(lookup);
  if (!identity) return Response.json({ status: "unidentified" });

  const models = await prisma.deviceModel.findMany({ where: { active: true } });
  const serial = parseTeracubeSerial(identity.serial, models);
  if (!serial.ok) return Response.json({ status: "unidentified" });

  const model = models.find((candidate) => candidate.id === serial.value.modelId)!;
  const plan = await mockPlanProvider.getPlanByIccid(identity.iccid);

  return Response.json({
    status: "identified",
    device: {
      serial: serial.value.serial,
      modelId: model.id,
      modelName: model.name,
      deviceType: model.deviceType,
      manufactured: `${serial.value.manufacturedYear}-${String(serial.value.manufacturedMonth).padStart(2, "0")}`,
      iccidMasked: `••••${identity.iccid.slice(-4)}`,
    },
    plan: plan ? { status: plan.status } : null,
    parentEmail: trustedParentEmail,
  });
}
