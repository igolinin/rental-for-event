"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  createCategory,
  updateCategory,
  deleteCategory,
  createSubCategory,
  deleteSubCategory,
} from "@/server/actions/inventory";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import type { CategoryWithSubs } from "@/server/queries/inventory";

const catFormSchema = z.object({
  name: z.string().min(1, "Required"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Hex colour e.g. #3B82F6")
    .optional()
    .or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
});

const subCatFormSchema = z.object({
  name: z.string().min(1, "Required"),
});

interface CategoriesClientProps {
  categories: CategoryWithSubs[];
}

export function CategoriesClient({ categories }: CategoriesClientProps) {
  const router = useRouter();
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryWithSubs | null>(null);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subCatParentId, setSubCatParentId] = useState<string | null>(null);

  const catForm = useForm<z.infer<typeof catFormSchema>>({
    resolver: zodResolver(catFormSchema),
    defaultValues: { name: "", color: "", sortOrder: 0 },
  });

  const subCatForm = useForm<z.infer<typeof subCatFormSchema>>({
    resolver: zodResolver(subCatFormSchema),
    defaultValues: { name: "" },
  });

  function openNewCategory() {
    catForm.reset({ name: "", color: "", sortOrder: categories.length });
    setEditingCat(null);
    setCatDialogOpen(true);
  }

  function openEditCategory(cat: CategoryWithSubs) {
    catForm.reset({
      name: cat.name,
      color: cat.color ?? "",
      sortOrder: cat.sortOrder,
    });
    setEditingCat(cat);
    setCatDialogOpen(true);
  }

  async function onSaveCategory(values: z.infer<typeof catFormSchema>) {
    const result = editingCat
      ? await updateCategory(editingCat.id, values)
      : await createCategory(values);

    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: "Error saving category" });
      return;
    }
    toast({ title: editingCat ? "Category updated" : "Category created" });
    setCatDialogOpen(false);
    router.refresh();
  }

  async function onDeleteCategory(id: string) {
    const result = await deleteCategory(id);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: String(result.error) });
    } else {
      toast({ title: "Category deleted" });
      router.refresh();
    }
  }

  function openAddSubCategory(categoryId: string) {
    subCatForm.reset({ name: "" });
    setSubCatParentId(categoryId);
    setSubDialogOpen(true);
  }

  async function onSaveSubCategory(values: z.infer<typeof subCatFormSchema>) {
    if (!subCatParentId) return;
    const result = await createSubCategory({
      categoryId: subCatParentId,
      name: values.name,
    });
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: "Error saving sub-category" });
      return;
    }
    toast({ title: "Sub-category created" });
    setSubDialogOpen(false);
    router.refresh();
  }

  async function onDeleteSubCategory(id: string) {
    const result = await deleteSubCategory(id);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: String(result.error) });
    } else {
      toast({ title: "Sub-category deleted" });
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Button size="sm" onClick={openNewCategory}>
          <Plus className="h-4 w-4 mr-1" />
          Add category
        </Button>
      </div>

      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No categories yet. Add one to get started.
        </p>
      )}

      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-lg border bg-white">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {cat.color && (
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: cat.color }}
                  />
                )}
                <div>
                  <span className="font-medium">{cat.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {cat._count.items} item{cat._count.items !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openAddSubCategory(cat.id)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Sub-category
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditCategory(cat)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete category?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cannot delete a category that has items. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDeleteCategory(cat.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {cat.subCategories.length > 0 && (
              <div className="border-t px-4 pb-3 pt-2 space-y-1.5">
                {cat.subCategories.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between pl-4"
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="h-3 w-3" />
                      {sub.name}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete sub-category?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This cannot be undone. Sub-categories with items
                            cannot be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteSubCategory(sub.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Category form dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCat ? "Edit category" : "New category"}
            </DialogTitle>
          </DialogHeader>
          <Form {...catForm}>
            <form
              onSubmit={catForm.handleSubmit(onSaveCategory)}
              className="space-y-4"
            >
              <FormField
                control={catForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Audio" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={catForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Colour (hex)</FormLabel>
                    <FormControl>
                      <Input placeholder="#3B82F6" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={catForm.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort order</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCatDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingCat ? "Save changes" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Sub-category form dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add sub-category</DialogTitle>
          </DialogHeader>
          <Form {...subCatForm}>
            <form
              onSubmit={subCatForm.handleSubmit(onSaveSubCategory)}
              className="space-y-4"
            >
              <FormField
                control={subCatForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Microphones" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSubDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
