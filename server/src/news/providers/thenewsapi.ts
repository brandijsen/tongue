import { normalizeProviderSearchQuery } from "../newsSearchNormalize";
import { NewsProviderError, type FetchArticlesParams, type NewsProvider } from "../provider";
import type { NormalizedArticle } from "../types";

const PROVIDER_ID = "thenewsapi" as const;
const ALL_NEWS_URL = "https://api.thenewsapi.com/v1/news/all";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_SEARCH_LEN = 500;
const PAGE_LIMIT = 10;

type ThenewsapiMeta = {
  found?: number;
  returned?: number;
  limit?: number;
  page?: number;
};

type ThenewsapiArticleRow = {
  uuid?: string;
  title?: string;
  description?: string;
  keywords?: string;
  snippet?: string;
  url?: string;
  published_at?: string;
  source?: string;
};

type ThenewsapiResponse = {
  meta?: ThenewsapiMeta;
  data?: ThenewsapiArticleRow[];
};

function mapRow(row: ThenewsapiArticleRow): NormalizedArticle | null {
  const title = String(row.title ?? "").trim();
  const url = String(row.url ?? "").trim();
  if (!title || !url) return null;

  const pubRaw = row.published_at;
  const publishedAt = pubRaw ? new Date(pubRaw) : new Date(NaN);
  if (Number.isNaN(publishedAt.getTime())) return null;

  const desc = String(row.description ?? "").replace(/\s+/g, " ").trim();
  const snip = String(row.snippet ?? "").replace(/\s+/g, " ").trim();
  const excerptBase = [desc, snip].filter(Boolean).join(" — ").trim();
  const excerpt = (excerptBase || title).slice(0, 2000);

  const sourceRaw = row.source;
  const sourceName =
    sourceRaw != null && String(sourceRaw).trim() !== "" ? String(sourceRaw).trim() : undefined;

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
 * TheNewsAPI — "All news" endpoint with `published_on` for calendar-day filtering.
 * @see https://www.thenewsapi.com/documentation
 */
export function createThenewsapiProvider(apiKey: string): NewsProvider {
  const key = apiKey.trim();
  if (!key) {
    throw new NewsProviderError("TheNewsAPI API token is empty", {
      providerId: PROVIDER_ID,
      code: "CONFIG",
    });
  }

  return {
    id: PROVIDER_ID,

    async fetchArticles(params: FetchArticlesParams): Promise<NormalizedArticle[]> {
      const { message, date } = params;
      const url = new URL(ALL_NEWS_URL);
      url.searchParams.set("api_token", key);
      url.searchParams.set("published_on", date);
      url.searchParams.set("limit", String(PAGE_LIMIT));
      url.searchParams.set("page", "1");

      const q = normalizeProviderSearchQuery(message).slice(0, MAX_SEARCH_LEN);
      if (q.length > 0) {
        url.searchParams.set("search", q);
      }

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
        throw new NewsProviderError("Invalid JSON from TheNewsAPI", {
          providerId: PROVIDER_ID,
          code: "PARSE",
          httpStatus: res.status,
        });
      }

      if (!res.ok) {
        throw new NewsProviderError(`TheNewsAPI HTTP ${res.status}`, {
          providerId: PROVIDER_ID,
          code: classifyHttpError(res.status),
          httpStatus: res.status,
        });
      }

      const parsed = body as ThenewsapiResponse & { errors?: unknown };
      if (parsed.errors != null) {
        throw new NewsProviderError("TheNewsAPI returned errors in body", {
          providerId: PROVIDER_ID,
          code: "HTTP",
          httpStatus: res.status,
        });
      }

      const rows = parsed.data ?? [];
      const out: NormalizedArticle[] = [];
      for (const row of rows) {
        const article = mapRow(row);
        if (article) out.push(article);
      }
      return out;
    },
  };
}
