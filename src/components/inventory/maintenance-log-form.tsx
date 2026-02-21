"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  maintenanceLogSchema,
  type MaintenanceLogFormValues,
} from "@/schemas/inventory";
import { createMaintenanceLog } from "@/server/actions/inventory";
import { toast } from "@/hooks/use-toast";

interface MaintenanceLogFormDialogProps {
  inventoryItemId: string;
  serializedUnits?: Array<{ id: string; serialNumber: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MaintenanceLogFormDialog({
  inventoryItemId,
  serializedUnits = [],
  open,
  onOpenChange,
}: MaintenanceLogFormDialogProps) {
  const [isPending, setIsPending] = useState(false);

  const form = useForm<MaintenanceLogFormValues>({
    resolver: zodResolver(maintenanceLogSchema),
    defaultValues: {
      inventoryItemId,
      serializedUnitId: "",
      type: "REPAIR",
      description: "",
      status: "OPEN",
      reportedAt: new Date().toISOString().slice(0, 10),
      vendor: "",
      technicianName: "",
      costAmount: undefined,
      costCurrency: "USD",
      notes: "",
    },
  });

  async function onSubmit(values: MaintenanceLogFormValues) {
    setIsPending(true);
    try {
      const result = await createMaintenanceLog({
        ...values,
        serializedUnitId: values.serializedUnitId || null,
      });

      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error creating maintenance log" });
        return;
      }

      toast({ title: "Maintenance log created" });
      onOpenChange(false);
      form.reset();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log maintenance</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="REPAIR">Repair</SelectItem>
                        <SelectItem value="SCHEDULED_SERVICE">Scheduled service</SelectItem>
                        <SelectItem value="INSPECTION">Inspection</SelectItem>
                        <SelectItem value="CLEANING">Cleaning</SelectItem>
                        <SelectItem value="CALIBRATION">Calibration</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serializedUnits.length > 0 && (
                <FormField
                  control={form.control}
                  name="serializedUnitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit (optional)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="All units" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">All units</SelectItem>
                          {serializedUnits.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.serialNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reportedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reported date</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the issue or work to be done"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <Input placeholder="Repair vendor name" value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="technicianName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technician</FormLabel>
                    <FormControl>
                      <Input placeholder="Technician name" value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="costAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost (cents)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="e.g. 15000 = $150"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Create log"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
