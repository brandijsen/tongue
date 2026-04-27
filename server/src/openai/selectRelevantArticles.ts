import { z } from "zod";
import type { FetchArticlesParams } from "../news/provider";
import type { NormalizedArticle } from "../news/types";
import { articlesTraceRows, newsTrace } from "../news/traceLog";
import { getOpenAIChatModel, getOpenAIClient } from "./client";

const responseSchema = z.object({
  indices: z.array(z.number().int()),
});

function buildNumberedCorpus(articles: NormalizedArticle[]): string {
  const lines: string[] = [];
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const ex = a.excerpt.replace(/\s+/g, " ").trim().slice(0, 280);
    lines.push(
      `#${i + 1} title: ${a.title}\n   url: ${a.url}\n   excerpt: ${ex}`,
    );
  }
  return lines.join("\n\n");
}

/**
 * LLM picks which numbered candidates are *relevant* to the user message.
 * Returns articles in **relevance order** (best first), at most `maxCount`.
 */
export async function selectRelevantArticlesWithLLM(
  candidates: NormalizedArticle[],
  params: FetchArticlesParams,
  maxCount: number,
  afterProviderLabel = "pool",
): Promise<NormalizedArticle[]> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (candidates.length === 0) return [];

  const n = candidates.length;
  newsTrace("selector:llm-request", {
    afterProvider: afterProviderLabel,
    candidateCount: n,
    maxCount,
    model: getOpenAIChatModel(),
    userRequestPreview: params.message.slice(0, 100),
    date: params.date,
  });
  const system = [
    "You are a news relevance filter for project Tongue.",
    "Given a user request (any language; Italian is common) and numbered candidate articles,",
    `return strict JSON: {"indices":[...]} — a list of integers (1-based article positions) that are substantively relevant to the user's topic.`,
    "If the request is broad (e.g. general news for that day), keep the most newsworthy items for that scope.",
    "Order indices from most to least relevant. No duplicate indices.",
    `Include at most ${maxCount} indices. Only values between 1 and ${n} inclusive.`,
    'If none qualify, return {"indices":[]}.',
    "Do not invent article numbers; only use 1.." + String(n) + ".",
  ].join(" ");

  const user = [
    `User request: ${params.message}`,
    `Calendar day (UTC, YYYY-MM-DD): ${params.date}`,
    "",
    "Candidates:",
    buildNumberedCorpus(candidates),
  ].join("\n");

  const completion = await client.chat.completions.create({
    model: getOpenAIChatModel(),
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("Empty selector response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Selector response is not valid JSON");
  }

  const { indices } = responseSchema.parse(parsed);
  newsTrace("selector:llm-raw-indices", {
    afterProvider: afterProviderLabel,
    indicesFromModel: indices,
    candidateCount: n,
  });

  const seen = new Set<number>();
  const out: NormalizedArticle[] = [];
  const resolvedIndices: number[] = [];
  let skippedOutOfRange = 0;
  let skippedDuplicate = 0;

  for (const idx of indices) {
    if (idx < 1 || idx > n) {
      skippedOutOfRange++;
      continue;
    }
    if (seen.has(idx)) {
      skippedDuplicate++;
      continue;
    }
    seen.add(idx);
    const article = candidates[idx - 1];
    if (article) {
      out.push(article);
      resolvedIndices.push(idx);
    }
    if (out.length >= maxCount) break;
  }

  newsTrace("selector:llm-result", {
    afterProvider: afterProviderLabel,
    selectedCount: out.length,
    skippedOutOfRange,
    skippedDuplicate,
    selectedIndicesResolved: resolvedIndices,
    titles: out.map((a) => a.title.slice(0, 72)),
  });

  const selectedSet = new Set(resolvedIndices);
  const notSelected = candidates
    .map((article, i) => ({ poolIndex: i + 1, article }))
    .filter(({ poolIndex }) => !selectedSet.has(poolIndex));
  if (notSelected.length > 0) {
    newsTrace("selector:articles-not-selected-by-llm", {
      afterProvider: afterProviderLabel,
      userRequestPreview: params.message.slice(0, 100),
      count: notSelected.length,
      articles: notSelected.map(({ poolIndex, article }) => ({
        poolIndex,
        ...articlesTraceRows([article])[0],
      })),
    });
  }

  return out;
}
