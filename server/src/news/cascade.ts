import { canFetchNews, configuredProvidersInOrder, type NewsEnvConfig } from "./config";
import { normalizeProviderSearchQuery } from "./newsSearchNormalize";
import { incomingSkippedByMerge, mergePoolsDedupeCap } from "./articlePool";
import type { FetchArticlesParams, NewsProvider } from "./provider";
import { createGnewsProvider } from "./providers/gnews";
import { createNewsdataProvider } from "./providers/newsdata";
import { createThenewsapiProvider } from "./providers/thenewsapi";
import { createMockNewsProvider } from "./mockNews";
import type { NewsProviderId, NormalizedArticle } from "./types";
import { filterByUtcCalendarDay, isSameUtcCalendarDay } from "./utcCalendarDay";
import { articlesTraceRows, newsTrace } from "./traceLog";
import { selectRelevantArticlesWithLLM } from "../openai/selectRelevantArticles";

export class NewsCascadeError extends Error {
  readonly code: "NO_PROVIDER";

  constructor(message: string) {
    super(message);
    this.name = "NewsCascadeError";
    this.code = "NO_PROVIDER";
  }
}

function instantiateProvider(id: NewsProviderId, cfg: NewsEnvConfig): NewsProvider | null {
  const key = cfg.keys[id]?.trim();
  if (!key) return null;
  switch (id) {
    case "newsdata":
      return createNewsdataProvider(key);
    case "thenewsapi":
      return createThenewsapiProvider(key);
    case "gnews":
      return createGnewsProvider(key);
    default:
      return null;
  }
}

/** PF8 fallback when `OPENAI_API_KEY` is missing or the selector call fails. */
function relevantStub(pool: NormalizedArticle[]): NormalizedArticle[] {
  return pool;
}

async function applyRelevanceSelection(
  pool: NormalizedArticle[],
  params: FetchArticlesParams,
  maxForPrompt: number,
  afterProviderLabel: string,
): Promise<NormalizedArticle[]> {
  if (pool.length === 0) {
    newsTrace("selector:skip-empty-pool", { afterProvider: afterProviderLabel });
    return [];
  }
  const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  if (!hasKey) {
    newsTrace("selector:pass-through-no-openai-key", {
      afterProvider: afterProviderLabel,
      poolSize: pool.length,
      note: "full pool returned; downstream may cap to M",
    });
    return relevantStub(pool);
  }
  try {
    return await selectRelevantArticlesWithLLM(pool, params, maxForPrompt, afterProviderLabel);
  } catch (e) {
    console.warn("[news cascade] LLM selector failed, using unfiltered pool", e);
    newsTrace("selector:llm-fallback-full-pool", {
      afterProvider: afterProviderLabel,
      poolSize: pool.length,
    });
    return relevantStub(pool);
  }
}

/**
 * Incremental cascade (PS2 + numeric rules I / T / M). Calendar filter and pool cap applied after each fetch.
 * @throws NewsCascadeError when real fetch is requested but no API keys / mock are available
 */
