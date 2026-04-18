import type { NormalizedArticle } from "./types";
import { utcCalendarDayLabel } from "./utcCalendarDay";

/**
 * Verbose cascade / selector tracing. Set NEWS_TRACE=0 or false to disable.
 */
export function isNewsTraceEnabled(): boolean {
  const v = process.env.NEWS_TRACE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}

export function newsTrace(label: string, detail?: Record<string, unknown>): void {
  if (!isNewsTraceEnabled()) return;
  if (detail != null) {
    console.log(`[news trace] ${label}`, detail);
  } else {
    console.log(`[news trace] ${label}`);
  }
}

/** Compact article rows for console trace (dropped / skipped lists). */
export function articlesTraceRows(
  articles: NormalizedArticle[],
  titleMax = 88,
): Array<{ title: string; url: string; publishedUtcDay: string; providerId: string }> {
  return articles.map((a) => {
    const t = a.publishedAt.getTime();
    const day = Number.isNaN(t) ? "invalid-date" : utcCalendarDayLabel(a.publishedAt);
    const title =
      a.title.length > titleMax ? `${a.title.slice(0, titleMax)}…` : a.title;
    return { title, url: a.url, publishedUtcDay: day, providerId: a.providerId };
  });
}
