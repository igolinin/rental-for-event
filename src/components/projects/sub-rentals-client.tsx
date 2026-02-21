"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  subRentalSchema,
  subRentalItemSchema,
  type SubRentalFormValues,
  type SubRentalItemFormValues,
} from "@/schemas/projects";
import {
  createSubRental,
  updateSubRentalStatus,
  addSubRentalItem,
  removeSubRentalItem,
} from "@/server/actions/projects";
import { toast } from "@/hooks/use-toast";
import { Plus, MoreHorizontal, Trash2, ChevronDown } from "lucide-react";
import type { ProjectDetail } from "@/server/queries/projects";
import { formatDate } from "@/lib/utils";

type SubRental = NonNullable<ProjectDetail>["subRentals"][number];

const subRentalStatusBadge: Record<string, { label: string; className: string }> = {
  REQUESTED: { label: "Requested", className: "bg-slate-100 text-slate-600 border-slate-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-50 text-blue-700 border-blue-200" },
  RECEIVED: { label: "Received", className: "bg-green-50 text-green-700 border-green-200" },
  RETURNED: { label: "Returned", className: "bg-purple-50 text-purple-700 border-purple-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
};

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

interface SubRentalsClientProps {
  projectId: string;
  subRentals: SubRental[];
  projectCurrency: string;
  projectStartAt: string;
  projectEndAt: string;
}

export function SubRentalsClient({
  projectId,
  subRentals,
  projectCurrency,
  projectStartAt,
  projectEndAt,
}: SubRentalsClientProps) {
  const router = useRouter();
  const [srDialogOpen, setSrDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [selectedSrId, setSelectedSrId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const srForm = useForm<SubRentalFormValues>({
    resolver: zodResolver(subRentalSchema),
    defaultValues: {
      vendorName: "",
      vendorContact: "",
      vendorEmail: "",
      startAt: projectStartAt,
      endAt: projectEndAt,
      notes: "",
    },
  });

  const itemForm = useForm<SubRentalItemFormValues>({
    resolver: zodResolver(subRentalItemSchema),
    defaultValues: {
      description: "",
      quantity: 1,
      unitRateAmount: 0,
      unitRateCurrency: projectCurrency,
      rateType: "DAILY",
      rateDays: 1,
    },
  });

  async function onCreateSubRental(values: SubRentalFormValues) {
    setIsPending(true);
    try {
      const result = await createSubRental(projectId, values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error creating sub-rental" });
        return;
      }
      toast({ title: "Sub-rental created" });
      setSrDialogOpen(false);
      srForm.reset();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function onAddItem(values: SubRentalItemFormValues) {
    if (!selectedSrId) return;
    setIsPending(true);
    try {
      const result = await addSubRentalItem(selectedSrId, projectId, values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error adding item" });
        return;
      }
      toast({ title: "Item added" });
      setItemDialogOpen(false);
      itemForm.reset();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleStatusChange(
    srId: string,
    status: "REQUESTED" | "CONFIRMED" | "RECEIVED" | "RETURNED" | "CANCELLED"
  ) {
    await updateSubRentalStatus(srId, projectId, status);
    toast({ title: "Status updated" });
    router.refresh();
  }

  async function handleRemoveItem(itemId: string) {
    await removeSubRentalItem(itemId, projectId);
    toast({ title: "Item removed" });
    router.refresh();
  }

  const totalCost = subRentals
    .flatMap((sr) => sr.items)
    .reduce((sum, item) => sum + item.unitRateAmount * item.rateDays * item.quantity, 0);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setSrDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add sub-rental vendor
        </Button>
      </div>

      {subRentals.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-center text-muted-foreground text-sm">
          No sub-rentals added.
        </div>
      )}

      <div className="space-y-4">
        {subRentals.map((sr) => {
          const badge = subRentalStatusBadge[sr.status];
          const srTotal = sr.items.reduce(
            (sum, item) => sum + item.unitRateAmount * item.rateDays * item.quantity,
            0
          );

          return (
            <div key={sr.id} className="rounded-lg border bg-white">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <span className="font-medium">{sr.vendorName}</span>
                  {sr.vendorContact && (
                    <span className="text-sm text-muted-foreground ml-2">
                      — {sr.vendorContact}
                    </span>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(sr.startAt)} → {formatDate(sr.endAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedSrId(sr.id);
                          itemForm.reset({
                            description: "",
                            quantity: 1,
                            unitRateAmount: 0,
                            unitRateCurrency: projectCurrency,
                            rateType: "DAILY",
                            rateDays: 1,
                          });
                          setItemDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add line item
                      </DropdownMenuItem>
                      {sr.status !== "CONFIRMED" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(sr.id, "CONFIRMED")}>
                          Mark confirmed
                        </DropdownMenuItem>
                      )}
                      {sr.status !== "RECEIVED" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(sr.id, "RECEIVED")}>
                          Mark received
                        </DropdownMenuItem>
                      )}
                      {sr.status !== "RETURNED" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(sr.id, "RETURNED")}>
                          Mark returned
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleStatusChange(sr.id, "CANCELLED")}
                      >
                        Cancel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {sr.items.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit rate</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sr.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.description}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCents(item.unitRateAmount, item.unitRateCurrency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{item.rateType}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{item.rateDays}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">
                          {formatCents(
                            item.unitRateAmount * item.rateDays * item.quantity,
                            item.unitRateCurrency
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="px-4 py-2 text-right text-sm font-medium text-slate-600 border-t">
                Vendor total: {formatCents(srTotal, projectCurrency)}
              </div>
            </div>
          );
        })}
      </div>

      {subRentals.length > 0 && (
        <div className="mt-3 text-right text-sm font-semibold text-slate-700">
          Total sub-rental cost: {formatCents(totalCost, projectCurrency)}
        </div>
      )}

      {/* Sub-rental vendor dialog */}
      <Dialog open={srDialogOpen} onOpenChange={setSrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add sub-rental vendor</DialogTitle>
          </DialogHeader>
          <Form {...srForm}>
            <form onSubmit={srForm.handleSubmit(onCreateSubRental)} className="space-y-4">
              <FormField
                control={srForm.control}
                name="vendorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Gear House Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={srForm.control}
                  name="vendorContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={srForm.control}
                  name="vendorEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" value={field.value ?? ""} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={srForm.control}
                  name="startAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={srForm.control}
                  name="endAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSrDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add line item dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add line item</DialogTitle>
          </DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(onAddItem)} className="space-y-4">
              <FormField
                control={itemForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 4× L-Acoustics K1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="unitRateAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit rate (cents) *</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="rateType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="DAILY">Daily</SelectItem>
                          <SelectItem value="WEEKLY">Weekly</SelectItem>
                          <SelectItem value="FLAT">Flat</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="rateDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Days</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Adding…" : "Add item"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
