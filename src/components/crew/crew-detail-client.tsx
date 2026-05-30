"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ChevronLeft, Pencil, Plus, Trash2, CheckCircle, XCircle, DollarSign } from "lucide-react";
import { crewRateSchema, crewExpenseSchema, type CrewRateFormValues, type CrewExpenseFormValues } from "@/schemas/crew";
import { addCrewRate, deleteCrewRate, createCrewExpense, updateCrewExpenseStatus } from "@/server/actions/crew";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import type { CrewMemberDetail } from "@/server/queries/crew";
import { formatDate } from "@/lib/utils";

const RATE_TYPES = ["REGULAR", "OVERTIME", "DOUBLE_TIME", "TRAVEL_DAY", "PER_DIEM"] as const;

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

const expenseStatusBadge: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED: { label: "Approved", className: "bg-blue-50 text-blue-700 border-blue-200" },
  REIMBURSED: { label: "Reimbursed", className: "bg-green-50 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-600 border-red-200" },
};

const timesheetStatusBadge: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-green-50 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-600 border-red-200" },
};

interface CrewDetailClientProps {
  member: NonNullable<CrewMemberDetail>;
}

export function CrewDetailClient({ member }: CrewDetailClientProps) {
  const router = useRouter();
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const expenseForm = useForm<CrewExpenseFormValues>({
    resolver: zodResolver(crewExpenseSchema),
    defaultValues: {
      crewMemberId: member.id,
      description: "",
      amount: 0,
      currency: "USD",
      date: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });

  async function onAddExpense(values: CrewExpenseFormValues) {
    setIsPending(true);
    try {
      const result = await createCrewExpense(values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error adding expense" });
        return;
      }
      toast({ title: "Expense added" });
      setExpenseDialogOpen(false);
      expenseForm.reset({ crewMemberId: member.id, currency: "USD", date: new Date().toISOString().slice(0, 10) });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleExpenseStatus(expenseId: string, status: "APPROVED" | "REIMBURSED" | "REJECTED") {
    await updateCrewExpenseStatus(expenseId, status);
    toast({ title: `Expense ${status.toLowerCase()}` });
    router.refresh();
  }

  const rateForm = useForm<CrewRateFormValues>({
    resolver: zodResolver(crewRateSchema),
    defaultValues: {
      rateType: "REGULAR",
      amount: 0,
      currency: "USD",
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: "",
    },
  });

  async function onAddRate(values: CrewRateFormValues) {
    setIsPending(true);
    try {
      const result = await addCrewRate(member.id, values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error adding rate" });
        return;
      }
      toast({ title: "Rate added" });
      setRateDialogOpen(false);
      rateForm.reset();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeleteRate(rateId: string) {
    await deleteCrewRate(rateId, member.id);
    toast({ title: "Rate deleted" });
    router.refresh();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/crew">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {member.firstName} {member.lastName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-muted-foreground">{member.refCode}</span>
              <Badge variant="outline" className="text-xs">
                {member.type}
              </Badge>
              {member.role && (
                <span className="text-sm text-muted-foreground">{member.role}</span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/crew/${member.id}/edit`}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Contact card */}
      <div className="max-w-xl rounded-lg border bg-white p-5 mb-6 grid grid-cols-2 gap-4 text-sm">
        {[
          { label: "Email", value: member.email },
          { label: "Phone", value: member.phone },
          { label: "Tax ID", value: member.taxId },
          { label: "Emergency", value: member.emergencyContact },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="mt-0.5">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="rates">
        <TabsList>
          <TabsTrigger value="rates">Rates ({member.rates.length})</TabsTrigger>
          <TabsTrigger value="assignments">Assignments ({member.assignments.length})</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets ({member.timesheets.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({member.expenses.length})</TabsTrigger>
        </TabsList>

        {/* Rates */}
        <TabsContent value="rates" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setRateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add rate
            </Button>
          </div>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount / hr</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Effective from</TableHead>
                  <TableHead>Effective to</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {member.rates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                      No rates configured.
                    </TableCell>
                  </TableRow>
                )}
                {member.rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium text-sm">{rate.rateType.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatCents(rate.amount, rate.currency)}
                    </TableCell>
                    <TableCell className="text-sm">{rate.currency}</TableCell>
                    <TableCell className="text-sm">{formatDate(rate.effectiveFrom)}</TableCell>
                    <TableCell className="text-sm">{rate.effectiveTo ? formatDate(rate.effectiveTo) : "—"}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete rate?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteRate(rate.id)}>
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
        </TabsContent>

        {/* Assignments */}
        <TabsContent value="assignments" className="mt-4">
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {member.assignments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                      No assignments.
                    </TableCell>
                  </TableRow>
                )}
                {member.assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/projects/${a.project.id}`}
                        className="font-medium text-slate-900 hover:underline text-sm"
                      >
                        {a.project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{a.role ?? "—"}</TableCell>
                    <TableCell className="text-sm">{formatDate(a.startAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(a.endAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Timesheets */}
        <TabsContent value="timesheets" className="mt-4">
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Clock-in</TableHead>
                  <TableHead>Clock-out</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {member.timesheets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                      No timesheets.
                    </TableCell>
                  </TableRow>
                )}
                {member.timesheets.map((ts) => {
                  const badge = timesheetStatusBadge[ts.status];
                  return (
                    <TableRow key={ts.id}>
                      <TableCell className="text-sm font-medium">
                        {ts.project.name}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(ts.clockIn)}</TableCell>
                      <TableCell className="text-sm">
                        {ts.clockOut ? formatDate(ts.clockOut) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{ts.timeType}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {ts.totalAmount != null
                          ? formatCents(ts.totalAmount, ts.currency)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setExpenseDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add expense
            </Button>
          </div>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {member.expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                      No expenses.
                    </TableCell>
                  </TableRow>
                )}
                {member.expenses.map((exp) => {
                  const badge = expenseStatusBadge[exp.status];
                  return (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm">{formatDate(exp.date)}</TableCell>
                      <TableCell className="text-sm font-medium">{exp.description}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCents(exp.amount, exp.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {exp.status === "PENDING" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Approve"
                                onClick={() => handleExpenseStatus(exp.id, "APPROVED")}
                              >
                                <CheckCircle className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reject"
                                onClick={() => handleExpenseStatus(exp.id, "REJECTED")}
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {exp.status === "APPROVED" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Mark reimbursed"
                              onClick={() => handleExpenseStatus(exp.id, "REIMBURSED")}
                            >
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Expense form dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
          </DialogHeader>
          <Form {...expenseForm}>
            <form onSubmit={expenseForm.handleSubmit(onAddExpense)} className="space-y-4">
              <FormField
                control={expenseForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={expenseForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (cents) *</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={expenseForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl><Input maxLength={3} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={expenseForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={expenseForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea rows={2} value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setExpenseDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Adding…" : "Add expense"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Rate form dialog */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add rate</DialogTitle>
          </DialogHeader>
          <Form {...rateForm}>
            <form onSubmit={rateForm.handleSubmit(onAddRate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={rateForm.control}
                  name="rateType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {RATE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={rateForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (cents/hr) *</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={rateForm.control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective from *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={rateForm.control}
                  name="effectiveTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective to</FormLabel>
                      <FormControl>
                        <Input type="date" value={field.value ?? ""} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRateDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Adding…" : "Add rate"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
