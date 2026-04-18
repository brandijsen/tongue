import type { NormalizedArticle } from "./types";

const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

/** UTC calendar date as `YYYY-MM-DD` (spec: compare `date` to publication day in UTC). */
export function utcCalendarDayLabel(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameUtcCalendarDay(d: Date, dateYmd: string): boolean {
  if (!DATE_YMD.test(dateYmd)) return false;
  return utcCalendarDayLabel(d) === dateYmd;
}

/**
 * Keep articles whose `publishedAt` falls on `dateYmd` in UTC.
 * @throws RangeError if `dateYmd` is not `YYYY-MM-DD`
 */
export function filterByUtcCalendarDay(
  articles: NormalizedArticle[],
  dateYmd: string,
): NormalizedArticle[] {
  if (!DATE_YMD.test(dateYmd)) {
    throw new RangeError(`dateYmd must be YYYY-MM-DD, got: ${dateYmd}`);
  }
  return articles.filter((a) => isSameUtcCalendarDay(a.publishedAt, dateYmd));
}
