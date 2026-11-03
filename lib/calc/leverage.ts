/**
 * Leverage on a broker account (Interactive Brokers margin): the cash of the account day by day rebuilt from its
 * statements, the loan (negative cash) and what it is worth against the securities, the debit interest paid, how far the
 * securities can fall before the loan reaches the maintenance margin, and the flows that turn the securities' return
 * into the return on the user's own capital. Pure: the statements come already compacted by the server.
 */

import { convertAmount, type FxTable } from "./fx";
import type { DailyFlow } from "./returns";

/** Under this an amount counts as zero. */
const AMOUNT_EPSILON = 1e-6;
const DAYS_PER_YEAR = 365;
/** Maintenance margin used when the user has not set one: IBKR's usual requirement on stocks and ETFs. */
export const DEFAULT_MAINTENANCE_MARGIN = 0.25;

export interface CurrencyAmount { currency: string; amount: number }

/** One day's cash movement of a statement, summed by currency and kind. `deposit` comes from outside, `interest` is debit interest. */
export interface LeverageMove { date: string; currency: string; amount: number; kind: "deposit" | "interest" | "other" }

/** A statement reduced to what leverage needs: balances at both ends and the movements in between. */
export interface LeverageStatement { from: string; to: string; opening: CurrencyAmount[]; closing: CurrencyAmount[]; moves: LeverageMove[] }

/** A broker account whose statements carry its whole cash ledger (today Interactive Brokers). */
export interface LeverageSource {
  accountId: string;
  accountKey: string;
  provider: string;
  name: string;
  /** Statements in date order, contiguous (the import refuses gaps and overlaps). */
  statements: LeverageStatement[];
}

/** Cash of one or more sources on each of `dates` (sorted, user currency), with the deposits and the debit interest of that day. */
export interface CashSeries {
  cash: number[];
  /** Positive = money paid in, negative = money taken out. */
  deposits: number[];
  /** Debit interest of the day as a positive cost. */
  interest: number[];
  /** Sum of the negative balances of each currency (what accrues interest), as a positive amount. */
  borrowed: number[];
  /** True when a currency had no rate on some day (its balance then counts as zero). */
  missingFx: boolean;
}

type Event = { date: string; order: 0 | 1 | 2; apply: (balances: Map<string, number>) => void; move?: LeverageMove };

function timeline(source: LeverageSource): Event[] {
  const events: Event[] = [];
  const set = (amounts: CurrencyAmount[]) => (balances: Map<string, number>) => {
    balances.clear();
    for (const a of amounts) balances.set(a.currency, a.amount);
  };
  for (const s of source.statements) {
    // The opening resyncs the balances at the start of the first day, the closing at the end of the last one.
    events.push({ date: s.from, order: 0, apply: set(s.opening) });
    for (const m of s.moves) events.push({ date: m.date, order: 1, move: m, apply: (b) => b.set(m.currency, (b.get(m.currency) ?? 0) + m.amount) });
    events.push({ date: s.to, order: 2, apply: set(s.closing) });
  }
  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));
}

/**
 * Cash of the sources at the end of each day. Before the first statement the account holds its first opening (zero for
 * an IBKR history imported from the start); after the last one it holds the last closing.
 */
export function buildCashSeries(sources: LeverageSource[], fx: FxTable, userCurrency: string, dates: string[]): CashSeries {
  const out: CashSeries = { cash: dates.map(() => 0), deposits: dates.map(() => 0), interest: dates.map(() => 0), borrowed: dates.map(() => 0), missingFx: false };
  const convert = (amount: number, currency: string, date: string) => {
    if (Math.abs(amount) < AMOUNT_EPSILON) return 0;
    const value = convertAmount(fx, amount, currency, userCurrency, date);
    if (value === null) { out.missingFx = true; return 0; }
    return value;
  };
  for (const source of sources) {
    if (!source.statements.length) continue;
    const events = timeline(source);
    const balances = new Map(source.statements[0].opening.map((a) => [a.currency, a.amount]));
    let next = 0;
    dates.forEach((date, i) => {
      while (next < events.length && events[next].date <= date) {
        const event = events[next];
        event.apply(balances);
        // Only the day's own movements count as that day's deposits and interest; earlier ones are already in the balance.
        if (event.move && event.date === date) {
          if (event.move.kind === "deposit") out.deposits[i] += convert(event.move.amount, event.move.currency, date);
          if (event.move.kind === "interest") out.interest[i] -= convert(event.move.amount, event.move.currency, date);
        }
        next += 1;
      }
      for (const [currency, amount] of balances) {
        const value = convert(amount, currency, date);
        out.cash[i] += value;
        if (value < 0) out.borrowed[i] -= value;
      }
    });
  }
  return out;
}

