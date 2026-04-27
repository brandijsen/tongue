import type { NormalizedArticle } from "../news/types";
import { filterByParagraphOrPartReference } from "./followUpParagraphRef";
import {
  filterByHostHints,
  filterBySourceNameMention,
  filterByTitleKeyword,
} from "./followUpSourceHints";

export type FollowUpArticleSelection = {
  articles: NormalizedArticle[];
  /**
   * Summary-block text (first/third part, etc.): passed to the model to anchor the
   * follow-up; `null` when the selection is not part/paragraph-based.
   */
  focusParagraphFromLastSummary: string | null;
};

function uniqueByUrl(list: NormalizedArticle[]): NormalizedArticle[] {
  const seen = new Set<string>();
  return list.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

/**
 * Picks a subset of the news bundle for follow-up turns when the user names a
 * site, testata, key words in title or excerpt, or a *part/paragraph* of the
 * last summary—so the reply and the *Fonti* list stay aligned. If no confident
 * subset is found, returns the full `articles` list.
 * @param lastNewsSummaryText Latest assistant message that carried the bundle (plain summary).
 */
export function selectFollowUpArticleSubset(
  userText: string,
  articles: NormalizedArticle[],
  lastNewsSummaryText: string | null = null,
): FollowUpArticleSelection {
  if (articles.length <= 1) {
    return { articles, focusParagraphFromLastSummary: null };
  }

  const byHost = filterByHostHints(userText, articles);
  if (byHost.length > 0) {
    return { articles: uniqueByUrl(byHost), focusParagraphFromLastSummary: null };
  }

  const bySource = filterBySourceNameMention(userText, articles);
  if (bySource.length > 0) {
    return { articles: uniqueByUrl(bySource), focusParagraphFromLastSummary: null };
  }

  if (lastNewsSummaryText?.trim()) {
    const byPart = filterByParagraphOrPartReference(userText, lastNewsSummaryText, articles);
    if (byPart != null && byPart.articles.length > 0) {
      return {
        articles: uniqueByUrl(byPart.articles),
        focusParagraphFromLastSummary: byPart.focusParagraph,
      };
    }
  }

  const byTitle = filterByTitleKeyword(userText, articles);
  if (byTitle.length > 0) {
    return { articles: uniqueByUrl(byTitle), focusParagraphFromLastSummary: null };
  }

  return { articles, focusParagraphFromLastSummary: null };
}
