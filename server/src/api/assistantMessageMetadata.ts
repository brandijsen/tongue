import { articlesToMetadataRows } from "../news/articleMetadata";
import type { NormalizedArticle } from "../news/types";

/**
 * Persisted `metadata.articles` must be **exactly** the `NormalizedArticle[]` fed to the
 * summarizer for this turn (`summarizeNewsTurn`), or the follow-up / no-key branches that use
 * the same array in `buildAssistantContent`. That is the relevance-selected, M-capped set from
 * `runNewsCascade` / `selectFollowUpArticleSubset` — not the undeduplicated raw provider pool,
 * not “everything the cascade ever fetched.”
 *
 * When the pool is empty or the selector finds zero relevant items, `articles` is `[]` and the
 * user message explains that (no synthesis; no invented sources in UI).
 */
export function buildNewsAssistantMessageMetadata(input: {
  date: string;
  articles: NormalizedArticle[];
  summaryPending: boolean;
  showSources: boolean;
}): {
  date: string;
  articles: ReturnType<typeof articlesToMetadataRows>;
  summaryPending: boolean;
  showSources?: false;
} {
  const { date, articles, summaryPending, showSources } = input;
  return {
    date,
    articles: articlesToMetadataRows(articles),
    summaryPending,
    ...(showSources ? {} : { showSources: false as const }),
  };
}
