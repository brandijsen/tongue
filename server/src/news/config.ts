import {
  ALLOWED_NEWS_PROVIDER_IDS,
  DEFAULT_MAX_ARTICLES_FOR_PROMPT,
  DEFAULT_NEWS_PROVIDER_ORDER,
  DEFAULT_NEWS_SELECTOR_POOL_MAX,
  DEFAULT_NEWS_TARGET_RELEVANT_ARTICLES,
} from "./constants";
import type { NewsProviderId } from "./types";

export type NewsApiKeys = Record<NewsProviderId, string | undefined>;

export type NewsEnvConfig = {
  providerOrder: NewsProviderId[];
  newsTargetRelevantArticles: number;
  maxArticlesForPrompt: number;
  selectorPoolMax: number;
  useMockNews: boolean;
  keys: NewsApiKeys;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseProviderOrder(raw: string | undefined): NewsProviderId[] {
  if (raw == null || raw.trim() === "") {
    return [...DEFAULT_NEWS_PROVIDER_ORDER];
  }
  const seen = new Set<NewsProviderId>();
  const out: NewsProviderId[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim().toLowerCase() as NewsProviderId;
    if (!ALLOWED_NEWS_PROVIDER_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length > 0 ? out : [...DEFAULT_NEWS_PROVIDER_ORDER];
}

function readKeys(): NewsApiKeys {
  return {
    newsdata: process.env.NEWSDATA_API_KEY,
    thenewsapi: process.env.THENEWS_API_KEY,
    gnews: process.env.GNEWS_API_KEY,
  };
}

/**
 * Read news-related settings from `process.env`.
 * Call after `loadEnv` (e.g. at process startup or before handling a request).
 */
export function getNewsEnvConfig(): NewsEnvConfig {
  return {
    providerOrder: parseProviderOrder(process.env.NEWS_PROVIDER_ORDER),
    newsTargetRelevantArticles: parsePositiveInt(
      process.env.NEWS_TARGET_RELEVANT_ARTICLES,
      DEFAULT_NEWS_TARGET_RELEVANT_ARTICLES,
    ),
    maxArticlesForPrompt: parsePositiveInt(
      process.env.MAX_ARTICLES_FOR_PROMPT,
      DEFAULT_MAX_ARTICLES_FOR_PROMPT,
    ),
    selectorPoolMax: parsePositiveInt(
      process.env.NEWS_SELECTOR_POOL_MAX,
      DEFAULT_NEWS_SELECTOR_POOL_MAX,
    ),
    useMockNews: process.env.USE_MOCK_NEWS === "true",
    keys: readKeys(),
  };
}

function hasKey(key: string | undefined): boolean {
  return key != null && key.trim() !== "";
}

/** Providers in configured order that have a non-empty API key. */
export function configuredProvidersInOrder(cfg: NewsEnvConfig): NewsProviderId[] {
  return cfg.providerOrder.filter((id) => hasKey(cfg.keys[id]));
}

/** At least one real provider is configured, or mock mode is on. */
export function canFetchNews(cfg: NewsEnvConfig): boolean {
  return cfg.useMockNews || configuredProvidersInOrder(cfg).length > 0;
}
