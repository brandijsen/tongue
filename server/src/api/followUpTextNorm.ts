/** Lowercase, strip Latin combining marks (à→a) — used by follow-up matching. */
export function foldText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
