import type { NormalizedArticle } from "./types";

/** Shape persisted under `messages[].metadata.articles` (PS1). */
export type ArticleMetadataRow = {
  title: string;
  url: string;
  abstract: string;
  source?: string;
  providerId: string;
};

const ABSTRACT_MAX = 500;

export function articlesToMetadataRows(articles: NormalizedArticle[]): ArticleMetadataRow[] {
  return articles.map((a) => ({
    title: a.title,
    url: a.url,
    abstract: a.excerpt.slice(0, ABSTRACT_MAX),
    ...(a.sourceName != null ? { source: a.sourceName } : {}),
    providerId: a.providerId,
  }));
}
