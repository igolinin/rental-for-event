import { z } from "zod";

export const crewMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  type: z.enum(["EMPLOYEE", "FREELANCER"]).default("FREELANCER"),
  role: z.string().max(100).optional().nullable(),
  taxId: z.string().max(100).optional().nullable(),
  emergencyContact: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CrewMemberFormValues = z.infer<typeof crewMemberSchema>;

export const crewRateSchema = z.object({
  rateType: z.enum(["REGULAR", "OVERTIME", "DOUBLE_TIME", "TRAVEL_DAY", "PER_DIEM"]),
  amount: z.coerce.number().int().min(1, "Rate must be greater than zero"),
  currency: z.string().length(3).default("USD"),
  effectiveFrom: z.string().min(1, "Effective from is required"),
  effectiveTo: z.string().optional().nullable(),
});

export type CrewRateFormValues = z.infer<typeof crewRateSchema>;

export const crewAssignmentSchema = z.object({
  crewMemberId: z.string().min(1, "Crew member is required"),
  role: z.string().max(100).optional().nullable(),
  startAt: z.string().min(1, "Start date is required"),
  endAt: z.string().min(1, "End date is required"),
  notes: z.string().max(500).optional().nullable(),
});

export type CrewAssignmentFormValues = z.infer<typeof crewAssignmentSchema>;

export const timesheetSchema = z.object({
  crewMemberId: z.string().min(1, "Crew member is required"),
  crewAssignmentId: z.string().optional().nullable(),
  clockIn: z.string().min(1, "Clock-in is required"),
  clockOut: z.string().min(1, "Clock-out is required"),
  breakMinutes: z.coerce.number().int().min(0).default(0),
  timeType: z.enum(["WORK", "TRAVEL", "PER_DIEM"]).default("WORK"),
  notes: z.string().max(500).optional().nullable(),
}).refine(
  (d) => new Date(d.clockOut) > new Date(d.clockIn),
  { message: "Clock-out must be after clock-in", path: ["clockOut"] }
).refine(
  (d) => {
    const totalMinutes = (new Date(d.clockOut).getTime() - new Date(d.clockIn).getTime()) / 60000;
    return d.breakMinutes < totalMinutes;
  },
  { message: "Break cannot be longer than the shift", path: ["breakMinutes"] }
);

export type TimesheetFormValues = z.infer<typeof timesheetSchema>;

export const crewExpenseSchema = z.object({
  crewMemberId: z.string().min(1, "Crew member is required"),
  projectId: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required").max(200),
  amount: z.coerce.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500).optional().nullable(),
});

export type CrewExpenseFormValues = z.infer<typeof crewExpenseSchema>;
