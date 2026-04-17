import { ARTICLE_EXCERPT_MAX_CHARS } from "../constants";
import type { NewsFetchParams, NormalizedArticle } from "../types";

/** Free/basic plans: historical Archive is often unavailable; Latest covers ~past 48h (see NewsData docs). */
const LATEST_URL = "https://newsdata.io/api/1/latest";
const FETCH_TIMEOUT_MS = 15_000;
const Q_MAX_LEN = 512;
/** Broad fetch when the user message is unlikely to match NewsData `q` keyword search. */
const FALLBACK_Q = "news";

type NewsDataArticle = {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  source_name?: string;
};

type NewsDataResponse = {
  status: string;
  results?: NewsDataArticle[] | { message?: string; code?: string };
  message?: string;
};

function truncateExcerpt(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function publishedAtIso(pubDate: string | undefined): string {
  if (!pubDate?.trim()) return new Date().toISOString();
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function extractArticleRows(data: NewsDataResponse): NewsDataArticle[] | null {
  const { results } = data;
  if (!Array.isArray(results)) return null;
  return results;
}

function mapRows(rows: NewsDataArticle[]): NormalizedArticle[] {
  const out: NormalizedArticle[] = [];
  for (const r of rows) {
    const title = r.title?.trim();
    const link = r.link?.trim();
    if (!title || !link) continue;
    const rawDesc = r.description?.trim() ?? "";
    out.push({
      title,
      url: link,
      publishedAt: publishedAtIso(r.pubDate),
      excerpt: truncateExcerpt(rawDesc || title, ARTICLE_EXCERPT_MAX_CHARS),
      sourceName: r.source_name?.trim() || undefined,
      providerId: "newsdata",
    });
  }
  return out;
}

/**
 * NewsData.io Latest API — PS2 adapter (default for free tier).
 * `date` in params is not sent to the API; the app filters by calendar day via filterByPublishWindow.
 * @see https://newsdata.io/documentation
 */
function buildLatestUrl(apiKey: string, q: string | null): string {
  const url = new URL(LATEST_URL);
  url.searchParams.set("apikey", apiKey);
  if (q != null && q.length > 0) {
    url.searchParams.set("q", q.slice(0, Q_MAX_LEN));
  }
  url.searchParams.set("language", "it,en");
  return url.toString();
}

async function fetchLatestOnce(url: string): Promise<{ ok: boolean; data: NewsDataResponse; status: number }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  const data = (await res.json()) as NewsDataResponse;
  return { ok: res.ok, data, status: res.status };
}

/**
 * NewsData `q` matches keywords in title/content. Long Italian chat lines often return 0 hits; we retry broader queries.
 */
export async function fetchNewsdataArticles(params: NewsFetchParams): Promise<NormalizedArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY?.trim();
  if (!apiKey) return [];

  const trimmed = params.message.trim().slice(0, Q_MAX_LEN);
  const attempts: (string | null)[] = [];
  if (trimmed.length > 0) {
    attempts.push(trimmed);
  }
  attempts.push(FALLBACK_Q);
  attempts.push(null);

  const tried = new Set<string>();
  try {
    for (const q of attempts) {
      const key = q === null ? "" : q;
      if (tried.has(key)) continue;
      tried.add(key);

      const url = buildLatestUrl(apiKey, q);
      const { ok, data, status } = await fetchLatestOnce(url);

      if (status === 429) {
        console.warn("[newsdata] rate limited (429)");
        return [];
      }

      if (!ok) {
        console.warn("[newsdata] HTTP", status, JSON.stringify(data).slice(0, 500));
        continue;
      }

      if (data.status !== "success") {
        if (data.message) console.warn("[newsdata]", data.message);
        continue;
      }

      const rows = extractArticleRows(data);
      if (!rows) {
        console.warn("[newsdata] unexpected results shape", JSON.stringify(data).slice(0, 300));
        continue;
      }

      const mapped = mapRows(rows);
      if (mapped.length > 0) {
        return mapped;
      }
    }
    return [];
  } catch (err) {
    console.warn("[newsdata] request failed:", err);
    return [];
  }
}
