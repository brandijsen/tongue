import type { NormalizedArticle } from "../news/types";
import { foldText } from "./followUpTextNorm";

export function articleHostname(article: NormalizedArticle): string | null {
  const raw = article.url?.trim() ?? "";
  if (!raw) return null;
  try {
    const u = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function hostHintMatchesArticleHost(hostHint: string, article: NormalizedArticle): boolean {
  const h = hostHint.toLowerCase().replace(/^www\./, "");
  if (h.length < 3 || !h.includes(".")) return false;
  const a = articleHostname(article);
  if (!a) return false;
  if (a === h) return true;
  return a.endsWith(`.${h}`) && a.length > h.length;
}

/**
 * FQDN-like substrings, validated with the URL API (supports pagenews.gr, deutsch.rt.com, etc.).
 */
function extractHostHintsFromText(userText: string): string[] {
  // Segments of labels separated by dots (no \b at start: apostrophes in "l'articolo" break \b)
  const re = /[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/gi;
  const raw = userText.match(re) ?? [];
  const found = new Set<string>();
  for (const r of raw) {
    if (r.length < 4) continue;
    if (!(r.match(/\./g) ?? []).length) continue;
    try {
      const h = new URL(r.startsWith("http") ? r : `https://${r.toLowerCase()}`).hostname;
      if (h.length >= 4 && h.includes(".")) {
        found.add(h.replace(/^www\./, ""));
      }
    } catch {
      /* invalid host */
    }
  }
  return [...found];
}

/** e.g. "pagenews.gr", "deutsch.rt.com" in free text */
export function filterByHostHints(userText: string, articles: NormalizedArticle[]): NormalizedArticle[] {
  const hints = extractHostHintsFromText(userText);
  if (hints.length === 0) return [];
  const out: NormalizedArticle[] = [];
  for (const a of articles) {
    for (const hint of hints) {
      if (hostHintMatchesArticleHost(hint, a)) {
        out.push(a);
        break;
      }
    }
  }
  return out;
}

export function filterBySourceNameMention(
  userText: string,
  articles: NormalizedArticle[],
): NormalizedArticle[] {
  const t = foldText(userText);
  const out: NormalizedArticle[] = [];
  for (const a of articles) {
    const sn = a.sourceName ? foldText(a.sourceName) : "";
    if (sn && sn.length >= 3 && t.includes(sn)) {
      out.push(a);
    }
  }
  return out;
}

/**
 * Estrae parole alfanumeriche (≥4 caratteri) dal messaggio e seleziona articoli in cui
 * almeno una parola compare nel titolo o nell’excerpt.
 */
export function filterByTitleKeyword(userText: string, articles: NormalizedArticle[]): NormalizedArticle[] {
  const t = foldText(userText);
  const words = t.split(/[^a-z0-9]+/g).filter((w) => w.length >= 4);
  if (words.length === 0) return [];
  const out: NormalizedArticle[] = [];
  for (const a of articles) {
    const hay = foldText(`${a.title}\n${a.excerpt ?? ""}`);
    for (const w of words) {
      if (hay.includes(w)) {
        out.push(a);
        break;
      }
    }
  }
  return out;
}
