/** Separatore dei decimali: `.` (1,234.56 come Yahoo e i broker USA) o `,` (1.234,56 come i broker italiani). */
export const DECIMAL_SEPARATORS = [".", ","] as const;
export type DecimalSeparator = (typeof DECIMAL_SEPARATORS)[number];

/** Ordine di giorno, mese e anno in una data. Il separatore (/, -, ., nessuno) si riconosce da solo. */
export const DATE_ORDERS = ["ymd", "dmy", "mdy"] as const;
export type DateOrder = (typeof DATE_ORDERS)[number];

/**
 * Converte un numero scritto come stringa: toglie spazi, simboli di valuta e sigle ("€", "EUR"), il separatore
 * delle migliaia, e accetta la notazione scientifica (`3.0E-4`, come nei CSV di Yahoo). Null se non è un numero.
 */
export function parseNumber(raw: string, decimal: DecimalSeparator): number | null {
  let text = raw.trim().replace(/[\s '€$£]/g, "").replace(/^[A-Z]{3}|[A-Z]{3}$/g, "");
  if (text === "" || text === "-") return null;
  if (/^\(.*\)$/.test(text)) text = `-${text.slice(1, -1)}`;
  const thousands = decimal === "." ? "," : ".";
  text = text.split(thousands).join("");
  if (decimal === ",") text = text.replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * Separatore dei decimali di una colonna. La virgola vince se compare seguita da un numero di cifre diverso da tre
 * (`12,5`) o dopo un punto (`1.234,56`); il punto vince nei casi simmetrici. Senza indizi (`1.000`): `fallback`.
 */
export function detectDecimalSeparator(values: string[], fallback: DecimalSeparator = "."): DecimalSeparator {
  let comma = 0;
  let dot = 0;
  for (const raw of values) {
    const v = raw.replace(/[^\d.,]/g, "");
    const lastComma = v.lastIndexOf(",");
    const lastDot = v.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) comma += 1;
      else dot += 1;
    } else if (lastComma >= 0) {
      if (v.length - lastComma - 1 !== 3) comma += 1;
    } else if (lastDot >= 0) {
      if (v.length - lastDot - 1 !== 3 || /^0\./.test(v)) dot += 1;
    }
  }
  if (comma === dot) return fallback;
  return comma > dot ? "," : ".";
}

function isValidDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Converte una data nel formato `YYYY-MM-DD` secondo l'ordine indicato. Accetta separatori `/`, `-`, `.`, nessun
 * separatore (`20260105`), anni a due cifre (`05/01/26` → 2026) e un orario in coda, che si ignora. Null se non è valida.
 */
export function parseDate(raw: string, order: DateOrder): string | null {
  const text = raw.trim().split(/[T\s]/)[0];
  let parts: string[];
  if (/^\d{8}$/.test(text)) {
    parts = order === "ymd" ? [text.slice(0, 4), text.slice(4, 6), text.slice(6)] : [text.slice(0, 2), text.slice(2, 4), text.slice(4)];
  } else {
    parts = text.split(/[/.-]/);
  }
  if (parts.length !== 3 || parts.some((p) => !/^\d{1,4}$/.test(p))) return null;
  const [a, b, c] = parts.map(Number);
  const [year, month, day] = order === "ymd" ? [a, b, c] : order === "dmy" ? [c, b, a] : [c, a, b];
  const fullYear = year < 100 ? 2000 + year : year;
  if (fullYear < 1900 || fullYear > 2200 || !isValidDay(fullYear, month, day)) return null;
  return `${fullYear}-${pad(month)}-${pad(day)}`;
}

/**
 * Ordine delle date di una colonna: quello che ne legge di più. A parità vince giorno/mese/anno (uso italiano)
 * su mese/giorno/anno, che si sceglie solo se qualche data lo rende l'unico possibile (`12/31/2026`).
 */
export function detectDateOrder(values: string[]): DateOrder {
  let best: { order: DateOrder; count: number } = { order: "dmy", count: -1 };
  for (const order of ["dmy", "ymd", "mdy"] as const) {
    const count = values.filter((v) => parseDate(v, order) !== null).length;
    if (count > best.count) best = { order, count };
  }
  return best.order;
}
