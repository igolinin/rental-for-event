import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getItemById, getPropertyDefs } from "@/server/queries/inventory";
import { getWarehouseForSelect } from "@/server/queries/warehouses";
import { getEntityHistory } from "@/server/queries/audit";
import { serializeDecimals } from "@/lib/serialize";
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
  const [item, warehouses, allPropertyDefs, history] = await Promise.all([
    getItemById(id),
    getWarehouseForSelect(),
    getPropertyDefs(),
    getEntityHistory("InventoryItem", id),
  ]);

  if (!item) notFound();

  return <ItemDetailClient item={serializeDecimals(item)} warehouses={warehouses} allPropertyDefs={serializeDecimals(allPropertyDefs)} history={history} />;
}
