import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ALLOWED_NEWS_PROVIDER_IDS } from "./constants";
import type { FetchArticlesParams, NewsProvider } from "./provider";
import type { NewsProviderId, NormalizedArticle } from "./types";
import { filterByUtcCalendarDay } from "./utcCalendarDay";

type StoredRow = {
  title: string;
  url: string;
  publishedAt: string;
  excerpt: string;
  sourceName?: string;
  providerId: string;
};

function resolveFixturePath(): string {
  const nextToCompiled = join(__dirname, "fixtures", "mock-articles.json");
  if (existsSync(nextToCompiled)) return nextToCompiled;
  const fromSrc = join(__dirname, "..", "..", "src", "news", "fixtures", "mock-articles.json");
  if (existsSync(fromSrc)) return fromSrc;
  throw new Error(
    "mock-articles.json not found. After `npm run build`, it should live in dist/news/fixtures/.",
  );
}

function parseFixture(): NormalizedArticle[] {
  const filePath = resolveFixturePath();
  const raw = readFileSync(filePath, "utf8");
  const rows = JSON.parse(raw) as StoredRow[];
  const out: NormalizedArticle[] = [];
  for (const row of rows) {
    const pid = row.providerId as NewsProviderId;
    if (!ALLOWED_NEWS_PROVIDER_IDS.has(pid)) continue;
    const publishedAt = new Date(row.publishedAt);
    if (Number.isNaN(publishedAt.getTime())) continue;
    out.push({
      title: row.title,
      url: row.url,
      publishedAt,
      excerpt: row.excerpt,
      sourceName: row.sourceName,
      providerId: pid,
    });
  }
  return out;
}

let cache: NormalizedArticle[] | null = null;

function allFixtureArticles(): NormalizedArticle[] {
  cache ??= parseFixture();
  return cache;
}

/**
 * Articles from `fixtures/mock-articles.json` whose `publishedAt` falls on `params.date` (UTC day).
 * Enable with `USE_MOCK_NEWS=true` in the orchestrator (not wired to HTTP yet).
 */
export async function loadMockArticles(params: FetchArticlesParams): Promise<NormalizedArticle[]> {
  return filterByUtcCalendarDay(allFixtureArticles(), params.date);
}

/**
 * `NewsProvider` shim for tests / future cascade wiring. `id` is arbitrary; rows keep their own `providerId`.
 */
export function createMockNewsProvider(): NewsProvider {
  return {
    id: "newsdata",
    fetchArticles: (p) => loadMockArticles(p),
  };
}
