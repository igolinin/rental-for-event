/**
 * LLM provider abstraction for inventory item detail inference.
 *
 * Supports Claude (Anthropic), OpenAI GPT, and DeepSeek behind one interface.
 * Uses raw fetch against each provider's REST API to avoid three SDK deps.
 *
 * Vision support:
 *   - Claude:   image block (base64)
 *   - OpenAI:   image_url with base64 data URI
 *   - DeepSeek: text-only (no vision) — falls back to the text hint
 */

export type LLMProvider = "claude" | "openai" | "deepseek";

export interface ItemSuggestion {
  name: string;
  description: string;
  categoryHint: string;
  dailyRateHintCents: number | null;
  replacementCostHintCents: number | null;
  properties: { name: string; value: string }[];
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  claude: "claude-opus-4-8",
  openai: "gpt-4o",
  deepseek: "deepseek-chat",
};

const SYSTEM_PROMPT = `You are an expert in professional AV, lighting, video, and staging equipment.
Given an image and/or description of a piece of equipment, return ONLY valid JSON (no markdown, no prose) with exactly this shape:
{
  "name": "short product name, brand + model if identifiable",
  "description": "2-3 sentence technical description",
  "categoryHint": "one of: Audio, Lighting, Video/LED, Staging, Other",
  "dailyRateHintCents": integer cents for a typical daily rental rate, or null if unknown,
  "replacementCostHintCents": integer cents for replacement cost, or null if unknown,
  "properties": [ {"name": "Power", "value": "1200W"}, {"name": "Weight", "value": "23kg"} ]
}
Provide up to 8 of the most relevant technical specs in "properties". Use realistic estimates for the rates based on the equipment type and market value.`;

/** Strip markdown code fences and parse the first JSON object found. */
function parseSuggestion(raw: string): ItemSuggestion {
  let text = raw.trim();
  // Remove ```json ... ``` fences if present
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  // Extract the outermost JSON object
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI response did not contain JSON");
  const json = JSON.parse(text.slice(start, end + 1));

  return {
    name: String(json.name ?? ""),
    description: String(json.description ?? ""),
    categoryHint: String(json.categoryHint ?? "Other"),
    dailyRateHintCents: typeof json.dailyRateHintCents === "number" ? json.dailyRateHintCents : null,
    replacementCostHintCents: typeof json.replacementCostHintCents === "number" ? json.replacementCostHintCents : null,
    properties: Array.isArray(json.properties)
      ? json.properties
          .filter((p: unknown) => p && typeof p === "object")
          .map((p: { name?: unknown; value?: unknown }) => ({
            name: String(p.name ?? ""),
            value: String(p.value ?? ""),
          }))
          .filter((p: { name: string; value: string }) => p.name && p.value)
      : [],
  };
}

function userText(hint?: string): string {
  return hint?.trim()
    ? `Identify this equipment and fill in the details. Hint from the user: ${hint.trim()}`
    : "Identify this equipment from the image and fill in the details.";
}

// ─── Provider implementations ──────────────────────────────────────────────────

async function inferClaude(
  imageBase64: string | undefined,
  mimeType: string,
  hint: string | undefined,
  apiKey: string,
  model: string
): Promise<string> {
  const content: unknown[] = [];
  if (imageBase64) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: mimeType, data: imageBase64 },
    });
  }
  content.push({ type: "text", text: userText(hint) });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function inferOpenAICompatible(
  baseURL: string,
  imageBase64: string | undefined,
  mimeType: string,
  hint: string | undefined,
  apiKey: string,
  model: string,
  supportsVision: boolean
): Promise<string> {
  const userContent: unknown[] = [{ type: "text", text: userText(hint) }];
  if (imageBase64 && supportsVision) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    });
  }

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: supportsVision ? userContent : userText(hint) },
      ],
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function inferItemDetails(
  imageBase64: string | undefined,
  mimeType: string,
  textHint: string | undefined,
  provider: LLMProvider,
  apiKey: string,
  modelOverride?: string | null
): Promise<ItemSuggestion> {
  const model = modelOverride?.trim() || DEFAULT_MODELS[provider];

  let raw: string;
  if (provider === "claude") {
    raw = await inferClaude(imageBase64, mimeType, textHint, apiKey, model);
  } else if (provider === "openai") {
    raw = await inferOpenAICompatible("https://api.openai.com/v1", imageBase64, mimeType, textHint, apiKey, model, true);
  } else {
    // DeepSeek — OpenAI-compatible, text-only
    raw = await inferOpenAICompatible("https://api.deepseek.com/v1", undefined, mimeType, textHint, apiKey, model, false);
  }

  return parseSuggestion(raw);
}

/** Lightweight connectivity test — minimal text request, returns true on success. */
export async function testProvider(provider: LLMProvider, apiKey: string, modelOverride?: string | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const model = modelOverride?.trim() || DEFAULT_MODELS[provider];
    if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: "user", content: "ping" }] }),
      });
      return res.ok ? { ok: true } : { ok: false, error: `${res.status}: ${await res.text()}` };
    }
    const baseURL = provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com/v1";
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: "user", content: "ping" }] }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `${res.status}: ${await res.text()}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

export { DEFAULT_MODELS, parseSuggestion };
