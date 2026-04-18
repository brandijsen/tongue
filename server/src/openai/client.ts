import OpenAI from "openai";

let cached: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  cached ??= new OpenAI({ apiKey: key });
  return cached;
}

export function getOpenAIChatModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}
