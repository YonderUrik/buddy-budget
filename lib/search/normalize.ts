/**
 * Text matching for the app-wide search: accent- and case-insensitive, so «liquidita» finds «Liquidità» and «ETF» finds
 * «etf». Pure functions, shared by the static index (client) and the server groups.
 */

/** Lower case without accents and with single spaces. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * How well `text` matches `query` (already folded): 3 when the text starts with it, 2 when a word starts with it, 1 when
 * it is inside a word, 0 when every word of the query is not found. A query of several words matches when each word does.
 */
export function matchScore(text: string, query: string): number {
  if (query === "") return 0;
  const folded = foldText(text);
  if (folded.startsWith(query)) return 3;
  const words = query.split(" ");
  let worst = 3;
  for (const word of words) {
    const at = folded.indexOf(word);
    if (at < 0) return 0;
    const score = at === 0 || folded[at - 1] === " " ? 2 : 1;
    worst = Math.min(worst, score);
  }
  return worst;
}

/** Ranges of `text` to highlight for `query` (folded), for bold matches in the results. Same length as the text, since folding removes only combining marks. */
export function matchRanges(text: string, query: string): Array<[start: number, end: number]> {
  if (query === "") return [];
  const plain = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("it");
  if (plain.length !== text.length) return [];
  const ranges: Array<[number, number]> = [];
  for (const word of query.split(" ")) {
    const at = plain.indexOf(word);
    if (at >= 0) ranges.push([at, at + word.length]);
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

/** The query as an amount («45,90», «1.200», «45.9 €») or null: amounts are searched exactly, in SQL. */
export function parseAmountQuery(query: string): number | null {
  const cleaned = query.replace(/[€\s]/g, "");
  if (!/^-?\d{1,3}([.]\d{3})*(,\d{1,2})?$|^-?\d+([.,]\d{1,2})?$/.test(cleaned)) return null;
  const normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(cleaned) ? cleaned.replace(/\./g, "") : cleaned.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) && value !== 0 ? Math.abs(value) : null;
}
