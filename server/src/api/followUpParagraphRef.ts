import type { NormalizedArticle } from "../news/types";
import { articleHostname } from "./followUpSourceHints";
import { foldText } from "./followUpTextNorm";

/**
 * Phrases like first/second part or paragraph, last part, paragraph 2, intro / conclusion (Italian user text).
 */
function wantsPartOrParagraphRefinement(userText: string): boolean {
  const t = foldText(userText);
  return (
    /\b(prim[oa]|1°|1º)\s+(parte|paragra\w*|bloc|sez|punto)\b/.test(t) ||
    /\b(second[oa]|2°|2º|terz[oa]|3°|3º|quart[oa]|4°|4º)\s+(parte|paragra\w*|bloc|sez|met[àa]?)\b/.test(t) ||
    /(^|\b)(il|la|lo|gli|le|un[oa]?|quest[oa]|quest)\s+(prim[oa]|second[oa]|terz[oa]|quart[oa])\s+paragra\w*/.test(
      t,
    ) ||
    /(l['']?iniz|l['']?incip|introd|conclusioni?|l['']?ultim|chiusur|il\s+fin(ale|e)\b|ultim[oa]?\s+parte)/.test(
      t,
    ) ||
    /\b(parte|paragrafo|blocco|sezion[ea]?|punto)\s*(della|del|delle|di)?\s*(prima|primo|1|2|3|4|seconda|terza|quarta|ultima|penultim)/.test(
      t,
    ) ||
    /paragrafo\s*\d{1,2}\b|parte\s*\d{1,2}\b|(?:^|\s)([1-4])°\s*par/.test(t) ||
    /second[oa]\s+met[àa]/.test(t) ||
    /(penultim[oa]?\s+parte|ultim[oa]?\s+paragra|prim[oa]\s+met[àa])/.test(t)
  );
}

/**
 * Double newline = paragraph. If the model uses only a single \n between blocks, we get
 * *fewer* segments (e.g. 2) than line breaks (e.g. 3) and “third paragraph” can go out of range.
 * If there are 3+ non-empty lines but only 1–2 double-newline segments, we split on single lines.
 */
function splitAssistantIntoParagraphs(plain: string): string[] {
  const t = plain.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  const byDouble = t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bySingle = t
    .split(/\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (byDouble.length >= 3) return byDouble;
  if (byDouble.length === 2 && bySingle.length === 3) {
    return bySingle;
  }
  if (byDouble.length === 1 && bySingle.length >= 3) {
    return bySingle;
  }
  if (byDouble.length >= 2) return byDouble;
  if (bySingle.length >= 2) return bySingle;
  return [t];
}

function parseParagraphIndexFromUser(userText: string, blockCount: number): number | null {
  if (blockCount <= 0) return null;
  const t = foldText(userText);
  if (
    /(ultim[oa](\s+parte)?|conclusioni?|chiusur[ae]?|l['']?ultim|il\s+fin(ale|e)\b|ultim[oa]?\s+paragra|ultim[oa]?\s+sez)/.test(
      t,
    )
  ) {
    return blockCount - 1;
  }
  if (/(^|\b)(l['']?iniz|l['']?incip|introd|principi|l['']?avvio|principio)/.test(t)) {
    return 0;
  }
  if (/(^|\b)(primo|prima|1°|1º|paragrafo\s*1|parte\s*1|prim[oa]\s+met[àa])\b/.test(t)) {
    return 0;
  }
  if (/(^|\b)(second[oa]|2°|2º|paragrafo\s*2|parte\s*2|second[oa]\s+met[àa])\b/.test(t)) {
    return 1;
  }
  if (/(^|\b)(terz[oa]|3°|3º|paragrafo\s*3|parte\s*3|il\s+terz[oa]\s+par|la\s+terz[oa]\s+par|il\s+3\.?\s*par|la\s+3\.?\s*par)\b/.test(
    t,
  )) {
    return 2;
  }
  if (/(^|\b)penultim[oa]?\b/.test(t)) {
    return blockCount > 1 ? Math.max(0, blockCount - 2) : 0;
  }
  if (/(^|\b)(quart[oa]|4°|4º|paragrafo\s*4|parte\s*4)\b/.test(t)) {
    return 3;
  }
  const numM = t.match(/(?:paragrafo|parte|blocco|sezion[ea]?|punto|numero|n[°°])\s*(\d{1,2})/i);
  if (numM) {
    const n = Math.max(0, parseInt(numM[1]!, 10) - 1);
    return n >= 0 && n < blockCount ? n : null;
  }
  const m2 = t.match(/\b([1-4])\s*°/);
  if (m2) {
    const n = parseInt(m2[1]!, 10) - 1;
    if (n >= 0 && n < blockCount) return n;
  }
  return null;
}

function tokenizeForParagraphOverlap(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of foldText(s).split(/[^a-z0-9]+/g)) {
    if (w.length < 3) continue;
    out.add(w);
  }
  return out;
}

