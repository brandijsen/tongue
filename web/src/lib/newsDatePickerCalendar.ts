export const NEWS_DATE_MONTHS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
] as const;

export const NEWS_DATE_WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;

export function toYmd(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseYmd(s: string): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [ys, ms, ds] = s.split("-");
  const y = Number(ys);
  const m = Number(ms) - 1;
  const d = Number(ds);
  if (m < 0 || m > 11 || d < 1) return null;
  const t = new Date(y, m, d);
  if (t.getFullYear() !== y || t.getMonth() !== m || t.getDate() !== d) return null;
  return { y, m, d };
}

export function addMonths(y: number, m: number, delta: number) {
  const t = new Date(y, m + delta, 1);
  return { y: t.getFullYear(), m: t.getMonth() };
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

/** Monday = column 0 (ISO). */
function firstColumnOffsetMon(y: number, m: number) {
  const w = new Date(y, m, 1).getDay();
  return w === 0 ? 6 : w - 1;
}

export function buildMonthCellDays(viewY: number, viewM: number): (null | number)[] {
  const dim = daysInMonth(viewY, viewM);
  const startPad = firstColumnOffsetMon(viewY, viewM);
  const totalCells = startPad + dim;
  const rowCount = Math.ceil(totalCells / 7);
  const cells: (null | number)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length < rowCount * 7) cells.push(null);
  return cells;
}

export function labelText(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return "Scegli una data";
  return new Date(p.y, p.m, p.d).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
