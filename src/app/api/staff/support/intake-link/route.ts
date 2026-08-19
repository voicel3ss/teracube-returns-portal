import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { issueCustomerEntry } from "@/auth/customer-entry";
import { mockIdentityProvider } from "@/integrations/mocks/device-care";
import { normalizeEmail } from "@/verification/assertion";

const schema = z.object({ parentEmail: z.string().trim().email().max(254), deviceIdentifier: z.string().trim().min(3).max(50) });

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("order:create");
  if (!staff) return Response.json({ error: "Support authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Enter the parent email and a valid serial or child phone number." }, { status: 400 });
  const identity = await mockIdentityProvider.resolveDevice(parsed.data.deviceIdentifier.length === 15 ? { serial: parsed.data.deviceIdentifier } : { childPhone: parsed.data.deviceIdentifier });
  if (!identity) return Response.json({ error: "No Teracube device matches that serial or phone number." }, { status: 404 });
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) return Response.json({ error: "Secure customer links are not configured." }, { status: 503 });
  const token = issueCustomerEntry({ serial: identity.serial, parentEmail: normalizeEmail(parsed.data.parentEmail), source: "staff" }, secret);
  return Response.json({ path: `/repair/start?entry=${encodeURIComponent(token)}` });
}
