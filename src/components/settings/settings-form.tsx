"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { upsertSettings, type SettingsFormValues } from "@/server/actions/settings";
import { toast } from "@/hooks/use-toast";

const settingsClientSchema = z.object({
  companyName: z.string().min(1, "Company name required"),
  companyAddress: z.string().optional().nullable(),
  companyEmail: z.string().optional().nullable(),
  companyPhone: z.string().optional().nullable(),
  defaultCurrencyCode: z.string().length(3).default("USD"),
  defaultTaxRate: z.coerce.number().min(0).max(1).optional().nullable(),
  invoiceTermsDays: z.coerce.number().int().min(0).default(30),
  invoiceNotes: z.string().optional().nullable(),
  otDailyThreshold: z.coerce.number().int().min(1).default(8),
  otWeeklyThreshold: z.coerce.number().int().min(1).default(40),
});

type FormValues = z.infer<typeof settingsClientSchema>;

interface SettingsFormProps {
  defaultValues?: Partial<SettingsFormValues>;
}

export function SettingsForm({ defaultValues }: SettingsFormProps) {
  const [isPending, setIsPending] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(settingsClientSchema),
    defaultValues: {
      companyName: "",
      companyAddress: "",
      companyEmail: "",
      companyPhone: "",
      defaultCurrencyCode: "USD",
      defaultTaxRate: null,
      invoiceTermsDays: 30,
      invoiceNotes: "",
      otDailyThreshold: 8,
      otWeeklyThreshold: 40,
      ...defaultValues,
    },
  });

  async function onSubmit(values: FormValues) {
    setIsPending(true);
    try {
      const result = await upsertSettings(values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error saving settings" });
        return;
      }
      toast({ title: "Settings saved" });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Company profile */}
        <div>
          <h2 className="font-semibold text-sm text-slate-900 mb-4">Company profile</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Company name *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyAddress"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea rows={2} value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Invoice defaults */}
        <div>
          <h2 className="font-semibold text-sm text-slate-900 mb-4">Invoice defaults</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="defaultCurrencyCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default currency</FormLabel>
                  <FormControl>
                    <Input maxLength={3} className="uppercase" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultTaxRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default tax rate (e.g. 0.1 = 10%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.001"
                      min={0}
                      max={1}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoiceTermsDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment terms (days)</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoiceNotes"
              render={({ field }) => (
                <FormItem className="sm:col-span-3">
                  <FormLabel>Default invoice notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Payroll / OT policy */}
        <div>
          <h2 className="font-semibold text-sm text-slate-900 mb-4">Overtime policy</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="otDailyThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily OT threshold (hours)</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="otWeeklyThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weekly OT threshold (hours)</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </Form>
  );
}
