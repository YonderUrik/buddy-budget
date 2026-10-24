/**
 * Server side of the app-wide search: one query per kind of thing, all for one user, run in parallel and each with its
 * own small limit, so a search costs a fixed handful of cheap queries whatever the user has.
 *
 * Names in plain text (accounts, categories, debts, subscriptions, pension funds, securities) are matched in SQL with
 * `ILIKE` on the user's own rows: tens of rows per user, the `user_id` filter does the work. Movement descriptions and
 * notes and goal names are encrypted in the database (random IV), so SQL cannot match them: they are read for one user
 * in a bounded window, decrypted and matched here. Amounts are plain numbers and are matched exactly in SQL.
 */

import { and, desc, eq, gte, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts, categories, debts, goals, pensionFunds, subscriptions, transactions } from "@/lib/db/schema";
import { searchKnownInstruments } from "@/lib/investments/instruments";
import { foldText, matchScore, parseAmountQuery } from "./normalize";
import type { SearchHit, SearchResponse } from "./types";

/** Movements read for the text match: the last two years (older ones: «Cerca in tutto lo storico» in Movimenti). */
export const MOVEMENT_WINDOW_MONTHS = 24;
/** Hard cap on movements decrypted per search, whatever the window holds. */
export const MOVEMENT_SCAN_LIMIT = 6000;
/** Results per group: enough to recognise the thing, never a full list (that is the section's job). */
const LIMITS = { movimenti: 5, conti: 3, titoli: 4, categorie: 3, abbonamenti: 3, debiti: 2, obiettivi: 2, pensione: 2 } as const;

