import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCrewMemberById } from "@/server/queries/crew";
import { CrewForm } from "@/components/crew/crew-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const member = await getCrewMemberById(id);
  if (!member) return { title: "Not found" };
  return { title: `Edit ${member.firstName} ${member.lastName}` };
}

export default async function EditCrewMemberPage({ params }: PageProps) {
  const { id } = await params;
  const member = await getCrewMemberById(id);
  if (!member) notFound();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/crew/${id}`}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">
          Edit {member.firstName} {member.lastName}
        </h1>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <CrewForm
          crewId={id}
          defaultValues={{
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email ?? "",
            phone: member.phone ?? "",
            type: member.type,
            role: member.role ?? "",
            taxId: member.taxId ?? "",
            emergencyContact: member.emergencyContact ?? "",
            notes: member.notes ?? "",
            isActive: member.isActive,
          }}
        />
      </div>
    </div>
  );
}
