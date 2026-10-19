/**
 * Reads the bank's own category column («Categoria», «Category», «Kategorie», Fineco's «Moneymap») straight from the
 * raw file, without AI, for cash rows the parser left without one. It covers formats whose parser was written before
 * the parser learnt to return `bankCategory`, and parsers that miss it. Pure: works on the preserved file lines.
 */
import { cleanBankCategory, normalizeBankCategory } from "@/lib/categorization/bank-category";
import type { Outcome, PersonalTable } from "./contract";

/** Header names of a bank category column, normalised. A subcategory, when present, is more specific. */
const CATEGORY_HEADERS = new Set(["categoria", "category", "kategorie", "categoria movimento", "categoria spesa", "macro categoria", "macrocategoria", "moneymap", "spending category", "umsatzkategorie"]);
const SUBCATEGORY_HEADERS = new Set(["sottocategoria", "sotto categoria", "subcategory", "sub category", "unterkategorie"]);
const DELIMITERS = [";", ",", "\t", "|"] as const;
/** Header lines are looked for only near the top: preambles are short. */
const HEADER_SEARCH_LINES = 200;

/** Splits one CSV line on `delimiter`, honouring double quotes ("" is a literal quote). */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.trim() === "") { quoted = true; cell = ""; }
    else if (char === delimiter) { cells.push(cell.trim()); cell = ""; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

interface CategoryColumns {
  line: number;
  delimiter: string;
  width: number;
  category: number;
  subcategory: number | null;
}

/** First line that looks like a header with a category column, with its delimiter and column positions. */
export function findCategoryColumns(lines: readonly string[]): CategoryColumns | null {
  for (let line = 0; line < Math.min(lines.length, HEADER_SEARCH_LINES); line += 1) {
    for (const delimiter of DELIMITERS) {
      if (!lines[line].includes(delimiter)) continue;
      const headers = splitCsvLine(lines[line], delimiter).map(normalizeBankCategory);
      if (headers.length < 3) continue;
      const category = headers.findIndex((header) => CATEGORY_HEADERS.has(header));
      if (category < 0) continue;
      const subcategory = headers.findIndex((header) => SUBCATEGORY_HEADERS.has(header));
      return { line, delimiter, width: headers.length, category, subcategory: subcategory < 0 ? null : subcategory };
    }
  }
  return null;
}

/**
 * Cash outcomes with `bankCategory` filled from the file's category column when the parser gave none. Only lines
 * below the header with as many cells as the header are read (a multi-line record or another section is left alone),
 * and the value goes through the same cleaning as the parser's. Other outcomes are returned untouched.
 */
export function fillBankCategories(outcomes: readonly Outcome[], table: Pick<PersonalTable, "rows">): Outcome[] {
  if (!outcomes.some((outcome) => outcome.kind === "cash" && !outcome.bankCategory)) return [...outcomes];
  const lines = table.rows.map((row) => row[0] ?? "");
  const columns = findCategoryColumns(lines);
  if (!columns) return [...outcomes];
  return outcomes.map((outcome) => {
    if (outcome.kind !== "cash" || outcome.bankCategory || outcome.row <= columns.line) return outcome;
    const cells = splitCsvLine(lines[outcome.row] ?? "", columns.delimiter);
    if (cells.length !== columns.width) return outcome;
    const main = cleanBankCategory(cells[columns.category]);
    const sub = columns.subcategory === null ? null : cleanBankCategory(cells[columns.subcategory]);
    const label = cleanBankCategory(main && sub && sub !== main ? `${main} > ${sub}` : main ?? sub);
    return label ? { ...outcome, bankCategory: label } : outcome;
  });
}
