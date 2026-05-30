import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "singleton" },
  });

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Company profile and system defaults
        </p>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <SettingsForm
          defaultValues={
            settings
              ? {
                  companyName: settings.companyName,
                  companyAddress: settings.companyAddress ?? "",
                  companyEmail: settings.companyEmail ?? "",
                  companyPhone: settings.companyPhone ?? "",
                  defaultCurrencyCode: settings.defaultCurrencyCode,
                  defaultTaxRate: settings.defaultTaxRate
                    ? Number(settings.defaultTaxRate)
                    : null,
                  invoiceTermsDays: settings.invoiceTermsDays,
                  invoiceNotes: settings.invoiceNotes ?? "",
                  otDailyThreshold: settings.otDailyThreshold,
                  otWeeklyThreshold: settings.otWeeklyThreshold,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
