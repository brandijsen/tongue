import type { NormalizedArticle } from "./types";

/**
 * Stable key for deduplication: host + path + query, lowercase host, no hash.
 * Invalid URLs fall back to trimmed lowercase string.
 */
export function urlDedupKey(url: string): string {
  const raw = url.trim();
  try {
    const u = new URL(raw);
    u.hash = "";
    const host = u.hostname.toLowerCase();
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    return `${u.protocol}//${host}${path}${u.search}`;
  } catch {
    return raw.toLowerCase();
  }
}

/** First occurrence wins; order preserved. */
export function dedupeByNormalizedUrl(articles: NormalizedArticle[]): NormalizedArticle[] {
  const seen = new Set<string>();
  const out: NormalizedArticle[] = [];
  for (const a of articles) {
    const k = urlDedupKey(a.url);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

/** Truncate list to `max` items (0 or negative → empty). */
export function capArticlePool(articles: NormalizedArticle[], max: number): NormalizedArticle[] {
  if (max <= 0) return [];
  return articles.slice(0, max);
}

/**
 * Append `incoming` after `base`, dedupe by URL (first wins), stop at `poolMax` items.
 * Used for the cumulative raw pool in the cascade (PS2).
 */
export function mergePoolsDedupeCap(
  base: NormalizedArticle[],
  incoming: NormalizedArticle[],
  poolMax: number,
): NormalizedArticle[] {
  if (poolMax <= 0) return [];
  const seen = new Set<string>();
  const out: NormalizedArticle[] = [];

  for (const a of base) {
    const k = urlDedupKey(a.url);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
    if (out.length >= poolMax) return out;
  }

  for (const a of incoming) {
    const k = urlDedupKey(a.url);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
    if (out.length >= poolMax) break;
  }

  return out;
}

/**
 * Which `incoming` items are not merged into the pool (same rules as {@link mergePoolsDedupeCap}).
 * Used for trace logging only.
 */
export function incomingSkippedByMerge(
  base: NormalizedArticle[],
  incoming: NormalizedArticle[],
  poolMax: number,
): { duplicate: NormalizedArticle[]; capBlocked: NormalizedArticle[] } {
  const duplicate: NormalizedArticle[] = [];
  const capBlocked: NormalizedArticle[] = [];
  if (poolMax <= 0) {
    return { duplicate: [], capBlocked: [...incoming] };
  }

  const seen = new Set<string>();
  let outLen = 0;

  for (const a of base) {
    const k = urlDedupKey(a.url);
    if (seen.has(k)) continue;
    seen.add(k);
    outLen++;
    if (outLen >= poolMax) {
      return { duplicate: [], capBlocked: [...incoming] };
    }
  }

  for (const a of incoming) {
    const k = urlDedupKey(a.url);
    if (seen.has(k)) {
      duplicate.push(a);
      continue;
    }
    if (outLen >= poolMax) {
      capBlocked.push(a);
      continue;
    }
    seen.add(k);
    outLen++;
  }

  return { duplicate, capBlocked };
}
