/**
 * Gemini API wrapper for the POC (Decision 0008).
 *
 * A thin PocModelClient backed by the Google **AI Studio** Gemini API (not Vertex —
 * a fresh GCP project can't mint a JSON service-account key, and AI Studio needs only
 * a plain API key). Uses the Vercel AI SDK's Google provider; the key comes from
 * GOOGLE_GENERATIVE_AI_API_KEY (see .env.local, gitignored).
 *
 * Returns null when no key is set, so callers (src/lib/poc/ask.ts) transparently fall
 * back to the deterministic answerer. The model only phrases figures it is given.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import type { PocModelClient } from "../poc/ask";
import { pocModelId } from "./model-registry";

export type GeminiClientOptions = {
  apiKey?: string;
  modelId?: string;
};

/** Build a Gemini-backed PocModelClient, or null when no API key is available. */
export function createGeminiClient(opts: GeminiClientOptions = {}): PocModelClient | null {
  const apiKey = opts.apiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;

  const provider = createGoogleGenerativeAI({ apiKey });
  const modelId = opts.modelId ?? pocModelId();

  return {
    async generate(prompt: string): Promise<string> {
      const { text } = await generateText({
        model: provider(modelId),
        prompt,
        temperature: 0, // deterministic phrasing of grounded figures
      });
      return text.trim();
    },
  };
}
