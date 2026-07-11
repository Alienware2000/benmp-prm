// Manual live check of the Gemini API key + model (not part of the test gate).
// Run: node --env-file=.env.local scripts/gemini-smoke.mjs
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!key) {
  console.error("GOOGLE_GENERATIVE_AI_API_KEY not set (put it in .env.local).");
  process.exit(1);
}
const modelId = process.env.BENMP_POC_MODEL ?? "gemini-2.5-flash";
const google = createGoogleGenerativeAI({ apiKey: key });

try {
  const { text } = await generateText({
    model: google(modelId),
    prompt: "Reply with exactly: POC OK",
    temperature: 0,
  });
  console.log("model:", modelId);
  console.log("response:", JSON.stringify(text));
} catch (err) {
  console.log("model:", modelId);
  console.log("ERROR name:", err?.name);
  console.log("ERROR message:", err?.message);
  console.log("statusCode:", err?.statusCode ?? err?.cause?.statusCode);
  const body = err?.responseBody ?? err?.cause?.responseBody ?? err?.data;
  if (body) console.log("body:", String(body).slice(0, 500));
}
