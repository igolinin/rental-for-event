import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getItemById } from "@/server/queries/inventory";
import { ItemDetailClient } from "@/components/inventory/item-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = await getItemById(id);
  return { title: item?.name ?? "Inventory item" };
}

export default async function InventoryItemPage({ params }: PageProps) {
  const { id } = await params;
  const item = await getItemById(id);

  if (!item) notFound();

  return <ItemDetailClient item={item} />;
}
