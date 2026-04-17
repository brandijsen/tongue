import type { Message } from "@prisma/client";
import { MessageRole } from "@prisma/client";
import type { NormalizedArticle } from "./types";

export type NewsBundleMetadata = {
  date: string;
  sinceTime?: string;
  timeZone?: string;
  articles: NormalizedArticle[];
};

function effectiveTimeZone(tz: string | undefined): string {
  return tz ?? "UTC";
}

export function isNewsBundleMetadata(meta: unknown): meta is NewsBundleMetadata {
  if (meta == null || typeof meta !== "object") return false;
  const m = meta as Record<string, unknown>;
  if (typeof m.date !== "string" || !Array.isArray(m.articles)) return false;
  return m.articles.every((item) => {
    if (item == null || typeof item !== "object") return false;
    const a = item as Record<string, unknown>;
    return (
      typeof a.title === "string" &&
      typeof a.url === "string" &&
      typeof a.publishedAt === "string" &&
      typeof a.excerpt === "string"
    );
  });
}

export function bundleMatchesRequest(
  bundle: NewsBundleMetadata,
  req: { date: string; sinceTime?: string; timeZone?: string; refreshNews?: boolean },
): boolean {
  if (req.refreshNews === true) return false;
  if (bundle.date !== req.date) return false;
  const bSince = bundle.sinceTime ?? null;
  const rSince = req.sinceTime ?? null;
  if (bSince !== rSince) return false;
  if (effectiveTimeZone(bundle.timeZone) !== effectiveTimeZone(req.timeZone)) return false;
  return true;
}

/** `messagesAsc`: full thread including the USER message just persisted for this turn. */
export function findLatestNewsBundle(messagesAsc: Message[]): NewsBundleMetadata | null {
  for (let i = messagesAsc.length - 1; i >= 0; i--) {
    const row = messagesAsc[i];
    if (row.role !== MessageRole.ASSISTANT) continue;
    if (isNewsBundleMetadata(row.metadata)) return row.metadata;
  }
  return null;
}
