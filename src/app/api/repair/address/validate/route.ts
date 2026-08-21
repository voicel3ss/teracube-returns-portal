import { z } from "zod";
import { mockAddressValidationProvider } from "@/integrations/mocks/address-validation";
import { canonicalAddress, issueVerificationAssertion } from "@/verification/assertion";
import { postalAddressSchema } from "@/verification/schemas";

const schema = z.object({ address: postalAddressSchema });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter a complete US address." }, { status: 400 });
  }

  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) return Response.json({ error: "Address validation is not configured." }, { status: 503 });

  const validation = await mockAddressValidationProvider.validate(parsed.data.address);
  if (!validation.valid) return Response.json({ error: validation.reason }, { status: 422 });

  return Response.json({
    validationId: validation.validationId,
    normalizedAddress: validation.normalizedAddress,
    validationToken: issueVerificationAssertion(
      "shipping_address",
      canonicalAddress(validation.normalizedAddress),
      secret,
    ),
  });
}
