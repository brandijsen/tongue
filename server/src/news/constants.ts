import type { NewsProviderId } from "./types";

/** Default provider order when `NEWS_PROVIDER_ORDER` is unset. */
export const DEFAULT_NEWS_PROVIDER_ORDER: readonly NewsProviderId[] = [
  "newsdata",
  "thenewsapi",
  "gnews",
];

/** T — cascade stop threshold: at least T relevant articles (code default). */
export const DEFAULT_NEWS_TARGET_RELEVANT_ARTICLES = 4;

/** M — max relevant articles for synthesis and `metadata.articles` (spec default). */
export const DEFAULT_MAX_ARTICLES_FOR_PROMPT = 8;

/**
 * Max cumulative raw candidates fed to the selector (overridable via env; code default
 * until set elsewhere).
 */
export const DEFAULT_NEWS_SELECTOR_POOL_MAX = 48;

export const ALLOWED_NEWS_PROVIDER_IDS: ReadonlySet<NewsProviderId> = new Set([
  "newsdata",
  "thenewsapi",
  "gnews",
]);
