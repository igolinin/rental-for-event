import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCrewMemberById } from "@/server/queries/crew";
import { CrewDetailClient } from "@/components/crew/crew-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const member = await getCrewMemberById(id);
  if (!member) return { title: "Not found" };
  return { title: `${member.firstName} ${member.lastName}` };
}

export default async function CrewMemberPage({ params }: PageProps) {
  const { id } = await params;
  const member = await getCrewMemberById(id);
  if (!member) notFound();

  return <CrewDetailClient member={member} />;
}
