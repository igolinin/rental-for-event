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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { projectExpenseSchema, type ProjectExpenseFormValues } from "@/schemas/projects";
import { addProjectExpense, deleteProjectExpense } from "@/server/actions/projects";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import type { ProjectDetail } from "@/server/queries/projects";
import { formatDate } from "@/lib/utils";

type Expense = NonNullable<ProjectDetail>["expenses"][number];

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

const EXPENSE_CATEGORIES = [
  "FUEL", "ACCOMMODATION", "CATERING", "TRANSPORT", "SUPPLIES", "EQUIPMENT_REPAIR", "OTHER",
];

interface ExpensesClientProps {
  projectId: string;
  expenses: Expense[];
  projectCurrency: string;
}

export function ExpensesClient({ projectId, expenses, projectCurrency }: ExpensesClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<ProjectExpenseFormValues>({
    resolver: zodResolver(projectExpenseSchema),
    defaultValues: {
      description: "",
      category: "OTHER",
      amount: 0,
      currency: projectCurrency,
      date: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });

  async function onSubmit(values: ProjectExpenseFormValues) {
    setIsPending(true);
    try {
      const result = await addProjectExpense(projectId, values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error adding expense" });
        return;
      }
      toast({ title: "Expense added" });
      setDialogOpen(false);
      form.reset();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(expenseId: string) {
    await deleteProjectExpense(expenseId, projectId);
    toast({ title: "Expense deleted" });
    router.refresh();
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add expense
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                  No expenses added.
                </TableCell>
              </TableRow>
            )}
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-sm">{e.description}</TableCell>
                <TableCell className="text-sm">{e.category.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-sm">{formatDate(e.date)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm font-medium">
                  {formatCents(e.amount, e.currency)}
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete expense?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(e.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {expenses.length > 0 && (
        <div className="mt-2 text-right text-sm font-semibold text-slate-700">
          Total expenses: {formatCents(total, projectCurrency)}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add project expense</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Diesel for truck" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Amount (cents) *</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Adding…" : "Add expense"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
