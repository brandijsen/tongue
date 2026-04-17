import type { Message } from "@prisma/client";
import { envIsTruthy } from "../lib/envTruthy";
import { maxArticlesForPrompt } from "./cascade";
import { filterNormalizedArticlesForWindow } from "./filterByPublishWindow";
import { fetchNormalizedArticles } from "./fetchNormalizedArticles";
import { bundleMatchesRequest, findLatestNewsBundle } from "./newsBundle";
import type { NormalizedArticle } from "./types";

export type ChatArticleResolution = {
  articles: NormalizedArticle[];
  newsSource: "fetch" | "bundleReuse";
  windowFallback: boolean;
};

export type ArticleTurnParams = {
  date: string;
  message: string;
  sinceTime?: string;
  timeZone?: string;
  refreshNews?: boolean;
};

/**
 * Cascata PS2 + filtro calendario + stesso fallback “window” del turno chat (senza riuso bundle).
 */
export async function fetchArticlesWithWindowPolicy(
  input: ArticleTurnParams,
): Promise<{ articles: NormalizedArticle[]; windowFallback: boolean }> {
  const { date, message: userText, sinceTime, timeZone } = input;
  const rawArticles = await fetchNormalizedArticles({
    message: userText,
    date,
    sinceTime,
    timeZone,
  });
  const strictWindow = filterNormalizedArticlesForWindow(rawArticles, { date, sinceTime, timeZone });
  const strictOnly = envIsTruthy("NEWS_STRICT_CALENDAR_WINDOW");

  let articles: NormalizedArticle[];
  let windowFallback = false;

  if (strictWindow.length > 0) {
    articles = strictWindow;
  } else if (!strictOnly && rawArticles.length > 0 && sinceTime == null) {
    /**
     * NewsData /latest (~48h) often returns items whose local calendar day is adjacent to the
     * requested `date`; strict filtering then yields []. Reuse raw results for the LLM when the
     * user asked for the full day only (no sinceTime). Set NEWS_STRICT_CALENDAR_WINDOW=true to disable.
     */
    windowFallback = true;
    articles = rawArticles.slice(0, maxArticlesForPrompt());
  } else {
    articles = strictWindow;
  }

  return { articles, windowFallback };
}

/**
 * PF3: reuse prior ASSISTANT bundle when date / sinceTime / timeZone / refreshNews match; else fetch + strict window + optional loose fallback.
 */
export async function resolveArticlesForChatTurn(
  threadAsc: Message[],
  input: ArticleTurnParams,
): Promise<ChatArticleResolution> {
  const { date, sinceTime, timeZone, refreshNews } = input;
  const previousBundle = findLatestNewsBundle(threadAsc);

  if (previousBundle && bundleMatchesRequest(previousBundle, { date, sinceTime, timeZone, refreshNews })) {
    return {
      articles: previousBundle.articles,
      newsSource: "bundleReuse",
      windowFallback: false,
    };
  }

  const { articles, windowFallback } = await fetchArticlesWithWindowPolicy(input);
  return { articles, newsSource: "fetch", windowFallback };
}
