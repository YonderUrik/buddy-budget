import "server-only";
/**
 * Answers an analysis typed in «Cerca» (`AnalysisQuery`, read by «Chiedi all'AI») on one user's movements. The words of
 * the question (a category, an account) are matched to the user's own rows here, after the model is done; the model
 * never sees them or any figure.
 *
 * - Without words to look for, only dates, amounts, categories and accounts are read: plain columns, no decryption,
 *   any age (up to `ANALYSIS_ROW_LIMIT` movements).
 * - With words (a merchant) or a split by merchant, descriptions and notes are decrypted, within the same 24 months and
 *   6,000 movements as the search; an older part of the period is reported on the card.
 * - A list of movements decrypts only the few it shows.
 */

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { AnalysisQuery } from "@/lib/commands/analysis";
import { withMerchantLogos } from "@/lib/categorization/merchant-logo/attach";
import { db } from "@/lib/db/client";
import { accounts, categories, transactions } from "@/lib/db/schema";
import { movementsLink, type LiquidityLinkPeriod } from "@/lib/liquidity/links";
import { LANGUAGES, PRODUCT_COUNTRIES } from "@/lib/localization/config";
import { localizeCategory, localizedCategoryProposal } from "@/lib/localization/categories";
import { comparisonSpan, runAnalysis, type AnalysisCategory, type AnalysisResultRow, type AnalysisRow, type ResolvedFilters } from "./analysis-engine";
import { foldText, matchScore } from "./normalize";
import type { SearchAnswer, SearchHit } from "./types";

/** Most movements read for an analysis without words (plain columns): decades of a busy account. */
export const ANALYSIS_ROW_LIMIT = 60_000;

export interface AnalysisOptions {
  /** First day of the movements decrypted for words (the search window). */
  windowStart: string;
  scanLimit: number;
  today: string;
}

export interface AnalysisAnswer {
  hit: SearchHit;
  /** Whether a read stopped at its cap (for the metric). */
  capped: boolean;
}

