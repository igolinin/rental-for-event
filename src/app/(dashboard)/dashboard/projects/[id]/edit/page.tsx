import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/projects/project-form";
import { getProjectById } from "@/server/queries/projects";
import { getClientsForSelect } from "@/server/queries/clients";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectById(id);
  return { title: project ? `Edit — ${project.name}` : "Edit project" };
}

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  const [project, clients] = await Promise.all([
    getProjectById(id),
    getClientsForSelect(),
  ]);

  if (!project) notFound();

  function toDateStr(d: Date | null | undefined): string {
    if (!d) return "";
    return new Date(d).toISOString().slice(0, 10);
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/projects/${id}`}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Edit: {project.name}</h1>
      </div>
      <div className="max-w-2xl">
        <ProjectForm
          clients={clients}
          projectId={id}
          defaultValues={{
            name: project.name,
            type: project.type,
            status: project.status === "ARCHIVED" ? "COMPLETED" : (project.status as "INQUIRY" | "QUOTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"),
            clientId: project.clientId,
            venue: project.venue ?? "",
            city: project.city ?? "",
            country: project.country ?? "",
            loadInAt: toDateStr(project.loadInAt),
            startAt: toDateStr(project.startAt),
            endAt: toDateStr(project.endAt),
            loadOutAt: toDateStr(project.loadOutAt),
            currencyCode: project.currencyCode,
            taxRate: project.taxRate ? Number(project.taxRate) : undefined,
            depositAmount: project.depositAmount ?? undefined,
            notes: project.notes ?? "",
            internalNotes: project.internalNotes ?? "",
          }}
        />
      </div>
    </div>
  );
}
