"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ItemSuggestion } from "@/lib/ai";

interface AiFillDialogProps {
  providerLabel: string;
  onFilled: (suggestion: ItemSuggestion) => void;
}

export function AiFillDialog({ providerLabel, onFilled }: AiFillDialogProps) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  function reset() {
    setHint("");
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    if (!file && !hint.trim()) {
      toast({ variant: "destructive", title: "Provide a photo or a description." });
      return;
    }
    setAnalyzing(true);
    try {
      const fd = new FormData();
      if (file) fd.append("image", file);
      if (hint.trim()) fd.append("hint", hint.trim());
      const res = await fetch("/api/ai/fill-item", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast({ variant: "destructive", title: data.error ?? "AI inference failed" });
        return;
      }
      onFilled(data.suggestion as ItemSuggestion);
      toast({ title: "Form pre-filled from AI — review before saving" });
      setOpen(false);
      reset();
    } catch {
      toast({ variant: "destructive", title: "Network error" });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4 mr-1 text-indigo-500" />
        AI fill
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              AI item fill
              <Badge variant="outline" className="text-xs font-normal">{providerLabel}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a photo of the equipment and/or describe it. The AI will suggest
              a name, description, category, rates, and specs for you to review.
            </p>

            {/* Image upload */}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-1" />
                {file ? file.name : "Choose photo (optional)"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview" className="mt-2 rounded-md max-h-40 object-contain mx-auto border" />
              )}
            </div>

            {/* Text hint */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Description / hint {!file && <span className="text-red-500">*</span>}
              </label>
              <Textarea
                rows={2}
                placeholder="e.g. Martin MAC Encore Performance moving head wash light"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? "Analyzing…" : "Analyze"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
