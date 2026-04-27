/**
 * Internal data model after provider normalization.
 * Stable provider identifiers (aligned with `NEWS_PROVIDER_ORDER` / env).
 */
export type NewsProviderId = "newsdata" | "thenewsapi" | "gnews";

export type NormalizedArticle = {
  title: string;
  url: string;
  publishedAt: Date;
  excerpt: string;
  sourceName?: string;
  providerId: NewsProviderId;
};