export async function runNewsCascade(
  params: FetchArticlesParams,
  cfg: NewsEnvConfig,
): Promise<NormalizedArticle[]> {
  const T = cfg.newsTargetRelevantArticles;
  const M = cfg.maxArticlesForPrompt;
  const poolMax = cfg.selectorPoolMax;

  if (cfg.useMockNews) {
    newsTrace("cascade:mock-mode", {
      date: params.date,
      messagePreview: params.message.slice(0, 120),
      providerSearchQuery: normalizeProviderSearchQuery(params.message).slice(0, 200),
      T,
      M,
      poolMax,
    });
    const mock = createMockNewsProvider();
    const raw = await mock.fetchArticles(params);
    newsTrace("mock:fetch", { rawCount: raw.length });
    const inWindow = filterByUtcCalendarDay(raw, params.date);
    const droppedUtcMock = raw.filter((a) => !isSameUtcCalendarDay(a.publishedAt, params.date));
    newsTrace("mock:after-utc-calendar-filter", {
      kept: inWindow.length,
      droppedByUtc: raw.length - inWindow.length,
    });
    if (droppedUtcMock.length > 0) {
      newsTrace("mock:articles-dropped-utc", {
        count: droppedUtcMock.length,
        articles: articlesTraceRows(droppedUtcMock),
      });
    }
    const rawPool = mergePoolsDedupeCap([], inWindow, poolMax);
    newsTrace("mock:pool-after-merge-cap", { poolSize: rawPool.length });
    let selected = await applyRelevanceSelection(rawPool, params, M, "mock");
    if (selected.length > M) {
      newsTrace("mock:cap-selected-to-M", { before: selected.length, M });
      selected = selected.slice(0, M);
    }
    newsTrace("cascade:mock-done", {
      finalCount: selected.length,
      titles: selected.map((a) => a.title.slice(0, 80)),
    });
    return selected;
  }

  if (!canFetchNews(cfg)) {
    throw new NewsCascadeError("No news providers configured (set API keys or USE_MOCK_NEWS=true).");
  }

  const order = configuredProvidersInOrder(cfg);
  newsTrace("cascade:start", {
    date: params.date,
    messagePreview: params.message.slice(0, 120),
    providerSearchQuery: normalizeProviderSearchQuery(params.message).slice(0, 200),
    T,
    M,
    poolMax,
    providerOrder: order,
  });

  let rawPool: NormalizedArticle[] = [];
  let lastSelected: NormalizedArticle[] = [];

  for (const id of order) {
    const provider = instantiateProvider(id, cfg);
    if (!provider) {
      newsTrace("cascade:skip-provider-no-instance", { providerId: id });
      continue;
    }

    newsTrace("cascade:fetch-start", { providerId: id });
    let raw: NormalizedArticle[];
    try {
      raw = await provider.fetchArticles(params);
    } catch (e) {
      console.error(`[news cascade] provider ${id} failed`, e);
      newsTrace("cascade:fetch-error", { providerId: id });
      continue;
    }

    newsTrace("cascade:fetch-raw", { providerId: id, rawCount: raw.length });

    const inWindow = filterByUtcCalendarDay(raw, params.date);
    const droppedUtcArticles = raw.filter((a) => !isSameUtcCalendarDay(a.publishedAt, params.date));
    const droppedUtc = droppedUtcArticles.length;
    newsTrace("cascade:after-utc-calendar-filter", {
      providerId: id,
      kept: inWindow.length,
      droppedByUtc: droppedUtc,
    });
    if (droppedUtcArticles.length > 0) {
      newsTrace("cascade:articles-dropped-utc", {
        providerId: id,
        targetUtcDay: params.date,
        count: droppedUtcArticles.length,
        articles: articlesTraceRows(droppedUtcArticles),
      });
    }

    const basePool = rawPool;
    const poolBefore = basePool.length;
    const mergeSkips = incomingSkippedByMerge(basePool, inWindow, poolMax);
    rawPool = mergePoolsDedupeCap(basePool, inWindow, poolMax);
    const mergedIn = rawPool.length - poolBefore;
    const dedupOrCapLoss = Math.max(0, inWindow.length - mergedIn);
    newsTrace("cascade:pool-after-merge-dedupe-cap", {
      providerId: id,
      poolBefore,
      poolAfter: rawPool.length,
      netNewInPool: mergedIn,
      approxDroppedDedupOrCap: dedupOrCapLoss,
      poolMax,
    });
    if (mergeSkips.duplicate.length > 0) {
      newsTrace("cascade:articles-dropped-merge-duplicate-url", {
        providerId: id,
        count: mergeSkips.duplicate.length,
        articles: articlesTraceRows(mergeSkips.duplicate),
      });
    }
    if (mergeSkips.capBlocked.length > 0) {
      newsTrace("cascade:articles-dropped-merge-pool-cap", {
        providerId: id,
        poolMax,
        count: mergeSkips.capBlocked.length,
        articles: articlesTraceRows(mergeSkips.capBlocked),
      });
    }

    lastSelected = await applyRelevanceSelection(rawPool, params, M, id);

    const I = lastSelected.length;
    newsTrace("cascade:after-selector", {
      providerId: id,
      selectedCount: I,
      selectedTitles: lastSelected.map((a) => a.title.slice(0, 72)),
      thresholds: { T, M },
    });

    if (I > M) {
      newsTrace("cascade:exit-early-I-greater-than-M", { I, M });
      return lastSelected.slice(0, M);
    }
    if (I >= T) {
      newsTrace("cascade:exit-early-I-reached-T", { I, T, providerId: id });
      return lastSelected;
    }

    newsTrace("cascade:continue-next-provider", {
      I,
      T,
      reason: "selected count below T, trying next provider",
    });
  }

  newsTrace("cascade:done-all-providers", {
    finalSelectedCount: lastSelected.length,
    finalTitles: lastSelected.map((a) => a.title.slice(0, 72)),
  });
  return lastSelected;
}
