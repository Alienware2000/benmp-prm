import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the AI SDK so tests never hit the network.
type GenArgs = { prompt: string; model: { modelId: string }; temperature: number };
const generateText = vi.fn<(opts: GenArgs) => Promise<{ text: string }>>(
  async () => ({ text: "  225.50 cedis collected.  " }),
);
vi.mock("ai", () => ({ generateText: (opts: GenArgs) => generateText(opts) }));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => (id: string) => ({ modelId: id })),
}));

import { createGeminiClient } from "./gemini-client";

const ENV = "GOOGLE_GENERATIVE_AI_API_KEY";
let saved: string | undefined;

beforeEach(() => {
  saved = process.env[ENV];
  delete process.env[ENV];
  generateText.mockClear();
});
afterEach(() => {
  if (saved === undefined) delete process.env[ENV];
  else process.env[ENV] = saved;
});

describe("createGeminiClient", () => {
  it("returns null when no API key is available (caller falls back to deterministic)", () => {
    expect(createGeminiClient()).toBeNull();
  });

  it("reads the key from the environment", () => {
    process.env[ENV] = "AQ.testkey";
    expect(createGeminiClient()).not.toBeNull();
  });

  it("generates text via the SDK, trims it, and passes the prompt + model", async () => {
    const client = createGeminiClient({ apiKey: "AQ.testkey", modelId: "gemini-2.5-flash" })!;
    const out = await client.generate("How much did we collect?");
    expect(out).toBe("225.50 cedis collected."); // trimmed
    expect(generateText).toHaveBeenCalledTimes(1);
    const arg = generateText.mock.calls[0][0];
    expect(arg.prompt).toBe("How much did we collect?");
    expect(arg.model.modelId).toBe("gemini-2.5-flash");
    expect(arg.temperature).toBe(0);
  });
});
