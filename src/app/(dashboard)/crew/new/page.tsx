import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrewForm } from "@/components/crew/crew-form";

export const metadata: Metadata = { title: "Add crew member" };

export default function NewCrewPage() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/crew">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Add crew member</h1>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <CrewForm />
      </div>
    </div>
  );
}
