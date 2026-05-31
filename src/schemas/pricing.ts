import { z } from "zod";

export const pricingTierSchema = z.object({
  minDays: z.coerce.number().int().min(1, "Min days must be at least 1"),
  multiplier: z.coerce.number().positive("Multiplier must be greater than zero"),
});

export const pricingProfileSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional().nullable(),
    tiers: z.array(pricingTierSchema).min(1, "At least one tier is required"),
  })
  .refine((d) => d.tiers.some((t) => t.minDays === 1), {
    message: "A tier starting at 1 day is required",
    path: ["tiers"],
  })
  .refine(
    (d) => {
      const days = d.tiers.map((t) => t.minDays);
      return new Set(days).size === days.length;
    },
    { message: "Duplicate day breakpoints are not allowed", path: ["tiers"] }
  );

export type PricingProfileFormValues = z.infer<typeof pricingProfileSchema>;
export type PricingTierFormValues = z.infer<typeof pricingTierSchema>;
