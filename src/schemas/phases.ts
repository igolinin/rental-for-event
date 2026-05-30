import { z } from "zod";

export const PHASE_TYPES = [
  "PACKING",
  "LOAD_IN",
  "SETUP",
  "SHOW",
  "STRIKE",
  "LOAD_OUT",
  "TRAVEL",
  "CUSTOM",
] as const;

export const PHASE_LABELS: Record<(typeof PHASE_TYPES)[number], string> = {
  PACKING: "Packing",
  LOAD_IN: "Load-in",
  SETUP: "Setup",
  SHOW: "Show",
  STRIKE: "Strike",
  LOAD_OUT: "Load-out",
  TRAVEL: "Travel",
  CUSTOM: "Custom",
};

export function phaseDisplayName(
  name: (typeof PHASE_TYPES)[number],
  customLabel?: string | null
): string {
  if (name === "CUSTOM") return customLabel?.trim() || "Custom";
  return PHASE_LABELS[name];
}

export const projectPhaseSchema = z
  .object({
    name: z.enum(PHASE_TYPES),
    customLabel: z.string().max(100).optional().nullable(),
    startAt: z.string().min(1, "Start is required"),
    endAt: z.string().min(1, "End is required"),
    sortOrder: z.coerce.number().int().default(0),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine((d) => new Date(d.endAt) >= new Date(d.startAt), {
    message: "End must be on or after start",
    path: ["endAt"],
  })
  .refine((d) => d.name !== "CUSTOM" || !!d.customLabel?.trim(), {
    message: "Custom label is required when phase type is Custom",
    path: ["customLabel"],
  });

export type ProjectPhaseFormValues = z.infer<typeof projectPhaseSchema>;
