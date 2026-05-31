"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, CheckCircle, XCircle } from "lucide-react";
import { upsertAiSettings, testAiConnection } from "@/server/actions/settings";
import { toast } from "@/hooks/use-toast";

const PROVIDER_LABELS: Record<string, { label: string; vision: boolean; model: string }> = {
  claude:   { label: "Claude (Anthropic)", vision: true,  model: "claude-opus-4-8" },
  openai:   { label: "OpenAI GPT-4o",       vision: true,  model: "gpt-4o" },
  deepseek: { label: "DeepSeek",            vision: false, model: "deepseek-chat" },
};

interface AiSettingsProps {
  current: {
    aiProvider: string | null;
    aiModel: string | null;
    hasApiKey: boolean;
  };
}

export function AiSettings({ current }: AiSettingsProps) {
  const router = useRouter();
  const [provider, setProvider] = useState(current.aiProvider ?? "");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(current.aiModel ?? "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const providerMeta = provider ? PROVIDER_LABELS[provider] : null;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await upsertAiSettings({ aiProvider: provider, aiApiKey: apiKey || undefined, aiModel: model || undefined });
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: typeof result.error === "string" ? result.error : "Error saving" });
        return;
      }
      toast({ title: "AI settings saved" });
      setApiKey("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!provider) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAiConnection(provider, model || undefined);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-indigo-500" />
        <h2 className="text-lg font-semibold text-slate-900">AI Item Inference</h2>
        {current.hasApiKey && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
            Configured
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Connect an LLM to auto-fill item details from a photo or description.
        Your API key is stored server-side and never sent to the browser.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Provider</label>
          <Select onValueChange={(v) => { setProvider(v); setTestResult(null); }} value={provider}>
            <SelectTrigger><SelectValue placeholder="Disabled" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Disabled</SelectItem>
              {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {providerMeta && !providerMeta.vision && (
            <p className="text-xs text-amber-600 mt-1">
              DeepSeek is text-only — photo analysis falls back to your text hint.
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Model <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            placeholder={providerMeta?.model ?? "default"}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          API key {current.hasApiKey && <span className="text-muted-foreground font-normal">(leave blank to keep existing)</span>}
        </label>
        <Input
          type="password"
          placeholder={current.hasApiKey ? "••••••••••••" : "Paste your API key"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      {testResult && (
        <div className={`flex items-center gap-2 text-sm rounded px-3 py-2 ${
          testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {testResult.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {testResult.ok ? "Connection successful" : `Failed: ${testResult.error}`}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save AI settings"}
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing || !provider || !current.hasApiKey}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
      </div>
    </div>
  );
}
