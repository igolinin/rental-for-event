"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, KeyRound } from "lucide-react";
import { createUser, updateUser, resetUserPassword } from "@/server/actions/users";
import { toast } from "@/hooks/use-toast";
import type { UserListEntry } from "@/server/queries/users";
import { formatDate } from "@/lib/utils";

const ROLES = ["ADMIN", "MANAGER", "STAFF", "VIEWER"] as const;

const roleBadge: Record<string, { label: string; className: string }> = {
  ADMIN: { label: "Admin", className: "bg-purple-50 text-purple-700 border-purple-200" },
  MANAGER: { label: "Manager", className: "bg-blue-50 text-blue-700 border-blue-200" },
  STAFF: { label: "Staff", className: "bg-slate-100 text-slate-600 border-slate-200" },
  VIEWER: { label: "Viewer", className: "bg-slate-50 text-slate-500 border-slate-200" },
};

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "At least 8 characters"),
  role: z.enum(ROLES).default("STAFF"),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(ROLES),
  isActive: z.boolean(),
});

interface UsersClientProps {
  users: UserListEntry[];
}

export function UsersClient({ users }: UsersClientProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListEntry | null>(null);
  const [resetUser, setResetUser] = useState<UserListEntry | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", password: "", role: "STAFF" },
  });

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
  });

  async function onCreateSubmit(values: z.infer<typeof createSchema>) {
    setIsPending(true);
    try {
      const result = await createUser(values);
      if ("error" in result && result.error) {
        const msg = typeof result.error === "string" ? result.error : "Error creating user";
        toast({ variant: "destructive", title: msg });
        return;
      }
      toast({ title: "User created" });
      setCreateOpen(false);
      createForm.reset();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  function openEdit(user: UserListEntry) {
    setEditUser(user);
    editForm.reset({ name: user.name, role: user.role, isActive: user.isActive });
  }

  async function onEditSubmit(values: z.infer<typeof editSchema>) {
    if (!editUser) return;
    setIsPending(true);
    try {
      const result = await updateUser(editUser.id, values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: typeof result.error === "string" ? result.error : "Error updating user" });
        return;
      }
      toast({ title: "User updated" });
      setEditUser(null);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function onResetPassword() {
    if (!resetUser || newPassword.length < 8) return;
    setIsPending(true);
    try {
      const result = await resetUserPassword(resetUser.id, newPassword);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: String(result.error) });
        return;
      }
      toast({ title: "Password reset successfully" });
      setResetUser(null);
      setNewPassword("");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage user accounts and roles</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add user
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => {
              const rb = roleBadge[user.role];
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-sm">{user.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={rb.className}>
                      {rb.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <span className="text-xs font-medium text-green-700">Active</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reset password"
                        onClick={() => { setResetUser(user); setNewPassword(""); }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField control={createForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={createForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password *</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={createForm.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>{isPending ? "Creating…" : "Create user"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit user — {editUser?.name}</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Active</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save changes"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetUser} onOpenChange={(o) => { if (!o) setResetUser(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reset password — {resetUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancel</Button>
            <Button onClick={onResetPassword} disabled={isPending || newPassword.length < 8}>
              {isPending ? "Saving…" : "Reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
