import "server-only";
/**
 * Answers in «Cerca» to questions about the user's own data: «soldi spesi su Serenis nel 2026», «spese di ottobre»,
 * «saldo Fineco», «patrimonio», «quanto vale Apple», «prossima rata». The rules (`lib/commands/question.ts`) or, on a
 * tap, the model turn the sentence into a `DataQuestion`; the figure is computed here from the user's rows with the same
 * loaders and sums as Movimenti, the sidebar and the Panoramica chart, so it matches the screen its link opens. Nothing
 * computed here is sent to a model.
 *
 * - Totals by words: movements of the period are read for one user, decrypted (descriptions are encrypted) and matched
 *   like the text filter of Movimenti, within the same 24 months and 6,000 rows as the search; an older part is reported.
 * - Totals by category («ristoranti») or without words («spese di ottobre»): one SQL sum over the whole period, any age.
 * - Amounts are the effective ones, after «Dividi» (`amount - excluded_amount`), like the totals in Movimenti.
 */

import { and, desc, eq, gt, gte, lt, lte, sql } from "drizzle-orm";
import type { BalanceQuestion, DataQuestion, NetWorthQuestion, PortfolioQuestion, TotalQuestion } from "@/lib/commands/question";
import { withMerchantLogos } from "@/lib/categorization/merchant-logo/attach";
import { db } from "@/lib/db/client";
import { accounts, categories, instruments, transactions } from "@/lib/db/schema";
import { movementsLink } from "@/lib/liquidity/links";
import { loadNetWorthSnapshotRows } from "@/lib/net-worth/snapshot-rows";
import { loadSidebarDeadlines } from "@/lib/sidebar/deadlines";
import { loadSidebarSummary } from "@/lib/sidebar/summary";
import { foldText, matchScore } from "./normalize";
import type { SearchAnswer, SearchHit } from "./types";

/** Days looked back from a past day for the last net worth the history holds (the daily snapshot may be missing one day). */
const NET_WORTH_LOOKBACK_DAYS = 7;
/** Net worth classes recomputed on every read, present on every day: a day counts only when a stored class is there too. */
const DERIVED_CLASSES = new Set(["debiti", "previdenza"]);

export interface AnswerOptions {
  /** First day of the movements decrypted for a text match (the search window). */
  windowStart: string;
  scanLimit: number;
  source: SearchAnswer["source"];
  now?: Date;
}

export interface QuestionAnswer {
  /** The answer row, first in the palette; null when the question names something the user does not have. */
  hit: SearchHit | null;
  /** Whether the movement scan stopped at its cap (for the metric). */
  capped: boolean;
}

