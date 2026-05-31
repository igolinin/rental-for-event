"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface ImportError {
  row: number;
  message: string;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: ImportError[];
}

interface CsvImportExportProps {
  exportUrl: string;
  importUrl: string;
  entityLabel: string;      // "inventory" | "crew"
  templateHeaders: string;  // CSV header row for the template download
}

export function CsvImportExport({
  exportUrl,
  importUrl,
  entityLabel,
  templateHeaders,
}: CsvImportExportProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function downloadTemplate() {
    const blob = new Blob([templateHeaders + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entityLabel}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(importUrl, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: data.error ?? "Import failed" });
        return;
      }
      setResult(data);
      if (data.errors.length === 0) {
        toast({ title: `Import complete: ${data.created} created, ${data.updated} updated` });
        router.refresh();
      }
    } catch {
      toast({ variant: "destructive", title: "Network error during import" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex gap-2">
      {/* Export */}
      <a href={exportUrl} download>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </a>

      {/* Import */}
      <Button variant="outline" size="sm" onClick={() => { setResult(null); setImportOpen(true); }}>
        <Upload className="h-4 w-4 mr-1" />
        Import CSV
      </Button>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import {entityLabel} from CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file to bulk create or update {entityLabel} records.
              Existing records are matched by <code className="text-xs bg-slate-100 px-1 rounded">refCode</code>
              {entityLabel === "crew" && <> or <code className="text-xs bg-slate-100 px-1 rounded">email</code></>}.
              Max 500 rows per import.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Download template
              </Button>
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                {importing ? "Importing…" : "Choose CSV file"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Results */}
            {result && (
              <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span><strong>{result.created}</strong> created</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <span><strong>{result.updated}</strong> updated</span>
                  </div>
                  {result.errors.length > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                      {result.errors.length} errors
                    </Badge>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Row {err.row}:</strong> {err.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
