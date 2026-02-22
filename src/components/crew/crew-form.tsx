"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { crewMemberSchema, type CrewMemberFormValues } from "@/schemas/crew";
import { createCrewMember, updateCrewMember } from "@/server/actions/crew";
import { toast } from "@/hooks/use-toast";

interface CrewFormProps {
  defaultValues?: Partial<CrewMemberFormValues>;
  crewId?: string;
}

export function CrewForm({ defaultValues, crewId }: CrewFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<CrewMemberFormValues>({
    resolver: zodResolver(crewMemberSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      type: "FREELANCER",
      role: "",
      taxId: "",
      emergencyContact: "",
      notes: "",
      isActive: true,
      ...defaultValues,
    },
  });

  async function onSubmit(values: CrewMemberFormValues) {
    setIsPending(true);
    try {
      const result = crewId
        ? await updateCrewMember(crewId, values)
        : await createCrewMember(values);

      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error saving crew member" });
        return;
      }

      toast({ title: crewId ? "Crew member updated" : "Crew member created" });

      if (!crewId && "id" in result && result.id) {
        router.push(`/dashboard/crew/${result.id}`);
      } else {
        router.push("/dashboard/crew");
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="FREELANCER">Freelancer</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role / specialty</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. FOH Engineer" value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
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
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="taxId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax ID</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="emergencyContact"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emergency contact</FormLabel>
                <FormControl>
                  <Input placeholder="Name & phone" value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea rows={3} value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : crewId ? "Save changes" : "Create crew member"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