type AnswerHit = Omit<SearchHit, "key" | "group" | "score" | "answer"> & { answer: SearchAnswer };
const answerHit = ({ answer, ...rest }: AnswerHit): SearchHit => ({ key: `risposte:${answer.kind}`, group: "risposte", score: 3, answer, ...rest });
/** Cents: sums of many decimals drift («139.89999999999998»), and no «-0 €». */
const cents = (value: number) => Math.round(value * 100) / 100 || 0;
const capitalised = (value: string) => value.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("it"));
const shiftDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** The best of `items` named by `subject` (folded): a name or a word in it starting with it, else null. */
function bestNamed<T>(items: T[], nameOf: (item: T) => string, subject: string): T | null {
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const score = foldText(nameOf(item)) === subject ? 4 : matchScore(nameOf(item), subject);
    if (score >= 2 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

/** How much went out or came in over a period: for a category, for words in the movements, or for all of them. */
async function answerTotal(userId: string, question: TotalQuestion, options: AnswerOptions): Promise<QuestionAnswer> {
  const { period, direction, subject } = question;
  const sign = direction === "uscite" ? lt(transactions.amount, "0") : gt(transactions.amount, "0");
  const inPeriod = and(eq(transactions.userId, userId), sign, lte(transactions.date, period.to));
  const effective = sql`abs(${transactions.amount} - ${transactions.excludedAmount})`;
  const sum = async (where: ReturnType<typeof and>) => {
    // A transfer between one's own accounts is excluded in full by «Dividi»: it adds nothing and is not counted.
    const [row] = await db
      .select({ total: sql<string>`coalesce(sum(${effective}), 0)`, count: sql<number>`count(*) filter (where ${transactions.amount} <> ${transactions.excludedAmount})::int` })
      .from(transactions)
      .where(where);
    return { total: Number(row?.total ?? 0), count: row?.count ?? 0 };
  };
  const answer = (title: string, total: number, count: number, extra: { category: boolean; partial: boolean }, rest: Partial<AnswerHit>): SearchHit =>
    answerHit({ icon: "totale", title, amount: cents(direction === "uscite" ? -total : total), answer: { kind: "totale", source: options.source, direction, period, count, ...extra }, ...rest });

  if (subject === "") {
    const { total, count } = await sum(and(inPeriod, gte(transactions.date, period.from)));
    return { hit: answer("", total, count, { category: false, partial: false }, { href: movementsLink(null, "", { kind: period.kind, date: period.from }) }), capped: false };
  }

  const userCategories = await db.select({ id: categories.id, name: categories.name, type: categories.type }).from(categories).where(eq(categories.userId, userId));
  const category = bestNamed(userCategories.filter((c) => (direction === "entrate" ? c.type === "entrata" : c.type !== "entrata")), (c) => c.name, subject);
  if (category) {
    const { total, count } = await sum(and(inPeriod, gte(transactions.date, period.from), eq(transactions.categoryId, category.id)));
    return {
      hit: answer(category.name, total, count, { category: true, partial: false }, { icon: "categoria", href: movementsLink("category", category.id, { kind: period.kind, date: period.from }) }),
      capped: false,
    };
  }

  const from = period.from < options.windowStart ? options.windowStart : period.from;
  const rows = from > period.to
    ? []
    : await db
        .select({ description: transactions.description, rawDescription: transactions.rawDescription, note: transactions.note, amount: transactions.amount, excluded: transactions.excludedAmount })
        .from(transactions)
        .where(and(inPeriod, gte(transactions.date, from)))
        .orderBy(desc(transactions.date))
        .limit(options.scanLimit);
  const capped = rows.length >= options.scanLimit;
  // The same rule as the text filter of Movimenti (the words, together, inside the description or the note), so the
  // count matches the list its link opens.
  const matched = rows.filter((row) => foldText(row.description).includes(subject) || foldText(row.note ?? "").includes(subject)).filter((row) => Number(row.amount) !== Number(row.excluded));
  const total = matched.reduce((acc, row) => acc + Math.abs(Number(row.amount) - Number(row.excluded)), 0);
  const newest = matched[0];
  // The name as Movimenti shows it when the movements carry just that («Serenis»), what was typed otherwise.
  const title = newest && foldText(newest.description) === subject ? newest.description : capitalised(subject);
  const [{ logoPath }] = newest
    ? await withMerchantLogos([newest], (row) => ({ label: row.description, texts: [row.rawDescription], isExpense: direction === "uscite" }), userId)
    : [{ logoPath: null }];
  return {
    hit: answer(title, total, matched.length, { category: false, partial: period.from < options.windowStart || capped }, { logoPath, href: movementsLink("text", subject, { kind: period.kind, date: period.from }) }),
    capped,
  };
}

/** Balance of one account named in the question, or of all of them. */
async function answerBalance(userId: string, question: BalanceQuestion, source: SearchAnswer["source"]): Promise<QuestionAnswer> {
  const rows = await db.select({ id: accounts.id, name: accounts.name, balance: accounts.balance }).from(accounts).where(eq(accounts.userId, userId));
  if (question.subject === "") {
    const total = rows.reduce((acc, row) => acc + Number(row.balance), 0);
    return { hit: answerHit({ icon: "conto", title: "", amount: cents(total), href: "/liquidita/conti", answer: { kind: "saldo", source, accounts: rows.length } }), capped: false };
  }
  const account = bestNamed(rows, (row) => row.name, question.subject);
  if (!account) return { hit: null, capped: false };
  return { hit: answerHit({ icon: "conto", title: account.name, amount: Number(account.balance), href: movementsLink("account", account.id), answer: { kind: "saldo", source, accounts: 1 } }), capped: false };
}

/** Net worth on a past day, as the Panoramica chart draws it: the last day of the history on or before it, all classes summed. */
async function netWorthOn(userId: string, date: string): Promise<number | null> {
  const rows = await loadNetWorthSnapshotRows(userId, shiftDays(date, -NET_WORTH_LOOKBACK_DAYS), date);
  const day = rows.filter((row) => !DERIVED_CLASSES.has(row.assetClass)).reduce<string | null>((latest, row) => (latest === null || row.date > latest ? row.date : latest), null);
  if (day === null) return null;
  return rows.filter((row) => row.date === day).reduce((acc, row) => acc + Number(row.amount), 0);
}

/** Net worth today (the sidebar's figure) or on a past day. */
async function answerNetWorth(userId: string, question: NetWorthQuestion, source: SearchAnswer["source"], now: Date): Promise<QuestionAnswer> {
  const today = now.toISOString().slice(0, 10);
  const past = question.date !== null && question.date < today ? question.date : null;
  const total = past ? await netWorthOn(userId, past) : ((await loadSidebarSummary(userId)).netWorth?.total ?? null);
  return {
    hit: answerHit({ icon: "panoramica", title: "", amount: total === null ? undefined : cents(total), href: "/panoramica", answer: { kind: "patrimonio", source, date: past, missing: total === null } }),
    capped: false,
  };
}

/** Value and gain of the portfolio, or of one security held. */
async function answerPortfolio(userId: string, question: PortfolioQuestion, source: SearchAnswer["source"]): Promise<QuestionAnswer> {
  const { portfolio } = await loadSidebarSummary(userId);
  if (question.subject === "") {
    return {
      hit: answerHit({
        icon: "titolo",
        title: "",
        amount: portfolio ? cents(portfolio.totalValue) : undefined,
        href: "/investimenti",
        answer: { kind: "portafoglio", source, gain: portfolio ? cents(portfolio.totalGain) : null, positions: portfolio?.holdings.length ?? 0 },
      }),
      capped: false,
    };
  }
  const holding = bestNamed(portfolio?.holdings ?? [], (h) => `${h.name} ${h.label}`, question.subject) ?? bestNamed(portfolio?.holdings ?? [], (h) => h.label, question.subject);
  if (!holding) return { hit: null, capped: false };
  // The security's own icon, as on its row under «Titoli»; the id comes from the user's own holdings.
  const [instrument] = await db.select().from(instruments).where(eq(instruments.id, holding.instrumentId)).limit(1);
  return {
    hit: answerHit({
      icon: "titolo",
      title: holding.name,
      instrument,
      amount: holding.value === null ? undefined : cents(holding.value),
      href: `/investimenti/titoli/${holding.instrumentId}`,
      answer: { kind: "portafoglio", source, gain: holding.gain === null ? null : cents(holding.gain), positions: 1 },
    }),
    capped: false,
  };
}

/** The next loan or mortgage instalment, from the same list as «Prossime scadenze». */
async function answerInstalment(userId: string, source: SearchAnswer["source"]): Promise<QuestionAnswer> {
  const next = (await loadSidebarDeadlines(userId)).items.find((item) => item.kind === "rata");
  return {
    hit: answerHit({
      icon: "debito",
      title: next?.label ?? "",
      amount: next?.amount === null || next?.amount === undefined ? undefined : -Math.abs(next.amount),
      href: next?.href ?? "/debiti",
      answer: { kind: "rata", source, date: next?.date ?? null, overdue: next?.overdue ?? false },
    }),
    capped: false,
  };
}

/** The answer row for `question`, computed from the user's own rows only. */
export async function answerQuestion(userId: string, question: DataQuestion, options: AnswerOptions): Promise<QuestionAnswer> {
  switch (question.kind) {
    case "totale":
      return answerTotal(userId, question, options);
    case "saldo":
      return answerBalance(userId, question, options.source);
    case "patrimonio":
      return answerNetWorth(userId, question, options.source, options.now ?? new Date());
    case "portafoglio":
      return answerPortfolio(userId, question, options.source);
    case "rata":
      return answerInstalment(userId, options.source);
  }
}
