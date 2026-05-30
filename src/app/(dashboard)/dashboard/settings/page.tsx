import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";
import { PropertyDefsManager } from "@/components/inventory/property-defs-manager";
import { getPropertyDefs } from "@/server/queries/inventory";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, propertyDefs] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { id: "singleton" } }),
    getPropertyDefs(),
  ]);

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

      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Item Properties</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Define reusable technical properties for inventory items (e.g. Power, Weight, IP Rating).
          </p>
        </div>
        <PropertyDefsManager propertyDefs={propertyDefs} />
      </div>
    </div>
  );
}