/** The best of `items` named by `subject` (folded): exactly, or a name or a word in it starting with it. */
function bestNamed<T>(items: T[], nameOf: (item: T) => string, subject: string): T | null {
  if (subject === "") return null;
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const score = foldText(nameOf(item)) === subject ? 4 : matchScore(nameOf(item), subject);
    if (score >= 2 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

/** Names and descriptions of the default categories in every language, by key («spesa» → Spesa, Groceries, Lebensmittel, «Supermercato, alimentari…»). */
const DEFAULT_CATEGORY_WORDS: Map<string, { names: string[]; descriptions: string[] }> = (() => {
  const words = new Map<string, { names: string[]; descriptions: string[] }>();
  for (const language of LANGUAGES) {
    for (const productCountry of PRODUCT_COUNTRIES) {
      for (const entry of localizedCategoryProposal({ language, productCountry })) {
        if (!entry.key) continue;
        const known = words.get(entry.key) ?? { names: [], descriptions: [] };
        known.names.push(entry.name);
        if (entry.description) known.descriptions.push(entry.description);
        words.set(entry.key, known);
      }
    }
  }
  return words;
})();

/** Whether a word of a text and a typed word are the same word, give or take an ending («supermercati», «supermercato»). */
function sameWord(word: string, typed: string): boolean {
  if (word.startsWith(typed)) return typed.length >= 3;
  const stem = Math.max(4, Math.min(word.length, typed.length) - 2);
  return word.length >= stem && typed.length >= stem && word.slice(0, stem) === typed.slice(0, stem);
}

/** How well a category answers to `subject` (folded): its name in any language first, then the words of its description. */
function categoryScore(category: { name: string; defaultKey: string | null; description: string | null }, subject: string): number {
  const defaults = category.defaultKey ? DEFAULT_CATEGORY_WORDS.get(category.defaultKey) : undefined;
  const names = [category.name, ...(defaults?.names ?? [])];
  let best = 0;
  for (const name of names) best = Math.max(best, foldText(name) === subject ? 6 : matchScore(name, subject) >= 2 ? 3 + matchScore(name, subject) / 3 : 0);
  if (best > 0) return best;
  const typed = subject.split(" ");
  for (const text of [category.description ?? "", ...(defaults?.descriptions ?? [])]) {
    const words = foldText(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (typed.every((t) => words.some((w) => sameWord(w, t)))) return 2;
  }
  return 0;
}

/** The user's category a word names: by name (any language of a default one), else by what its description lists. */
function namedCategory<T extends { name: string; defaultKey: string | null; description: string | null }>(items: T[], subject: string): T | null {
  if (subject === "") return null;
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const score = categoryScore(item, subject);
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

/** The year or month Movimenti can open for a span, when the span is one (else the year of its end, if inside one). */
export function linkPeriod(from: string, to: string): LiquidityLinkPeriod | undefined {
  if (from.slice(0, 7) === to.slice(0, 7)) return { kind: "mese", date: from };
  if (from.slice(0, 4) === to.slice(0, 4)) return { kind: "anno", date: from };
  return undefined;
}

/** Link to Movimenti for the whole answer or one of its rows: one filter (category, account or words) and the period. */
function linkFor(filters: { categoryId?: string | null; accountId?: string | null; text?: string }, from: string, to: string): string {
  const period = linkPeriod(from, to);
  if (filters.categoryId) return movementsLink("category", filters.categoryId, period);
  if (filters.accountId) return movementsLink("account", filters.accountId, period);
  if (filters.text) return movementsLink("text", filters.text, period);
  return movementsLink(null, "", period);
}

/** What the card says it understood, by name: the user's own category and account as they are called. */
export interface AnalysisNames {
  category: string | null;
  account: string | null;
  /** An account named in the question that the user does not have (no figure then). */
  missingAccount: string | null;
}

export async function answerAnalysis(userId: string, query: AnalysisQuery, options: AnalysisOptions): Promise<AnalysisAnswer> {
  const [categoryRows, accountRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name, type: categories.type, isFallback: categories.isFallback, defaultKey: categories.defaultKey, description: categories.description }).from(categories).where(eq(categories.userId, userId)),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.userId, userId)),
  ]);
  const { filters } = query;
  const directionCategories = categoryRows.filter((c) => c.type !== "trasferimento" && (query.direction === "netto" || (query.direction === "entrate") === (c.type === "entrata")));

  // A category named by the model, or words that are one of the user's categories («ristoranti»); a category the user
  // does not have becomes words to look for («Esselunga» read as a category).
  let text = filters.text;
  let category = namedCategory(directionCategories, filters.category);
  if (!category && filters.category !== "" && text === "") text = filters.category;
  if (!category && filters.category === "" && text !== "") {
    // Only by name here: a merchant («Esselunga») must not turn into the category whose description lists its kind.
    category = bestNamed(directionCategories, (c) => c.name, text);
    if (category) text = "";
  }
  const account = bestNamed(accountRows, (a) => a.name, filters.account);
  // The category as the user's language calls it (a default one is stored in Italian).
  const categoryName = category ? localizeCategory(category, { language: query.language, productCountry: "IT" }).name : null;
  const names: AnalysisNames = { category: categoryName, account: account?.name ?? null, missingAccount: filters.account !== "" && !account ? filters.account : null };
  const resolved: ResolvedFilters = { text, categoryId: category?.id ?? null, group: filters.group, accountId: account?.id ?? null, min: filters.min, max: filters.max, days: filters.days };

  const span = query.compare ? comparisonSpan(query.from, query.to, query.compare) : null;
  const readFrom = span && span.from < query.from ? span.from : query.from;
  const readsText = text !== "" || query.groupBy === "esercente";
  const from = readsText && readFrom < options.windowStart ? options.windowStart : readFrom;
  const limit = readsText ? options.scanLimit : ANALYSIS_ROW_LIMIT;

  const [rows, [first]] = await Promise.all([
    names.missingAccount !== null || from > query.to
      ? Promise.resolve([])
      : readsText
        ? db
            .select({ id: transactions.id, date: transactions.date, amount: sql<string>`${transactions.amount} - ${transactions.excludedAmount}`, categoryId: transactions.categoryId, accountId: transactions.accountId, description: transactions.description, note: transactions.note })
            .from(transactions)
            .where(and(eq(transactions.userId, userId), gte(transactions.date, from), lte(transactions.date, query.to)))
            .orderBy(sql`${transactions.date} desc`)
            .limit(limit)
        : db
            .select({ id: transactions.id, date: transactions.date, amount: sql<string>`${transactions.amount} - ${transactions.excludedAmount}`, categoryId: transactions.categoryId, accountId: transactions.accountId })
            .from(transactions)
            .where(and(eq(transactions.userId, userId), gte(transactions.date, from), lte(transactions.date, query.to)))
            .orderBy(sql`${transactions.date} desc`)
            .limit(limit),
    db.select({ date: transactions.date }).from(transactions).where(eq(transactions.userId, userId)).orderBy(asc(transactions.date)).limit(1),
  ]);
  const capped = rows.length >= limit;
  const engineRows: AnalysisRow[] = rows.map((row) => ({ ...row, amount: Number(row.amount) }));
  const result = runAnalysis(engineRows, query, resolved, {
    categories: new Map<string, AnalysisCategory>(categoryRows.map((c) => [c.id, { name: localizeCategory(c, { language: query.language, productCountry: "IT" }).name, type: c.type, isFallback: c.isFallback }])),
    accounts: new Map(accountRows.map((a) => [a.id, a.name])),
    firstDay: first?.date ?? null,
    today: options.today,
    textFrom: readsText ? options.windowStart : null,
  });
  if (capped && readsText) result.partial = true;

  // Movements shown by a list: their text, decrypted for these few only when it was not read already.
  const shownIds = result.rowsKind === "movimenti" ? result.rows.map((row) => row.movementId!).filter(Boolean) : [];
  const texts = new Map<string, { description: string; rawDescription: string | null }>();
  if (shownIds.length > 0) {
    const found = await db.select({ id: transactions.id, description: transactions.description, rawDescription: transactions.rawDescription }).from(transactions).where(and(eq(transactions.userId, userId), inArray(transactions.id, shownIds)));
    for (const row of found) texts.set(row.id, row);
  }
  const isExpense = query.direction !== "entrate";
  const withLabels = result.rows.map((row) => (row.movementId ? { ...row, label: texts.get(row.movementId)?.description ?? row.label } : row));
  // Merchant logos for rows that are a merchant or a movement, as Movimenti shows them.
  const withLogos = await withMerchantLogos(
    withLabels,
    (row) => (row.movementId || row.text !== undefined ? { label: row.label, texts: [row.movementId ? (texts.get(row.movementId)?.rawDescription ?? null) : null], isExpense } : { label: "", texts: [], isExpense }),
    userId
  );
  const linked = withLogos.map((row: AnalysisResultRow & { logoPath: string | null }) => ({
    ...row,
    logoPath: row.movementId || row.text !== undefined ? row.logoPath : null,
    href: row.movementId ? undefined : linkFor({ categoryId: row.categoryId ?? resolved.categoryId, accountId: row.accountId ?? resolved.accountId, text: row.text ?? resolved.text }, row.from ?? query.from, row.to ?? query.to),
  }));

  const answer: SearchAnswer = { kind: "analisi", source: "ai", query, result: { ...result, rows: linked }, names };
  return {
    hit: {
      key: "risposte:analisi",
      group: "risposte",
      icon: "totale",
      title: "",
      amount: result.value === null || result.unit === "volte" ? undefined : result.value,
      href: linkFor({ categoryId: resolved.categoryId, accountId: resolved.accountId, text: resolved.text }, query.from, query.to),
      answer,
      score: 3,
    },
    capped,
  };
}
