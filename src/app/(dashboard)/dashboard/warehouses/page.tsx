import { Metadata } from "next";
import { getWarehouses } from "@/server/queries/warehouses";
import { WarehousesClient } from "@/components/inventory/warehouses-client";

export const metadata: Metadata = { title: "Warehouses" };

export default async function WarehousesPage() {
  const warehouses = await getWarehouses();
  return <WarehousesClient warehouses={warehouses} />;
}
