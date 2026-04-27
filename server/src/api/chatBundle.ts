import type { Message } from "@prisma/client";
import { MessageRole } from "@prisma/client";
import {
  metadataRowsToNormalized,
  type ArticleMetadataRow,
} from "../news/articleMetadata";
import { DEFAULT_MAX_ARTICLES_FOR_PROMPT } from "../news/constants";
import type { NormalizedArticle } from "../news/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function parseMetadataArticleRow(v: unknown): ArticleMetadataRow | null {
  if (!isRecord(v)) return null;
  const title = v.title;
  const url = v.url;
  const abstract = v.abstract;
  const providerId = v.providerId;
  if (typeof title !== "string" || title.length === 0) return null;
  if (typeof url !== "string" || url.length === 0) return null;
  if (typeof abstract !== "string") return null;
  if (typeof providerId !== "string" || providerId.length === 0) return null;
  const source = v.source;
  return {
    title,
    url,
    abstract,
    providerId,
    ...(typeof source === "string" && source.length > 0 ? { source } : {}),
  };
}

/**
 * From persisted assistant `metadata`, if it contains a non-empty article list, returns
 * normalized articles + reference date. Otherwise `null`.
 */
export function newsBundleFromAssistantMetadata(
  metadata: unknown,
): { date: string; articles: NormalizedArticle[] } | null {
  if (!isRecord(metadata)) return null;
  const date = metadata.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const raw = metadata.articles;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rows: ArticleMetadataRow[] = [];
  for (const a of raw) {
    const row = parseMetadataArticleRow(a);
    if (row) rows.push(row);
  }
  if (rows.length === 0) return null;
  const articles = metadataRowsToNormalized(rows, date);
  if (articles.length === 0) return null;
  return { date, articles };
}

/** Assistant message body for the same turn as the bundle (for follow-up: part/paragraph). */
export type NewsBundleWithContext = {
  date: string;
  articles: NormalizedArticle[];
  /** Plain text of the last assistant reply that had this bundle (summary only, no *Fonti* in DB). */
  summaryAssistantContent: string;
};

/**
 * Latest ASSISTANT message in the thread that has a non-empty news bundle, plus the visible summary text.
 */
export function findLatestNewsBundleWithContext(
  messages: Message[],
): NewsBundleWithContext | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== MessageRole.ASSISTANT) continue;
    const b = newsBundleFromAssistantMetadata(m.metadata);
    if (b) {
      return { ...b, summaryAssistantContent: m.content };
    }
  }
  return null;
}

/**
 * Unions articles from all ASSISTANT messages in the thread that carry a bundle
 * for the same calendar `date` (chronological first-seen URL wins, deduped).
 * Capped at M so follow-ups can reuse sources from an earlier, richer turn after
 * a narrow reply, without re-fetching and without mixing different calendar days.
 */
export function mergeSessionArticlePoolForSameDate(
  messages: Message[],
  date: string,
  maxArticles: number = DEFAULT_MAX_ARTICLES_FOR_PROMPT,
): NormalizedArticle[] {
  const out: NormalizedArticle[] = [];
  const seen = new Set<string>();
  for (const m of messages) {
    if (m.role !== MessageRole.ASSISTANT) continue;
    const b = newsBundleFromAssistantMetadata(m.metadata);
    if (!b || b.date !== date) continue;
    for (const a of b.articles) {
      if (seen.has(a.url)) continue;
      seen.add(a.url);
      out.push(a);
      if (out.length >= maxArticles) return out;
    }
  }
  return out;
}
