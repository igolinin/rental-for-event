import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseSuggestion, inferItemDetails, testProvider, DEFAULT_MODELS } from "@/lib/ai";

// ─── parseSuggestion ──────────────────────────────────────────────────────────

describe("parseSuggestion", () => {
  it("parses clean JSON", () => {
    const raw = JSON.stringify({
      name: "Shure SM58",
      description: "Dynamic vocal mic.",
      categoryHint: "Audio",
      dailyRateHintCents: 1500,
      replacementCostHintCents: 10000,
      properties: [{ name: "Type", value: "Dynamic" }],
    });
    const s = parseSuggestion(raw);
    expect(s.name).toBe("Shure SM58");
    expect(s.categoryHint).toBe("Audio");
    expect(s.dailyRateHintCents).toBe(1500);
    expect(s.properties).toEqual([{ name: "Type", value: "Dynamic" }]);
  });

  it("strips markdown code fences", () => {
    const raw = '```json\n{"name":"X","description":"d","categoryHint":"Audio","dailyRateHintCents":null,"replacementCostHintCents":null,"properties":[]}\n```';
    const s = parseSuggestion(raw);
    expect(s.name).toBe("X");
    expect(s.dailyRateHintCents).toBeNull();
  });

  it("extracts JSON embedded in prose", () => {
    const raw = 'Here is the result: {"name":"Y","description":"d","categoryHint":"Lighting","dailyRateHintCents":2000,"replacementCostHintCents":null,"properties":[]} hope it helps!';
    const s = parseSuggestion(raw);
    expect(s.name).toBe("Y");
    expect(s.categoryHint).toBe("Lighting");
  });

  it("defaults categoryHint to Other when missing", () => {
    const s = parseSuggestion('{"name":"Z","description":"d"}');
    expect(s.categoryHint).toBe("Other");
  });

  it("coerces non-number rate hints to null", () => {
    const s = parseSuggestion('{"name":"A","dailyRateHintCents":"lots","replacementCostHintCents":50}');
    expect(s.dailyRateHintCents).toBeNull();
    expect(s.replacementCostHintCents).toBe(50);
  });

  it("filters out malformed properties", () => {
    const s = parseSuggestion('{"name":"A","properties":[{"name":"Power","value":"1kW"},{"name":"","value":"x"},{"bad":"obj"}]}');
    expect(s.properties).toEqual([{ name: "Power", value: "1kW" }]);
  });

  it("throws when no JSON present", () => {
    expect(() => parseSuggestion("sorry, I cannot help")).toThrow(/did not contain JSON/);
  });
});

// ─── inferItemDetails (mocked fetch) ──────────────────────────────────────────

describe("inferItemDetails", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const validJson = '{"name":"Test","description":"d","categoryHint":"Audio","dailyRateHintCents":100,"replacementCostHintCents":null,"properties":[]}';

  it("calls Anthropic endpoint for claude and parses content", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: validJson }] }),
    } as Response);

    const s = await inferItemDetails("base64data", "image/jpeg", "a mic", "claude", "sk-test");
    expect(s.name).toBe("Test");
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toContain("api.anthropic.com");
  });

  it("calls OpenAI endpoint for openai and parses content", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: validJson } }] }),
    } as Response);

    const s = await inferItemDetails(undefined, "image/jpeg", "a light", "openai", "sk-test");
    expect(s.name).toBe("Test");
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("api.openai.com");
  });

  it("calls DeepSeek endpoint for deepseek (text-only)", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: validJson } }] }),
    } as Response);

    const s = await inferItemDetails("ignored-image", "image/jpeg", "a cable", "deepseek", "sk-test");
    expect(s.name).toBe("Test");
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("api.deepseek.com");
  });

  it("throws on non-ok API response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid key",
    } as Response);

    await expect(
      inferItemDetails(undefined, "image/jpeg", "x", "claude", "bad-key")
    ).rejects.toThrow(/Claude API error 401/);
  });

  it("uses model override when provided", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: validJson }] }),
    } as Response);

    await inferItemDetails(undefined, "image/jpeg", "x", "claude", "sk", "claude-custom-model");
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.model).toBe("claude-custom-model");
  });

  it("falls back to default model when no override", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: validJson }] }),
    } as Response);

    await inferItemDetails(undefined, "image/jpeg", "x", "claude", "sk");
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.model).toBe(DEFAULT_MODELS.claude);
  });
});

// ─── testProvider ─────────────────────────────────────────────────────────────

describe("testProvider", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns ok:true on successful ping", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    expect(await testProvider("openai", "sk-test")).toEqual({ ok: true });
  });

  it("returns ok:false with error text on failure", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403, text: async () => "forbidden" } as Response);
    const result = await testProvider("claude", "bad");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("403");
  });

  it("catches network errors gracefully", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await testProvider("deepseek", "sk");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("ECONNREFUSED");
  });
});