/** Every calendar day from `fromKey` to `toKey`, both included. */
export function eachDay(fromKey: string, toKey: string): string[] {
  const days: string[] = [];
  for (let d = new Date(`${fromKey}T00:00:00Z`); d.toISOString().slice(0, 10) <= toKey; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  return days;
}

function shiftDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Leverage of one broker account today. Amounts in the user currency; the loan is positive. */
export interface BrokerLeverage {
  accountId: string;
  provider: string;
  name: string;
  /** End date of the last statement: the cash and the loan are as of that day. */
  statementDate: string;
  securities: number;
  /** Net cash (all currencies, today's rates): negative when the account borrows. */
  netCash: number;
  /** Positive part of −netCash. */
  loan: number;
  /** Securities + net cash. */
  equity: number;
  /** Securities ÷ own capital, null when the capital is zero or negative. */
  ratio: number | null;
  /** Loan ÷ securities, null without securities. */
  loanToValue: number | null;
  /** Closing balances of the last statement, native currency, largest debt first. */
  balances: CurrencyAmount[];
  interest: {
    /** Debit interest by calendar year, as a positive cost. */
    byYear: { year: number; amount: number }[];
    /** Over the 365 days ending on the statement date. */
    last12Months: number;
    /** Average borrowed amount over the same days. */
    averageBorrowed: number;
    /** last12Months ÷ averageBorrowed, null when nothing was borrowed. */
    effectiveRate: number | null;
  };
  missingFx: boolean;
}

/** Leverage, loan and interest of a source today, from its last statement and the value of its securities now. */
export function computeBrokerLeverage(source: LeverageSource, securities: number, fx: FxTable, userCurrency: string, todayKey: string): BrokerLeverage | null {
  const last = source.statements.at(-1);
  if (!last) return null;
  let missingFx = false;
  const netCash = last.closing.reduce((sum, a) => {
    const value = Math.abs(a.amount) < AMOUNT_EPSILON ? 0 : convertAmount(fx, a.amount, a.currency, userCurrency, todayKey);
    if (value === null) missingFx = true;
    return sum + (value ?? 0);
  }, 0);
  const loan = Math.max(0, -netCash);
  const equity = securities + netCash;

  const byYear = new Map<number, number>();
  const first = source.statements[0].from;
  const windowFrom = [first, shiftDays(last.to, -(DAYS_PER_YEAR - 1))].sort()[1];
  const days = eachDay(first, last.to);
  const series = buildCashSeries([source], fx, userCurrency, days);
  let last12Months = 0;
  let borrowedSum = 0;
  let borrowedDays = 0;
  days.forEach((date, i) => {
    const cost = series.interest[i];
    if (cost) byYear.set(Number(date.slice(0, 4)), (byYear.get(Number(date.slice(0, 4))) ?? 0) + cost);
    if (date >= windowFrom) {
      last12Months += cost;
      borrowedSum += series.borrowed[i];
      borrowedDays += 1;
    }
  });
  const averageBorrowed = borrowedDays ? borrowedSum / borrowedDays : 0;
  return {
    accountId: source.accountId,
    provider: source.provider,
    name: source.name,
    statementDate: last.to,
    securities,
    netCash,
    loan,
    equity,
    ratio: equity > AMOUNT_EPSILON ? securities / equity : null,
    loanToValue: securities > AMOUNT_EPSILON ? loan / securities : null,
    balances: last.closing.filter((a) => Math.abs(a.amount) >= 0.005).sort((a, b) => a.amount - b.amount),
    interest: {
      byYear: [...byYear].map(([year, amount]) => ({ year, amount })).sort((a, b) => a.year - b.year),
      last12Months,
      averageBorrowed,
      // Under a year of borrowing the rate would read too high or too low: annualise on the days actually seen.
      effectiveRate: averageBorrowed > AMOUNT_EPSILON && borrowedDays > 0 ? (last12Months / averageBorrowed) * (DAYS_PER_YEAR / borrowedDays) : null,
    },
    missingFx: missingFx || series.missingFx,
  };
}

/**
 * Fall of the securities (0.32 = −32%) that brings the own capital down to the maintenance margin, keeping the loan
 * fixed: S(1 − x) − L = m · S(1 − x) ⇒ x = 1 − L / (S (1 − m)). 0 when the account is already there, null without a loan.
 * An estimate: IBKR sets a requirement per security and changes it, and the CSV does not carry it.
 */
export function marginCallDrop(loan: number, securities: number, maintenance: number): number | null {
  if (loan <= AMOUNT_EPSILON || securities <= AMOUNT_EPSILON || maintenance >= 1) return null;
  return Math.max(0, 1 - loan / (securities * (1 - maintenance)));
}

/**
 * Flows of the user's own capital from those of the securities. The account's cash joins the value; buys, sales and
 * dividends of that account stop being flows (they only move money inside the account), and its deposits and
 * withdrawals become the flows. Interest and fees lower the cash, so they lower the return. `all` and `broker` are the
 * same days; `cash` has one more entry, the base day first.
 */
export function toCapitalFlows(baseValue: number, all: DailyFlow[], broker: DailyFlow[], cash: CashSeries): { baseValue: number; flows: DailyFlow[] } {
  return {
    baseValue: baseValue + cash.cash[0],
    flows: all.map((day, i) => {
      const own = broker[i];
      const deposit = cash.deposits[i + 1];
      return {
        date: day.date,
        value: day.value + cash.cash[i + 1],
        inflow: day.inflow - own.inflow + Math.max(0, deposit),
        outflow: day.outflow - own.outflow + Math.max(0, -deposit),
        income: day.income - own.income,
      };
    }),
  };
}
