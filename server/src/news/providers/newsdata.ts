import { normalizeProviderSearchQuery } from "../newsSearchNormalize";
import { NewsProviderError, type FetchArticlesParams, type NewsProvider } from "../provider";
import type { NormalizedArticle } from "../types";

const PROVIDER_ID = "newsdata" as const;
/** Latest endpoint for free tier; archive is paid-only. */
const LATEST_URL = "https://newsdata.io/api/1/latest";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_Q_LEN = 500;
/** NewsData caps page size; keep a single page for the cascade. */
const PAGE_SIZE = 10;

type NewsdataApiResponse = {
  status?: string;
  totalResults?: number;
  results?: NewsdataArticleRow[];
};

type NewsdataArticleRow = {
  title?: string;
  link?: string;
  description?: string;
  content?: string;
  pubDate?: string;
  source_name?: string;
  source_id?: string;
};

function mapRow(row: NewsdataArticleRow): NormalizedArticle | null {
  const title = String(row.title ?? "").trim();
  const url = String(row.link ?? "").trim();
  if (!title || !url) return null;

  const pubRaw = row.pubDate;
  const publishedAt = pubRaw ? new Date(pubRaw) : new Date(NaN);
  if (Number.isNaN(publishedAt.getTime())) return null;

  const text = String(row.description ?? row.content ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const excerpt = text.slice(0, 2000);

  const sourceNameRaw = row.source_name ?? row.source_id;
  const sourceName =
    sourceNameRaw != null && String(sourceNameRaw).trim() !== ""
      ? String(sourceNameRaw).trim()
      : undefined;

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

/** Best-effort detail from NewsData JSON error bodies (`code` + `message`, etc.). */
function newsdataHttpDetail(body: unknown, httpStatus: number): string {
  if (body != null && typeof body === "object") {
    const o = body as Record<string, unknown>;
    const msg = typeof o.message === "string" ? o.message.trim() : "";
    const code = typeof o.code === "string" ? o.code.trim() : "";
    const st = typeof o.status === "string" ? o.status.trim() : "";
    const bits = [
      code && `code=${code}`,
      msg,
      st && st !== "success" && `status=${st}`,
    ].filter(Boolean) as string[];
    if (bits.length > 0) {
      return `${bits.join(" — ")} (HTTP ${httpStatus})`;
    }
  }
  try {
    const s = JSON.stringify(body);
    if (s.length > 2) return `${s.length > 500 ? `${s.slice(0, 500)}…` : s} (HTTP ${httpStatus})`;
  } catch {
    /* ignore */
  }
  return `NewsData HTTP ${httpStatus}`;
}

/**
 * NewsData.io `/api/1/latest` — “breaking” window (docs: up to past 48h; free tier may delay).
 * Do not send `from_date` / `to_date` here (422 / wrong endpoint). Do not send `timeframe` unless
 * we know the key’s plan supports it — it has triggered HTTP 422 on some free keys.
 * Calendar-day filtering stays in `filterByUtcCalendarDay` after fetch.
 * @see https://newsdata.io/blog/latest-news-endpoint/
 */
export function createNewsdataProvider(apiKey: string): NewsProvider {
  const key = apiKey.trim();
  if (!key) {
    throw new NewsProviderError("NewsData API key is empty", {
      providerId: PROVIDER_ID,
      code: "CONFIG",
    });
  }

  return {
    id: PROVIDER_ID,

    async fetchArticles(params: FetchArticlesParams): Promise<NormalizedArticle[]> {
      const { message } = params;
      const q = normalizeProviderSearchQuery(message).slice(0, MAX_Q_LEN);

      const doFetch = async (requestUrl: string): Promise<{ res: Response; body: unknown }> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(requestUrl, {
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
          throw new NewsProviderError("Invalid JSON from NewsData", {
            providerId: PROVIDER_ID,
            code: "PARSE",
            httpStatus: res.status,
          });
        }
        return { res, body };
      };

      const primary = new URL(LATEST_URL);
      primary.searchParams.set("apikey", key);
      primary.searchParams.set("size", String(PAGE_SIZE));
      if (q.length > 0) {
        primary.searchParams.set("q", q);
      }

      let { res, body } = await doFetch(primary.toString());

      if (!res.ok && res.status === 422) {
        const fallback = new URL(LATEST_URL);
        fallback.searchParams.set("apikey", key);
        if (q.length > 0) {
          fallback.searchParams.set("q", q);
        }
        ({ res, body } = await doFetch(fallback.toString()));
      }

      if (!res.ok) {
        const detail = newsdataHttpDetail(body, res.status);
        throw new NewsProviderError(detail, {
          providerId: PROVIDER_ID,
          code: classifyHttpError(res.status),
          httpStatus: res.status,
        });
      }

      const parsed = body as NewsdataApiResponse;
      if (parsed.status != null && parsed.status !== "success") {
        const hint =
          typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : parsed.status;
        throw new NewsProviderError(`NewsData status: ${hint}`, {
          providerId: PROVIDER_ID,
          code: "HTTP",
          httpStatus: res.status,
        });
      }

      const rows = parsed.results ?? [];
      const out: NormalizedArticle[] = [];
      for (const row of rows) {
        const article = mapRow(row);
        if (article) out.push(article);
      }
      return out;
    },
  };
}
