"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Star, Pencil, Check, X } from "lucide-react";
import {
  addInventoryImage,
  deleteInventoryImage,
  setPrimaryImage,
  updateImageCaption,
} from "@/server/actions/inventory";
import { toast } from "@/hooks/use-toast";
import type { ItemDetail } from "@/server/queries/inventory";

type ItemImage = NonNullable<ItemDetail>["images"][number];

interface ItemImagesClientProps {
  inventoryItemId: string;
  images: ItemImage[];
}

export function ItemImagesClient({ inventoryItemId, images }: ItemImagesClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/inventory-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast({ variant: "destructive", title: data.error ?? "Upload failed" });
        return;
      }
      const result = await addInventoryImage(inventoryItemId, data.url);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: String(result.error) });
        return;
      }
      toast({ title: "Image added" });
      router.refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(imageId: string) {
    const result = await deleteInventoryImage(imageId, inventoryItemId);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: String(result.error) });
      return;
    }
    toast({ title: "Image deleted" });
    router.refresh();
  }

  async function handleSetPrimary(imageId: string) {
    await setPrimaryImage(imageId, inventoryItemId);
    toast({ title: "Primary image updated" });
    router.refresh();
  }

  async function handleSaveCaption(imageId: string) {
    await updateImageCaption(imageId, inventoryItemId, captionDraft);
    setEditingCaption(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-1" />
          {uploading ? "Uploading…" : "Upload image"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {images.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-sm text-muted-foreground">No photos yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Upload JPEG, PNG, or WebP — max 5 MB each.</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((img) => (
          <div
            key={img.id}
            className={`relative group rounded-lg overflow-hidden border-2 bg-slate-100 ${
              img.isPrimary ? "border-blue-500" : "border-transparent"
            }`}
          >
            {/* Image */}
            <div className="aspect-square relative">
              <Image
                src={img.url}
                alt={img.caption ?? "Inventory image"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>

            {/* Primary badge */}
            {img.isPrimary && (
              <Badge className="absolute top-1.5 left-1.5 text-[10px] bg-blue-600 pointer-events-none">
                Primary
              </Badge>
            )}

            {/* Hover actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2 gap-1">
              {!img.isPrimary && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  title="Set as primary"
                  onClick={() => handleSetPrimary(img.id)}
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7"
                title="Edit caption"
                onClick={() => { setEditingCaption(img.id); setCaptionDraft(img.caption ?? ""); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" className="h-7 w-7">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete image?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(img.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Caption edit inline */}
            {editingCaption === img.id ? (
              <div className="flex gap-1 p-1.5 border-t bg-white">
                <Input
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  placeholder="Add caption…"
                  className="h-7 text-xs flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCaption(img.id);
                    if (e.key === "Escape") setEditingCaption(null);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveCaption(img.id)}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCaption(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : img.caption ? (
              <p className="px-2 py-1 text-xs text-muted-foreground truncate border-t bg-white">
                {img.caption}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
