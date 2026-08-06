import { z } from "zod";

export const customerEmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .refine((email) => {
    const domain = email.split("@").at(-1)?.toLowerCase();
    return domain !== "example.com" && domain !== "example.org" && domain !== "example.net" && !domain?.endsWith(".invalid");
  }, "Use an email address with a real inbox.");

export const postalAddressSchema = z.object({
  name: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(3).max(150),
  line2: z.string().trim().max(150).optional(),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().length(2),
  postalCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/, "Enter a valid US ZIP code."),
  country: z.literal("US"),
});
