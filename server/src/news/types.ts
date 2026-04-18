/**
 * PS2 — internal data model after provider normalization.
 * Stable provider identifiers (spec PF6 / PS2).
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
