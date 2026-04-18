/**
 * Chat users write "Notizie su …", "Ultime sul …"; news APIs index keywords and match poorly on that phrasing.
 * Strip common Italian/English prefixes so `q` / `search` recall improves. LLM steps still use the full user message.
 */
export function normalizeProviderSearchQuery(message: string): string {
  const raw = message.trim().replace(/\s+/g, " ");
  if (raw === "") return "";

  let s = raw;

  s = s.replace(
    /^(notizie|ultime|novità|novita|news|aggiornamenti)\s+(su|sui|sul|sulla|sullo|sugli|sulle|dei|degli|delle|del|della|dello|di)\s+/i,
    "",
  );
  s = s.replace(/^(parlami\s+di|dimmi\s+di|raccontami\s+|cosa\s+succede\s+con)\s+/i, "");
  s = s.replace(/^(informazioni\s+su|info\s+su|news\s+about|about)\s+/i, "");

  s = s.trim().replace(/\s+/g, " ");
  return s !== "" ? s : raw;
}
