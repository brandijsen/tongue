import type { NormalizedArticle } from "./types";

export type PublishWindowParams = {
  date: string;
  sinceTime?: string;
  timeZone?: string;
};

function minutesSinceMidnight(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

/** Calendar date + wall-clock time in `timeZone` for this instant (PS2 window). */
function localYmdAndHm(iso: string, timeZone: string): { ymd: string; hm: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const y = map.year;
  const mo = map.month;
  const day = map.day;
  const h = map.hour;
  const min = map.minute;
  if (!y || !mo || !day || h === undefined || min === undefined) return null;

  return { ymd: `${y}-${mo}-${day}`, hm: `${h}:${min}` };
}

/**
 * Keeps articles whose `publishedAt` falls on `date` in the effective zone, and on/after `sinceTime` when set.
 * Without `timeZone`, uses UTC for the calendar day (PS2: fuso applicato — default esplicito finché il client non manda il fuso).
 */
export function filterNormalizedArticlesForWindow(
  articles: NormalizedArticle[],
  params: PublishWindowParams,
): NormalizedArticle[] {
  const zone = params.timeZone ?? "UTC";
  const { date, sinceTime } = params;
  const sinceMinutes = sinceTime != null ? minutesSinceMidnight(sinceTime) : null;
  if (sinceMinutes != null && Number.isNaN(sinceMinutes)) {
    return [];
  }

  return articles.filter((a) => {
    const local = localYmdAndHm(a.publishedAt, zone);
    if (!local) return false;
    if (local.ymd !== date) return false;
    if (sinceMinutes != null) {
      const articleMinutes = minutesSinceMidnight(local.hm);
      if (Number.isNaN(articleMinutes) || articleMinutes < sinceMinutes) return false;
    }
    return true;
  });
}
