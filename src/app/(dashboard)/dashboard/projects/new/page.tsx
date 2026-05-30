import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/projects/project-form";
import { getClientsForSelect } from "@/server/queries/clients";

export const metadata: Metadata = { title: "New project" };

interface PageProps {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function NewProjectPage({ searchParams }: PageProps) {
  const { clientId } = await searchParams;
  const clients = await getClientsForSelect();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/projects">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">New project</h1>
      </div>
      <div className="max-w-2xl">
        <ProjectForm
          clients={clients}
          defaultValues={clientId ? { clientId } : undefined}
        />
      </div>
    </div>
  );
}