const like = (query: string) => `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

function windowStart(now: Date): string {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MOVEMENT_WINDOW_MONTHS, 1));
  return start.toISOString().slice(0, 10);
}

/** Movements whose description or note contains the query (decrypted here), newest first, plus exact amounts. */
async function searchMovements(userId: string, query: string, now: Date): Promise<{ hits: SearchHit[]; more: number }> {
  const folded = foldText(query);
  const amount = parseAmountQuery(query);
  const [rows, byAmount] = await Promise.all([
    db
      .select({ id: transactions.id, date: transactions.date, amount: transactions.amount, description: transactions.description, note: transactions.note, account: accounts.name })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(and(eq(transactions.userId, userId), gte(transactions.date, windowStart(now))))
      .orderBy(desc(transactions.date))
      .limit(MOVEMENT_SCAN_LIMIT),
    amount === null
      ? Promise.resolve([])
      : db
          .select({ id: transactions.id, date: transactions.date, amount: transactions.amount, description: transactions.description, note: transactions.note, account: accounts.name })
          .from(transactions)
          .innerJoin(accounts, eq(accounts.id, transactions.accountId))
          .where(and(eq(transactions.userId, userId), sql`abs(${transactions.amount}) = ${amount}`))
          .orderBy(desc(transactions.date))
          .limit(LIMITS.movimenti),
  ]);
  // The same merchant month after month is one row («Netflix · 13 movimenti»), not thirteen: the newest one leads it.
  const groups = new Map<string, { row: (typeof rows)[number]; score: number; count: number }>();
  const seen = new Set<string>();
  const candidates = [
    ...byAmount.map((row) => ({ row, score: 3, key: `amount:${row.id}` })),
    ...rows.map((row) => ({ row, score: Math.max(matchScore(row.description, folded), matchScore(row.note ?? "", folded) > 0 ? 1 : 0), key: foldText(row.description) })),
  ];
  for (const { row, score, key } of candidates) {
    if (score === 0 || seen.has(row.id)) continue;
    seen.add(row.id);
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { row, score, count: 1 });
  }
  const ordered = [...groups.values()];
  const hits = ordered.slice(0, LIMITS.movimenti).map<SearchHit>(({ row, score, count }) => ({
    key: `movimenti:${row.id}`,
    group: "movimenti",
    icon: "movimento",
    title: row.description,
    date: row.date,
    count,
    account: row.account,
    amount: Number(row.amount),
    href: count > 1 ? `/liquidita?cerca=${encodeURIComponent(row.description)}` : `/liquidita?movimento=${row.id}`,
    score,
  }));
  const shown = ordered.slice(0, LIMITS.movimenti).reduce((sum, g) => sum + g.count, 0);
  return { hits, more: Math.max(0, seen.size - shown) };
}

/** Every group for one user and query, in parallel; each group is limited, the palette orders them. */
export async function searchEverything(userId: string, query: string, now = new Date()): Promise<SearchResponse> {
  const started = performance.now();
  const q = like(query.trim());
  const folded = foldText(query);
  const [movements, accountRows, instrumentRows, categoryRows, subscriptionRows, debtRows, goalRows, pensionRows] = await Promise.all([
    searchMovements(userId, query, now),
    db.select({ id: accounts.id, name: accounts.name, balance: accounts.balance, type: accounts.type }).from(accounts).where(and(eq(accounts.userId, userId), ilike(accounts.name, q))).limit(LIMITS.conti),
    searchKnownInstruments(userId, query.trim(), LIMITS.titoli),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(and(eq(categories.userId, userId), ilike(categories.name, q))).limit(LIMITS.categorie),
    db.select({ id: subscriptions.id, name: subscriptions.name, amount: subscriptions.amount, cadence: subscriptions.cadence }).from(subscriptions).where(and(eq(subscriptions.userId, userId), ne(subscriptions.status, "escluso"), ilike(subscriptions.name, q))).limit(LIMITS.abbonamenti),
    db.select({ id: debts.id, name: debts.name }).from(debts).where(and(eq(debts.userId, userId), ilike(debts.name, q))).limit(LIMITS.debiti),
    // Goal names are encrypted: a user has a handful, all read and matched here.
    db.select({ id: goals.id, name: goals.name }).from(goals).where(eq(goals.userId, userId)),
    db.select({ id: pensionFunds.id, name: pensionFunds.name }).from(pensionFunds).where(and(eq(pensionFunds.userId, userId), or(ilike(pensionFunds.name, q)))).limit(LIMITS.pensione),
  ]);
  const hits: SearchHit[] = [
    ...movements.hits,
    ...accountRows.map<SearchHit>((a) => ({ key: `conti:${a.id}`, group: "conti", icon: "conto", title: a.name, subtitle: "Conto", amount: Number(a.balance), href: `/liquidita?conto=${a.id}`, score: matchScore(a.name, folded) })),
    ...instrumentRows.map<SearchHit>((i) => ({ key: `titoli:${i.id}`, group: "titoli", icon: "titolo", title: i.name, subtitle: [i.isin, i.currency].filter(Boolean).join(" · "), href: `/investimenti/titoli/${i.id}`, score: Math.max(1, matchScore(i.name, folded), i.isin?.toLowerCase() === folded ? 3 : 0) })),
    ...categoryRows.map<SearchHit>((c) => ({ key: `categorie:${c.id}`, group: "categorie", icon: "categoria", title: c.name, subtitle: "Categoria · movimenti del mese", href: `/liquidita?categoria=${c.id}`, score: matchScore(c.name, folded) })),
    ...subscriptionRows.map<SearchHit>((s) => ({ key: `abbonamenti:${s.id}`, group: "abbonamenti", icon: "abbonamento", title: s.name ?? "", subtitle: `Abbonamento ${s.cadence ?? ""}`.trim(), amount: s.amount === null ? undefined : -Math.abs(Number(s.amount)), href: "/liquidita/abbonamenti", score: matchScore(s.name ?? "", folded) })),
    ...debtRows.map<SearchHit>((d) => ({ key: `debiti:${d.id}`, group: "debiti", icon: "debito", title: d.name, subtitle: "Debito", href: `/debiti/finanziamenti?id=${d.id}`, score: matchScore(d.name, folded) })),
    ...goalRows
      .map((g) => ({ g, score: matchScore(g.name, folded) }))
      .filter((x) => x.score > 0)
      .slice(0, LIMITS.obiettivi)
      .map<SearchHit>(({ g, score }) => ({ key: `obiettivi:${g.id}`, group: "obiettivi", icon: "obiettivo", title: g.name, subtitle: "Obiettivo", href: `/analitiche/obiettivi/${g.id}`, score })),
    ...pensionRows.map<SearchHit>((p) => ({ key: `pensione:${p.id}`, group: "pensione", icon: "pensione", title: p.name, subtitle: "Fondo pensione", href: "/pensione", score: matchScore(p.name, folded) })),
  ];
  return { hits, moreMovements: movements.more, tookMs: Math.round(performance.now() - started) };
}
