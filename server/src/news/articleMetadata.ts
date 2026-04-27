import type { NewsProviderId, NormalizedArticle } from "./types";

/**
 * Shape persisted under `messages[].metadata.articles`.
 * Rows match the synthesis bundle for that turn, built via `buildNewsAssistantMessageMetadata` from
 * the same `NormalizedArticle[]` passed to the summarizer — not an unfiltered cascade dump.
 */
export type ArticleMetadataRow = {
  title: string;
  url: string;
  abstract: string;
  source?: string;
  providerId: string;
};

const ABSTRACT_MAX = 500;

const PROVIDER_IDS: ReadonlySet<string> = new Set<NewsProviderId>([
  "newsdata",
  "thenewsapi",
  "gnews",
]);

function isNewsProviderId(s: string): s is NewsProviderId {
  return PROVIDER_IDS.has(s);
}

export function articlesToMetadataRows(articles: NormalizedArticle[]): ArticleMetadataRow[] {
  return articles.map((a) => ({
    title: a.title,
    url: a.url,
    abstract: a.excerpt.slice(0, ABSTRACT_MAX),
    ...(a.sourceName != null ? { source: a.sourceName } : {}),
    providerId: a.providerId,
  }));
}

/**
 * Reconstructs `NormalizedArticle[]` for follow-up LLM turns from persisted metadata.
 * `referenceDateYmd` is the calendar day stored on the message (no per-article time in JSON).
 */
export function metadataRowsToNormalized(
  rows: ArticleMetadataRow[],
  referenceDateYmd: string,
): NormalizedArticle[] {
  const publishedAt = new Date(`${referenceDateYmd}T12:00:00.000Z`);
  return rows
    .filter(
      (r) =>
        typeof r.title === "string" &&
        r.title.length > 0 &&
        typeof r.url === "string" &&
        r.url.length > 0 &&
        typeof r.abstract === "string" &&
        isNewsProviderId(r.providerId),
    )
    .map(
      (r): NormalizedArticle => ({
        title: r.title,
        url: r.url,
        excerpt: r.abstract,
        ...(r.source != null && r.source.length > 0 ? { sourceName: r.source } : {}),
        providerId: r.providerId as NewsProviderId,
        publishedAt,
      }),
    );
}
