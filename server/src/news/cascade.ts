import type { NewsFetchParams, NormalizedArticle } from "./types";

const DEFAULT_ORDER = ["newsdata", "thenewsapi", "worldnewsapi"] as const;

function parseProviderOrder(): string[] {
  const raw = process.env.NEWS_PROVIDER_ORDER?.trim();
  if (!raw) return [...DEFAULT_ORDER];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function minArticlesBeforeNext(): number {
  const n = Number(process.env.MIN_ARTICLES_BEFORE_NEXT_PROVIDER);
  return Number.isFinite(n) && n > 0 ? n : 4;
}

function maxArticlesForPrompt(): number {
  const n = Number(process.env.MAX_ARTICLES_FOR_PROMPT);
  return Number.isFinite(n) && n > 0 ? n : 8;
}

function hasProviderApiKey(providerId: string): boolean {
  switch (providerId) {
    case "newsdata":
      return Boolean(process.env.NEWSDATA_API_KEY?.trim());
    case "thenewsapi":
      return Boolean(process.env.THENEWSAPI_KEY?.trim());
    case "worldnewsapi":
      return Boolean(process.env.WORLDNEWS_API_KEY?.trim());
    default:
      return false;
  }
}

function urlDedupKey(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return url;
  }
}

/** Real provider HTTP calls will plug in here (Fase 3 — next slices). */
async function fetchFromProvider(
  providerId: string,
  _params: NewsFetchParams,
): Promise<NormalizedArticle[]> {
  switch (providerId) {
    case "newsdata":
    case "thenewsapi":
    case "worldnewsapi":
      return [];
    default:
      return [];
  }
}

/**
 * PS2 cascade skeleton: order from env, skip without API key, dedup by URL, min/max thresholds.
 * Returns [] until adapters are implemented (expected in dev without keys).
 */
export async function runProviderCascade(params: NewsFetchParams): Promise<NormalizedArticle[]> {
  const order = parseProviderOrder();
  const acc: NormalizedArticle[] = [];
  const seen = new Set<string>();
  const max = maxArticlesForPrompt();
  const minBeforeNext = minArticlesBeforeNext();

  for (const id of order) {
    if (!id || acc.length >= max) break;
    if (!hasProviderApiKey(id)) continue;

    const batch = await fetchFromProvider(id, params);
    for (const a of batch) {
      const key = urlDedupKey(a.url);
      if (seen.has(key)) continue;
      seen.add(key);
      acc.push(a);
      if (acc.length >= max) break;
    }

    if (acc.length >= max) break;
    if (acc.length >= minBeforeNext) break;
  }

  return acc.slice(0, max);
}