/**
 * If the block has a byline in parentheses, e.g. (Hindustan Times), map 1:1 to that article
 * and return [only that] — avoids 4 *Fonti* when the 2nd paragraph cites a single source.
 */
function matchArticlesByParentheticalCitations(
  focusParagraph: string,
  articles: NormalizedArticle[],
): NormalizedArticle[] | null {
  const inners = Array.from(focusParagraph.matchAll(/\(([^)]+)\)/g), (m) => m[1]!.trim()).filter(
    (s) => s.length >= 2,
  );
  if (inners.length === 0) return null;

  for (let k = inners.length - 1; k >= 0; k--) {
    const raw = inners[k]!;
    const n = foldText(raw);
    if (n.length < 2) continue;
    const shortTok = n.replace(/[^a-z0-9]+/g, " ").trim();
    if (shortTok.length < 2) continue;
    if (shortTok.length <= 3 && n.length < 4) {
      continue;
    }

    const hits = articles.filter((a) => parentheticalTextMatchesArticle(raw, a));
    if (hits.length === 1) {
      return hits;
    }
  }
  return null;
}

function parentheticalTextMatchesArticle(raw: string, a: NormalizedArticle): boolean {
  const n = foldText(raw).replace(/\s+/g, " ").trim();
  if (n.length < 2) return false;
  const sn = a.sourceName ? foldText(a.sourceName) : "";
  const title = foldText(a.title);
  const h = (articleHostname(a) ?? "").replace(/^www\./, "");

  if (sn) {
    if (sn === n || n === sn) return true;
    if (sn.length >= 4 && n.length >= 4 && (sn.includes(n) || n.includes(sn))) return true;
  }
  if (n.length >= 5 && title.includes(n)) return true;
  for (const w of n.split(/\s+/)) {
    if (w.length >= 4 && h.length > 0 && h.includes(w)) return true;
  }
  return false;
}

function scoreArticleAgainstParagraph(paraTokens: Set<string>, a: NormalizedArticle): number {
  if (paraTokens.size === 0) return 0;
  const hay = foldText(`${a.title}\n${a.excerpt}`);
  let hit = 0;
  for (const t of paraTokens) {
    if (hay.includes(t)) hit += 1;
  }
  return hit / Math.sqrt(paraTokens.size);
}

function selectArticlesByParagraphOverlap(
  focusParagraph: string,
  articles: NormalizedArticle[],
): NormalizedArticle[] {
  const paraTokens = tokenizeForParagraphOverlap(focusParagraph);
  if (paraTokens.size === 0) return [];
  const scored = articles
    .map((a) => ({ a, s: scoreArticleAgainstParagraph(paraTokens, a) }))
    .sort((x, y) => y.s - x.s);
  const best = scored[0]?.s ?? 0;
  if (best < 0.25) return [];
  const second = scored[1]?.s ?? 0;
  /** One article wins clearly: avoids four “Fonti” for a single paragraph. */
  if (second < best - 1e-9 && best >= 0.3 && (second === 0 || best >= second * 1.4)) {
    if (scored[0]) return [scored[0].a];
  }
  const minKeep = best * 0.45;
  const picked: NormalizedArticle[] = [];
  for (const { a, s } of scored) {
    if (s < minKeep) break;
    if (s < 0.2) break;
    picked.push(a);
    if (picked.length >= 4) break;
  }
  return picked;
}

export function filterByParagraphOrPartReference(
  userText: string,
  lastNewsSummary: string,
  articles: NormalizedArticle[],
): { focusParagraph: string; articles: NormalizedArticle[] } | null {
  if (!wantsPartOrParagraphRefinement(userText)) return null;
  let blocks = splitAssistantIntoParagraphs(lastNewsSummary);
  if (blocks.length === 0) return null;
  let idx = parseParagraphIndexFromUser(userText, blocks.length);
  if (idx != null && idx >= blocks.length) {
    const lines = lastNewsSummary
      .replace(/\r\n/g, "\n")
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length > blocks.length) {
      blocks = lines;
      idx = parseParagraphIndexFromUser(userText, blocks.length);
    }
  }
  if (idx == null) return null;
  if (idx < 0 || idx >= blocks.length) return null;
  const focus = (blocks[idx] ?? "").trim();
  if (!focus) return null;
  const citedOnly = matchArticlesByParentheticalCitations(focus, articles);
  if (citedOnly) {
    return { focusParagraph: focus, articles: citedOnly };
  }
  const selected = selectArticlesByParagraphOverlap(focus, articles);
  if (selected.length === 0) return null;
  return { focusParagraph: focus, articles: selected };
}
