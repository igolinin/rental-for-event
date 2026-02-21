import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/clients/client-form";
import { getClientById } from "@/server/queries/clients";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const client = await getClientById(id);
  return { title: client ? `Edit — ${client.name}` : "Edit client" };
}

export default async function EditClientPage({ params }: PageProps) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/clients/${id}`}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Edit: {client.name}</h1>
      </div>
      <div className="max-w-2xl">
        <ClientForm
          clientId={id}
          defaultValues={{
            name: client.name,
            contactName: client.contactName ?? "",
            email: client.email ?? "",
            phone: client.phone ?? "",
            address: client.address ?? "",
            city: client.city ?? "",
            country: client.country ?? "",
            taxId: client.taxId ?? "",
            notes: client.notes ?? "",
            isActive: client.isActive,
          }}
        />
      </div>
    </div>
  );
}
