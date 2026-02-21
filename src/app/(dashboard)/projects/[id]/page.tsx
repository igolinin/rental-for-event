import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectById, computeProjectPnL } from "@/server/queries/projects";
import { getItems } from "@/server/queries/inventory";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectById(id);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [project, inventoryItems] = await Promise.all([
    getProjectById(id),
    getItems({ isActive: true }),
  ]);

  if (!project) notFound();

  const pnl = computeProjectPnL(project);

  return (
    <ProjectDetailClient
      project={project}
      pnl={pnl}
      inventoryItems={inventoryItems}
    />
  );
}
