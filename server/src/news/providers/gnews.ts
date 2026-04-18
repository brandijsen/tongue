import { normalizeProviderSearchQuery } from "../newsSearchNormalize";
import { NewsProviderError, type FetchArticlesParams, type NewsProvider } from "../provider";
import type { NormalizedArticle } from "../types";

const PROVIDER_ID = "gnews" as const;
const SEARCH_URL = "https://gnews.io/api/v4/search";
const FETCH_TIMEOUT_MS = 15_000;
/** GNews `q` max length per documentation. */
const MAX_Q_LEN = 200;
const PAGE_MAX = 10;

type GnewsSource = {
  name?: string;
  url?: string;
  id?: string;
};

type GnewsArticleRow = {
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  publishedAt?: string;
  source?: GnewsSource;
};

type GnewsResponse = {
  articles?: GnewsArticleRow[];
  totalArticles?: number;
  errors?: unknown;
};

function dayBoundsUtc(ymd: string): { from: string; to: string } {
  return {
    from: `${ymd}T00:00:00.000Z`,
    to: `${ymd}T23:59:59.999Z`,
  };
}

function buildQuery(message: string): string {
  const q = normalizeProviderSearchQuery(message).slice(0, MAX_Q_LEN);
  return q.length > 0 ? q : "news";
}

function mapRow(row: GnewsArticleRow): NormalizedArticle | null {
  const title = String(row.title ?? "").trim();
  const url = String(row.url ?? "").trim();
  if (!title || !url) return null;

  const pubRaw = row.publishedAt;
  const publishedAt = pubRaw ? new Date(pubRaw) : new Date(NaN);
  if (Number.isNaN(publishedAt.getTime())) return null;

  const desc = String(row.description ?? "").replace(/\s+/g, " ").trim();
  const content = String(row.content ?? "").replace(/\s+/g, " ").trim();
  const excerptBase = [desc, content].filter(Boolean).join(" — ").trim();
  const excerpt = (excerptBase || title).slice(0, 2000);

  const nameRaw = row.source?.name;
  const sourceName =
    nameRaw != null && String(nameRaw).trim() !== "" ? String(nameRaw).trim() : undefined;

  return {
    title,
    url,
    publishedAt,
    excerpt,
    sourceName,
    providerId: PROVIDER_ID,
  };
}

function classifyHttpError(status: number): NewsProviderError["code"] {
  if (status === 429) return "QUOTA";
  if (status === 401 || status === 403) return "CONFIG";
  return "HTTP";
}

/**
 * GNews search API (`q` required by provider; uses user `message`, clipped to 200 chars).
 * `from` / `to` narrow to the requested calendar day (UTC bounds).
 * @see https://docs.gnews.io/endpoints/search-endpoint
 */
export function createGnewsProvider(apiKey: string): NewsProvider {
  const key = apiKey.trim();
  if (!key) {
    throw new NewsProviderError("GNews API key is empty", {
      providerId: PROVIDER_ID,
      code: "CONFIG",
    });
  }

  return {
    id: PROVIDER_ID,

    async fetchArticles(params: FetchArticlesParams): Promise<NormalizedArticle[]> {
      const { message, date } = params;
      const { from, to } = dayBoundsUtc(date);

      const url = new URL(SEARCH_URL);
      url.searchParams.set("apikey", key);
      url.searchParams.set("q", buildQuery(message));
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      url.searchParams.set("max", String(PAGE_MAX));
      url.searchParams.set("page", "1");
      url.searchParams.set("sortby", "publishedAt");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(url.toString(), {
          method: "GET",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error";
        throw new NewsProviderError(msg, {
          providerId: PROVIDER_ID,
          code: "HTTP",
        });
      } finally {
        clearTimeout(timeout);
      }

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new NewsProviderError("Invalid JSON from GNews", {
          providerId: PROVIDER_ID,
          code: "PARSE",
          httpStatus: res.status,
        });
      }

      const parsed = body as GnewsResponse;

      if (!res.ok) {
        throw new NewsProviderError(`GNews HTTP ${res.status}`, {
          providerId: PROVIDER_ID,
          code: classifyHttpError(res.status),
          httpStatus: res.status,
        });
      }

      if (parsed.errors != null) {
        throw new NewsProviderError("GNews returned errors in body", {
          providerId: PROVIDER_ID,
          code: "HTTP",
          httpStatus: res.status,
        });
      }

      const rows = parsed.articles ?? [];
      const out: NormalizedArticle[] = [];
      for (const row of rows) {
        const article = mapRow(row);
        if (article) out.push(article);
      }
      return out;
    },
  };
}
