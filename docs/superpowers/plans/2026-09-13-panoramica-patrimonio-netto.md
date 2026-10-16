# Panoramica — net worth over time — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder home with the Panoramica ("Overview") screen: chart of net worth over time (hybrid history: real daily snapshots + an initial reconstruction from transactions), a composition row by asset class and a "Questo mese" ("This month") card.

**Architecture:** New table `net_worth_snapshots` (rows per user/day/asset class). A server module (`lib/net-worth/`) writes a one-off reconstruction (`derivato`, i.e. derived) and a real daily snapshot from a dedicated cron; a `GET /api/net-worth/snapshots` route returns raw rows. All the computation (reconstruction, series with adaptive granularity, change) lives in pure functions in `lib/calc/net-worth.ts`, run client-side as for Cash flow. The `/panoramica` page orchestrates components from `components/domain/net-worth/`.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM (Postgres), TanStack Query, Recharts 3 via `components/ui/chart.tsx`, node-cron, Vitest (integration tests against a real Postgres).

**Spec:** `docs/superpowers/specs/2026-09-13-panoramica-patrimonio-netto-design.md`

## Global Constraints

- User-visible strings in Italian.
- Never hex colors or hardcoded radii in components: only theme tokens (`text-pos`, `text-neg`, `text-muted-foreground`, `bg-muted`, `var(--primary)`, etc.).
- One-line JSDoc on every public component and function; prop types exported.
- Whoever imports from `components/domain/net-worth/` always uses the `index.ts` barrel.
- No business logic in `app/(app)/panoramica/page.tsx`: the page orchestrates.
- `assetClass` and `source` are `text` columns validated by TS constants, **not** Postgres enums. The only `assetClass` value today: `"liquidita"` (liquidity/cash). `source` values: `"snapshot"`, `"derivato"`.
- Amounts written to the DB as a `.toFixed(2)` string (`numeric` columns); read as a string.
- Reconstruction: only accounts with `source === "auto"` in the subtraction, full `amount` (never `effectiveAmount`), manual accounts constant at the current balance, at most 24 months (from the first day of the month 24 months earlier), up to and including **yesterday**.
- Default chart period: `"3mesi"`.
- Tests run against the local Postgres **shared with development** (`fileParallelism: false`): create test users with id `test-...-${crypto.randomUUID()}` and delete them in `afterEach`. **Never call `runDailySnapshots()` in tests**: it would write snapshots for the real users of the development DB and block their reconstruction.
- `pnpm db:push` must be run **from the worktree directory** that contains the schema change, never from the main repo (Drizzle reads the schema from the current checkout).
- Implementer subagent: no git commands other than `git add` and `git commit`.
- Test command: `pnpm exec vitest run <path>`. Type check: `pnpm exec tsc --noEmit`. Lint: `pnpm lint` (2 known, pre-existing `react-hooks/set-state-in-effect` errors in `theme-toggle.tsx` and `CategoryLegendRow`; 3 pre-existing failing tests in `lib/gocardless/scheduler.test.ts`).

## File Structure

| File | Responsibility |
|---|---|
| `lib/calc/net-worth.ts` (create) | Pure functions: `toDateKey`, `deriveLiquidityHistory`, `getNetWorthPeriodRange`, `buildNetWorthSeries`, `computeNetWorthChange`, types |
| `lib/calc/net-worth.test.ts` (create) | Tests of the pure functions |
| `lib/db/schema/net-worth-snapshots.ts` (create) | `net_worth_snapshots` table, `ASSET_CLASSES`/`SNAPSHOT_SOURCES` constants |
| `lib/db/schema/index.ts` (modify) | Export of the new table |
| `lib/net-worth/snapshots.ts` (create) | DB writes: `hasAnySnapshot`, `backfillDerivedHistory`, `writeDailySnapshot` |
| `lib/net-worth/snapshots.test.ts` (create) | Integration tests of the writes |
| `lib/net-worth/scheduler.ts` (create) | `findUsersWithAccounts`, `snapshotUser`, `runDailySnapshots`, `startNetWorthScheduler` |
| `lib/net-worth/scheduler.test.ts` (create) | Tests of `findUsersWithAccounts` and `snapshotUser` |
| `instrumentation.ts` (modify) | Start of the net worth scheduler |
| `app/api/net-worth/snapshots/route.ts` (create) | Authenticated `GET`, lazy reconstruction, the user's rows |
| `app/api/net-worth/snapshots/route.test.ts` (create) | Route tests |
| `lib/queries/net-worth.ts` (create) | `useNetWorthSnapshotsQuery` hook |
| `components/domain/net-worth/net-worth-composition-row.utils.ts` (create) | `buildCompositionItems` |
| `components/domain/net-worth/net-worth-composition-row.utils.test.ts` (create) | Tests |
| `components/domain/net-worth/net-worth-period-selector.tsx` (create) | 1M/3M/1A/Max pills |
| `components/domain/net-worth/net-worth-chart-card.tsx` (create) | Total, change, selector, area chart, tooltip |
| `components/domain/net-worth/net-worth-composition-row.tsx` (create) | Mini-card per asset class |
| `components/domain/net-worth/month-summary-card.tsx` (create) | Entrate / Uscite / Messo da parte (Income / Outflows / Set aside) |
| `components/domain/net-worth/index.ts` (create) | Barrel |
| `app/(app)/panoramica/page.tsx` (create) | Orchestration, loading/error/no-account states |
| `app/(app)/page.tsx` (modify) | `redirect("/panoramica")` |
| `CLAUDE.md` (modify) | Project status and log |

---

### Task 1: Liquidity history reconstruction (pure function)

**Files:**
- Create: `lib/calc/net-worth.ts`
- Test: `lib/calc/net-worth.test.ts`

**Interfaces:**
- Consumes: `parseDateOnly(dateStr: string): Date`, `startOfDay(date: Date): Date` from `lib/calc/expenses.ts`; types `Account` (`lib/db/schema/accounts.ts`) and `Transaction` (`lib/db/schema/transactions.ts`).
- Produces:
  - `MAX_DERIVED_HISTORY_MONTHS = 24`
  - `toDateKey(date: Date): string` → `"YYYY-MM-DD"` (local components)
  - `addDays(date: Date, days: number): Date`
  - `interface DerivedLiquidityPoint { date: string; amount: number }`
  - `deriveLiquidityHistory(accounts: Account[], transactions: Transaction[], today: Date): DerivedLiquidityPoint[]` — sorted by ascending date, `amount` rounded to 2 decimals.

- [ ] **Step 1: Write the failing test**

Create `lib/calc/net-worth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveLiquidityHistory, toDateKey } from "./net-worth";
import type { Account } from "@/lib/db/schema/accounts";
import type { Transaction } from "@/lib/db/schema/transactions";

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: "account-auto",
    userId: "user-1",
    name: "Conto",
    type: "Conto corrente",
    balance: "0.00",
    color: "slate",
    icon: "wallet",
    source: "auto",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    accountId: "account-auto",
    categoryId: "category-1",
    description: "Movimento",
    rawDescription: null,
    note: null,
    amount: "-10.00",
    excludedAmount: "0.00",
    date: "2026-09-10",
    source: "auto",
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const TODAY = new Date(2026, 8, 13); // 13 September 2026

describe("toDateKey", () => {
  it("formatta la data locale come YYYY-MM-DD con zero padding", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("deriveLiquidityHistory", () => {
  it("non produce punti se non ci sono movimenti su conti Auto", () => {
    const accounts = [makeAccount({ id: "manual", source: "manuale", balance: "500.00" })];
    const transactions = [makeTransaction({ accountId: "manual", date: "2026-09-10" })];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([]);
  });

  it("ricostruisce il saldo di fine giornata sottraendo i movimenti Auto successivi, fino a ieri", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [
      makeTransaction({ date: "2026-09-11", amount: "-100.00" }),
      makeTransaction({ date: "2026-09-12", amount: "50.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([
      { date: "2026-09-11", amount: 950 },
      { date: "2026-09-12", amount: 1000 },
    ]);
  });

  it("i movimenti datati oggi incidono già sul punto di ieri", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [
      makeTransaction({ date: "2026-09-12", amount: "-20.00" }),
      makeTransaction({ date: "2026-09-13", amount: "30.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([{ date: "2026-09-12", amount: 970 }]);
  });

  it("somma i conti manuali come costante e ignora i loro movimenti", () => {
    const accounts = [
      makeAccount({ balance: "1000.00" }),
      makeAccount({ id: "manual", source: "manuale", balance: "200.00" }),
    ];
    const transactions = [
      makeTransaction({ date: "2026-09-11", amount: "-100.00" }),
      makeTransaction({ date: "2026-09-12", amount: "50.00" }),
      makeTransaction({ accountId: "manual", date: "2026-09-12", amount: "-999.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([
      { date: "2026-09-11", amount: 1150 },
      { date: "2026-09-12", amount: 1200 },
    ]);
  });

  it("usa l'importo pieno anche quando la transazione è divisa", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [
      makeTransaction({ date: "2026-09-11", amount: "-10.00" }),
      makeTransaction({ date: "2026-09-12", amount: "-100.00", excludedAmount: "-60.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([
      { date: "2026-09-11", amount: 1100 },
      { date: "2026-09-12", amount: 1000 },
    ]);
  });

  it("limita la ricostruzione a 24 mesi, dal primo giorno del mese", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [makeTransaction({ date: "2023-01-15", amount: "-10.00" })];
    const points = deriveLiquidityHistory(accounts, transactions, TODAY);
    expect(points[0].date).toBe("2024-09-01");
    expect(points[points.length - 1].date).toBe("2026-09-12");
    expect(points.every((p) => p.amount === 1000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/calc/net-worth.test.ts`
Expected: FAIL — `Failed to resolve import "./net-worth"`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/calc/net-worth.ts`:

```ts
import type { Account } from "@/lib/db/schema/accounts";
import type { Transaction } from "@/lib/db/schema/transactions";
import { parseDateOnly, startOfDay } from "./expenses";

/** Maximum depth of the history reconstruction, in months. */
export const MAX_DERIVED_HISTORY_MONTHS = 24;

/** "YYYY-MM-DD" key of the local date, comparable as a string. */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Adds `days` calendar days (negative too) at local midnight. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Daily point of reconstructed liquidity (end-of-day balance). */
export interface DerivedLiquidityPoint {
  date: string;
  amount: number;
}

/**
 * Reconstructs end-of-day liquidity from the first Auto movement up to yesterday (at most 24 months):
 * current balance of all accounts minus the movements of Auto accounts only, dated after that day.
 * Manual accounts stay constant because their movements do not update the balance; the full `amount` is used.
 */
export function deriveLiquidityHistory(accounts: Account[], transactions: Transaction[], today: Date): DerivedLiquidityPoint[] {
  const autoAccountIds = new Set(accounts.filter((a) => a.source === "auto").map((a) => a.id));
  const autoTransactions = transactions.filter((t) => autoAccountIds.has(t.accountId));
  if (autoTransactions.length === 0) return [];

  const todayStart = startOfDay(today);
  const currentTotal = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const cutoff = new Date(todayStart.getFullYear(), todayStart.getMonth() - MAX_DERIVED_HISTORY_MONTHS, 1);

  const amountByDate = new Map<string, number>();
  let earliest = todayStart;
  let sumAfter = 0;
  for (const t of autoTransactions) {
    const date = parseDateOnly(t.date);
    if (date.getTime() < earliest.getTime()) earliest = date;
    if (date.getTime() >= todayStart.getTime()) {
      sumAfter += Number(t.amount);
    } else {
      amountByDate.set(t.date, (amountByDate.get(t.date) ?? 0) + Number(t.amount));
    }
  }

  const start = earliest.getTime() < cutoff.getTime() ? cutoff : earliest;
  const points: DerivedLiquidityPoint[] = [];
  for (let cursor = addDays(todayStart, -1); cursor.getTime() >= start.getTime(); cursor = addDays(cursor, -1)) {
    const key = toDateKey(cursor);
    points.push({ date: key, amount: round2(currentTotal - sumAfter) });
    sumAfter += amountByDate.get(key) ?? 0;
  }
  return points.reverse();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/calc/net-worth.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/calc/net-worth.ts lib/calc/net-worth.test.ts
git commit -m "feat: ricostruzione pura dello storico di liquidità dalle transazioni Auto"
```

---

### Task 2: Net worth series and change (pure functions)

**Files:**
- Modify: `lib/calc/net-worth.ts`
- Test: `lib/calc/net-worth.test.ts`

**Interfaces:**
- Consumes: `toDateKey`, `addDays` (Task 1); `parseDateOnly`, `startOfDay`, `endOfMonth`, `type DateRange` from `lib/calc/expenses.ts`.
- Produces:
  - `type NetWorthPeriod = "1mese" | "3mesi" | "1anno" | "max"`
  - `interface NetWorthSnapshotInput { date: string; amount: string; source: string }` (a Drizzle row of `net_worth_snapshots` is structurally assignable)
  - `interface NetWorthSeriesPoint { date: string; label: string; value: number; isEstimated: boolean }`
  - `interface NetWorthChange { start: number; end: number; delta: number; deltaPct: number | null }`
  - `getNetWorthPeriodRange(period: NetWorthPeriod, today: Date, earliestDate: string | null): DateRange`
  - `buildNetWorthSeries(snapshots: NetWorthSnapshotInput[], todayTotal: number, period: NetWorthPeriod, today: Date): NetWorthSeriesPoint[]`
  - `computeNetWorthChange(series: NetWorthSeriesPoint[]): NetWorthChange`

- [ ] **Step 1: Write the failing test**

Append to `lib/calc/net-worth.test.ts` (and extend the import on line 2 to `import { buildNetWorthSeries, computeNetWorthChange, deriveLiquidityHistory, getNetWorthPeriodRange, toDateKey, type NetWorthSeriesPoint } from "./net-worth";`):

```ts
function snapshot(date: string, amount: string, source = "snapshot", assetClass = "liquidita") {
  return { date, amount, source, assetClass };
}

function point(date: string, value: number): NetWorthSeriesPoint {
  return { date, label: date, value, isEstimated: false };
}

describe("getNetWorthPeriodRange", () => {
  it("3mesi, 1anno e 1mese partono dallo stesso giorno N mesi prima", () => {
    expect(toDateKey(getNetWorthPeriodRange("3mesi", TODAY, null).from)).toBe("2026-06-13");
    expect(toDateKey(getNetWorthPeriodRange("1anno", TODAY, null).from)).toBe("2025-09-13");
    expect(toDateKey(getNetWorthPeriodRange("1mese", TODAY, null).to)).toBe("2026-09-13");
  });

  it("limita il giorno all'ultimo del mese di destinazione", () => {
    expect(toDateKey(getNetWorthPeriodRange("1mese", new Date(2026, 2, 31), null).from)).toBe("2026-02-28");
  });

  it("max parte dalla prima data disponibile, o da oggi se non ce ne sono", () => {
    expect(toDateKey(getNetWorthPeriodRange("max", TODAY, "2024-01-05").from)).toBe("2024-01-05");
    expect(toDateKey(getNetWorthPeriodRange("max", TODAY, null).from)).toBe("2026-09-13");
  });
});

describe("buildNetWorthSeries", () => {
  it("senza snapshot restituisce solo il totale di oggi", () => {
    const series = buildNetWorthSeries([], 140, "3mesi", TODAY);
    expect(series.map((p) => [p.date, p.value, p.isEstimated])).toEqual([["2026-09-13", 140, false]]);
  });

  it("serie giornaliera: ripete l'ultimo valore nei giorni mancanti e chiude col totale di oggi", () => {
    const series = buildNetWorthSeries(
      [snapshot("2026-09-10", "100.00"), snapshot("2026-09-12", "130.00")],
      140,
      "1mese",
      TODAY
    );
    expect(series.map((p) => [p.date, p.value])).toEqual([
      ["2026-09-10", 100],
      ["2026-09-11", 100],
      ["2026-09-12", 130],
      ["2026-09-13", 140],
    ]);
  });

  it("somma le classi di asset dello stesso giorno", () => {
    const series = buildNetWorthSeries(
      [snapshot("2026-09-12", "100.00"), snapshot("2026-09-12", "50.00", "snapshot", "investimenti")],
      0,
      "1mese",
      TODAY
    );
    expect(series[0]).toMatchObject({ date: "2026-09-12", value: 150 });
  });

  it("porta dentro il periodo l'ultimo valore precedente all'inizio", () => {
    const series = buildNetWorthSeries([snapshot("2026-01-01", "500.00")], 600, "1mese", TODAY);
    expect(series[0]).toMatchObject({ date: "2026-08-13", value: 500 });
    expect(series).toHaveLength(32);
    expect(series[series.length - 1]).toMatchObject({ date: "2026-09-13", value: 600 });
  });

  it("marca come stimati i punti derivati e quelli che ne ripetono il valore, mai il punto di oggi", () => {
    const series = buildNetWorthSeries([snapshot("2026-09-11", "100.00", "derivato")], 120, "1mese", TODAY);
    expect(series.map((p) => [p.date, p.isEstimated])).toEqual([
      ["2026-09-11", true],
      ["2026-09-12", true],
      ["2026-09-13", false],
    ]);
  });

  it("1anno e max tengono un punto per mese: l'ultimo giorno del mese, o oggi nel mese corrente", () => {
    const snapshots = [
      snapshot("2026-07-15", "100.00"),
      snapshot("2026-07-31", "120.00"),
      snapshot("2026-08-20", "200.00"),
    ];
    const series = buildNetWorthSeries(snapshots, 250, "1anno", TODAY);
    expect(series.map((p) => [p.date, p.value])).toEqual([
      ["2026-07-31", 120],
      ["2026-08-31", 200],
      ["2026-09-13", 250],
    ]);
    expect(buildNetWorthSeries(snapshots, 250, "max", TODAY).map((p) => p.date)).toEqual([
      "2026-07-31",
      "2026-08-31",
      "2026-09-13",
    ]);
  });

  it("ignora gli snapshot datati oggi o dopo: l'ultimo punto è sempre il totale corrente", () => {
    const series = buildNetWorthSeries([snapshot("2026-09-13", "999.00")], 140, "1mese", TODAY);
    expect(series.map((p) => [p.date, p.value])).toEqual([["2026-09-13", 140]]);
  });
});

describe("computeNetWorthChange", () => {
  it("calcola variazione assoluta e percentuale tra primo e ultimo punto", () => {
    expect(computeNetWorthChange([point("a", 100), point("b", 150)])).toEqual({ start: 100, end: 150, delta: 50, deltaPct: 0.5 });
  });

  it("percentuale nulla se il valore iniziale è zero", () => {
    expect(computeNetWorthChange([point("a", 0), point("b", 150)]).deltaPct).toBeNull();
  });

  it("con un solo punto nessuna variazione", () => {
    expect(computeNetWorthChange([point("a", 80)])).toEqual({ start: 80, end: 80, delta: 0, deltaPct: null });
  });

  it("con nessun punto tutto a zero", () => {
    expect(computeNetWorthChange([])).toEqual({ start: 0, end: 0, delta: 0, deltaPct: null });
  });

  it("con patrimonio iniziale negativo la percentuale è sul valore assoluto", () => {
    expect(computeNetWorthChange([point("a", -200), point("b", -100)]).deltaPct).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/calc/net-worth.test.ts`
Expected: FAIL — `getNetWorthPeriodRange is not a function` (or a missing-export error).

- [ ] **Step 3: Write minimal implementation**

In `lib/calc/net-worth.ts` change the expenses import to:

```ts
import { endOfMonth, parseDateOnly, startOfDay, type DateRange } from "./expenses";
```

and append:

```ts
/** Selectable period in the net worth chart. */
export type NetWorthPeriod = "1mese" | "3mesi" | "1anno" | "max";

const PERIOD_MONTHS: Record<Exclude<NetWorthPeriod, "max">, number> = {
  "1mese": 1,
  "3mesi": 3,
  "1anno": 12,
};

/** Snapshot row as it comes from the API (numeric serialized as a string). */
export interface NetWorthSnapshotInput {
  date: string;
  amount: string;
  source: string;
}

/** Chart point: `isEstimated` marks a value reconstructed from transactions. */
export interface NetWorthSeriesPoint {
  date: string;
  label: string;
  value: number;
  isEstimated: boolean;
}

/** Change between the first and last point; `deltaPct` is a ratio (0.5 = +50%). */
export interface NetWorthChange {
  start: number;
  end: number;
  delta: number;
  deltaPct: number | null;
}

const DAY_LABEL_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit" });

function subtractMonthsClamped(date: Date, months: number): Date {
  const firstOfTarget = new Date(date.getFullYear(), date.getMonth() - months, 1);
  const lastDay = endOfMonth(firstOfTarget).getDate();
  return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Range of the period up to today; `max` starts from the first available date (or from today if there are none). */
export function getNetWorthPeriodRange(period: NetWorthPeriod, today: Date, earliestDate: string | null): DateRange {
  const to = startOfDay(today);
  if (period === "max") {
    return { from: earliestDate ? parseDateOnly(earliestDate) : to, to };
  }
  return { from: subtractMonthsClamped(to, PERIOD_MONTHS[period]), to };
}

/**
 * Net worth series over the period: sums the asset classes per day, repeats the last value on missing
 * days and closes with today's current total. Daily for 1mese/3mesi, one point per month-end for 1anno/max.
 */
export function buildNetWorthSeries(
  snapshots: NetWorthSnapshotInput[],
  todayTotal: number,
  period: NetWorthPeriod,
  today: Date
): NetWorthSeriesPoint[] {
  const todayKey = toDateKey(startOfDay(today));
  const byDate = new Map<string, { value: number; isEstimated: boolean }>();
  for (const row of snapshots) {
    if (row.date >= todayKey) continue;
    const current = byDate.get(row.date) ?? { value: 0, isEstimated: false };
    byDate.set(row.date, {
      value: current.value + Number(row.amount),
      isEstimated: current.isEstimated || row.source === "derivato",
    });
  }

  const sortedKeys = [...byDate.keys()].sort();
  const range = getNetWorthPeriodRange(period, today, sortedKeys[0] ?? null);
  const fromKey = toDateKey(range.from);

  let last: { value: number; isEstimated: boolean } | null = null;
  for (const key of sortedKeys) {
    if (key >= fromKey) break;
    last = byDate.get(key) ?? null;
  }

  const daily: NetWorthSeriesPoint[] = [];
  for (let cursor = range.from; toDateKey(cursor) < todayKey; cursor = addDays(cursor, 1)) {
    const key = toDateKey(cursor);
    last = byDate.get(key) ?? last;
    if (last) {
      daily.push({ date: key, label: DAY_LABEL_FORMAT.format(cursor), value: last.value, isEstimated: last.isEstimated });
    }
  }
  daily.push({ date: todayKey, label: DAY_LABEL_FORMAT.format(startOfDay(today)), value: todayTotal, isEstimated: false });

  if (period === "1mese" || period === "3mesi") return daily;

  const monthly: NetWorthSeriesPoint[] = [];
  for (const p of daily) {
    const relabeled = { ...p, label: MONTH_LABEL_FORMAT.format(parseDateOnly(p.date)) };
    const previous = monthly[monthly.length - 1];
    if (previous && previous.date.slice(0, 7) === p.date.slice(0, 7)) {
      monthly[monthly.length - 1] = relabeled;
    } else {
      monthly.push(relabeled);
    }
  }
  return monthly;
}

/** Net worth change between the first and last point of the series; null percentage with fewer than 2 points or a zero start. */
export function computeNetWorthChange(series: NetWorthSeriesPoint[]): NetWorthChange {
  if (series.length === 0) return { start: 0, end: 0, delta: 0, deltaPct: null };
  const start = series[0].value;
  const end = series[series.length - 1].value;
  const delta = end - start;
  const deltaPct = series.length >= 2 && start !== 0 ? delta / Math.abs(start) : null;
  return { start, end, delta, deltaPct };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/calc/net-worth.test.ts`
Expected: PASS (all tests of Task 1 and Task 2).

- [ ] **Step 5: Commit**

```bash
git add lib/calc/net-worth.ts lib/calc/net-worth.test.ts
git commit -m "feat: serie del patrimonio netto con granularità adattiva e variazione"
```

---

### Task 3: Snapshot table and DB writes

**Files:**
- Create: `lib/db/schema/net-worth-snapshots.ts`
- Modify: `lib/db/schema/index.ts`
- Create: `lib/net-worth/snapshots.ts`
- Test: `lib/net-worth/snapshots.test.ts`

**Interfaces:**
- Consumes: `deriveLiquidityHistory`, `toDateKey` (Task 1); `db` from `lib/db/client.ts`; tables `accounts`, `transactions`, `authUser`.
- Produces:
  - `ASSET_CLASSES = ["liquidita"] as const`, `type AssetClass`
  - `SNAPSHOT_SOURCES = ["snapshot", "derivato"] as const`, `type SnapshotSource`
  - table `netWorthSnapshots`, type `NetWorthSnapshot`
  - `hasAnySnapshot(userId: string): Promise<boolean>`
  - `backfillDerivedHistory(userId: string, today?: Date): Promise<number>` — rows written, 0 if snapshots already exist
  - `writeDailySnapshot(userId: string, today?: Date): Promise<void>`

- [ ] **Step 1: Create the schema**

Create `lib/db/schema/net-worth-snapshots.ts`:

```ts
import { date, index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/** Net worth asset classes: text + constant instead of a Postgres enum, so new ones can be added without migrations. */
export const ASSET_CLASSES = ["liquidita"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

/** Origin of a row: recorded by the daily cron or reconstructed from transactions. */
export const SNAPSHOT_SOURCES = ["snapshot", "derivato"] as const;
export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];

export const netWorthSnapshots = pgTable(
  "net_worth_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    assetClass: text("asset_class").$type<AssetClass>().notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    source: text("source").$type<SnapshotSource>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("net_worth_snapshots_user_date_class_unique").on(table.userId, table.date, table.assetClass),
    index("net_worth_snapshots_user_date_idx").on(table.userId, table.date),
  ]
);

export type NetWorthSnapshot = typeof netWorthSnapshots.$inferSelect;
export type NewNetWorthSnapshot = typeof netWorthSnapshots.$inferInsert;
```

Append to `lib/db/schema/index.ts`:

```ts
export * from "./net-worth-snapshots";
```

- [ ] **Step 2: Apply the schema to the local DB**

Run **from the worktree directory**: `pnpm db:push`
Expected: drizzle-kit proposes creating `net_worth_snapshots`; confirm only that. If the command asks to touch anything else (unrelated pre-existing constraints) or hangs, **cancel** and apply this SQL instead with an uncommitted scratch script:

```sql
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  date date NOT NULL,
  asset_class text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT net_worth_snapshots_user_date_class_unique UNIQUE (user_id, date, asset_class)
);
CREATE INDEX IF NOT EXISTS net_worth_snapshots_user_date_idx ON net_worth_snapshots (user_id, date);
```

Verify: `pnpm exec tsx --env-file=.env.local -e "import('./lib/db/client').then(async ({ client }) => { console.log(await client\`select count(*) from net_worth_snapshots\`); await client.end(); })"`
Expected: prints `[ { count: '0' } ]` (or a number), no "relation does not exist" error.

- [ ] **Step 3: Write the failing test**

Create `lib/net-worth/snapshots.test.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { backfillDerivedHistory, writeDailySnapshot } from "./snapshots";

const TODAY = new Date(2026, 8, 13);

describe("net-worth snapshots", () => {
  let userId: string;
  let categoryId: string;

  async function createAccount(source: "auto" | "manuale", balance: string) {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: `Conto ${source}`, type: "Conto corrente", balance, source })
      .returning();
    return account.id;
  }

  async function snapshotRows() {
    return db
      .select()
      .from(netWorthSnapshots)
      .where(eq(netWorthSnapshots.userId, userId))
      .orderBy(netWorthSnapshots.date);
  }

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-net-worth-${crypto.randomUUID()}`,
        name: "Test Net Worth",
        email: `test-net-worth-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Varie", type: "variabile" })
      .returning();
    categoryId = category.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("backfillDerivedHistory scrive righe derivate di liquidità dai movimenti Auto", async () => {
    const autoId = await createAccount("auto", "1000.00");
    await db.insert(transactions).values([
      { userId, accountId: autoId, categoryId, description: "Spesa", amount: "-100.00", date: "2026-09-11", source: "auto" },
      { userId, accountId: autoId, categoryId, description: "Rimborso", amount: "50.00", date: "2026-09-12", source: "auto" },
    ]);

    const written = await backfillDerivedHistory(userId, TODAY);

    expect(written).toBe(2);
    const rows = await snapshotRows();
    expect(rows.map((r) => [r.date, r.amount, r.assetClass, r.source])).toEqual([
      ["2026-09-11", "950.00", "liquidita", "derivato"],
      ["2026-09-12", "1000.00", "liquidita", "derivato"],
    ]);
  });

  it("backfillDerivedHistory non fa nulla se l'utente ha già snapshot", async () => {
    const autoId = await createAccount("auto", "1000.00");
    await db.insert(transactions).values({
      userId,
      accountId: autoId,
      categoryId,
      description: "Spesa",
      amount: "-100.00",
      date: "2026-09-11",
      source: "auto",
    });
    await backfillDerivedHistory(userId, TODAY);

    expect(await backfillDerivedHistory(userId, TODAY)).toBe(0);
    expect(await snapshotRows()).toHaveLength(2);
  });

  it("backfillDerivedHistory non scrive nulla senza conti Auto", async () => {
    const manualId = await createAccount("manuale", "300.00");
    await db.insert(transactions).values({
      userId,
      accountId: manualId,
      categoryId,
      description: "Spesa",
      amount: "-10.00",
      date: "2026-09-11",
    });

    expect(await backfillDerivedHistory(userId, TODAY)).toBe(0);
    expect(await snapshotRows()).toHaveLength(0);
  });

  it("writeDailySnapshot scrive la somma dei saldi correnti come snapshot reale", async () => {
    await createAccount("auto", "1000.00");
    await createAccount("manuale", "200.00");

    await writeDailySnapshot(userId, TODAY);

    const rows = await snapshotRows();
    expect(rows.map((r) => [r.date, r.amount, r.source])).toEqual([["2026-09-13", "1200.00", "snapshot"]]);
  });

  it("writeDailySnapshot è idempotente e aggiorna l'importo dello stesso giorno", async () => {
    const accountId = await createAccount("manuale", "200.00");
    await writeDailySnapshot(userId, TODAY);
    await db.update(accounts).set({ balance: "350.00" }).where(eq(accounts.id, accountId));

    await writeDailySnapshot(userId, TODAY);

    const rows = await snapshotRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe("350.00");
  });

  it("uno snapshot reale sovrascrive una riga derivata dello stesso giorno", async () => {
    await createAccount("manuale", "500.00");
    await db
      .insert(netWorthSnapshots)
      .values({ userId, date: "2026-09-13", assetClass: "liquidita", amount: "1.00", source: "derivato" });

    await writeDailySnapshot(userId, TODAY);

    const [row] = await db
      .select()
      .from(netWorthSnapshots)
      .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.date, "2026-09-13")));
    expect(row.source).toBe("snapshot");
    expect(row.amount).toBe("500.00");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm exec vitest run lib/net-worth/snapshots.test.ts`
Expected: FAIL — `Failed to resolve import "./snapshots"`.

- [ ] **Step 5: Write minimal implementation**

Create `lib/net-worth/snapshots.ts`:

```ts
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { deriveLiquidityHistory, toDateKey } from "@/lib/calc/net-worth";

/** True if the user already has at least one snapshot row, real or derived. */
export async function hasAnySnapshot(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: netWorthSnapshots.id })
    .from(netWorthSnapshots)
    .where(eq(netWorthSnapshots.userId, userId))
    .limit(1);
  return rows.length > 0;
}

/**
 * One-off reconstruction of the liquidity history from the Auto accounts' movements: no-op if the user already has snapshots.
 * Writes with onConflictDoNothing, so concurrent runs neither duplicate nor overwrite. Returns the rows written.
 */
export async function backfillDerivedHistory(userId: string, today: Date = new Date()): Promise<number> {
  if (await hasAnySnapshot(userId)) return 0;

  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const autoAccountIds = userAccounts.filter((a) => a.source === "auto").map((a) => a.id);
  if (autoAccountIds.length === 0) return 0;

  const autoTransactions = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.accountId, autoAccountIds)));

  const points = deriveLiquidityHistory(userAccounts, autoTransactions, today);
  if (points.length === 0) return 0;

  const inserted = await db
    .insert(netWorthSnapshots)
    .values(
      points.map((p) => ({
        userId,
        date: p.date,
        assetClass: "liquidita" as const,
        amount: p.amount.toFixed(2),
        source: "derivato" as const,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: netWorthSnapshots.id });
  return inserted.length;
}

/** Writes or updates the day's real snapshot (liquidity = sum of current balances); always overwrites a derived row. */
export async function writeDailySnapshot(userId: string, today: Date = new Date()): Promise<void> {
  const userAccounts = await db.select({ balance: accounts.balance }).from(accounts).where(eq(accounts.userId, userId));
  const amount = userAccounts.reduce((sum, a) => sum + Number(a.balance), 0).toFixed(2);

  await db
    .insert(netWorthSnapshots)
    .values({ userId, date: toDateKey(today), assetClass: "liquidita", amount, source: "snapshot" })
    .onConflictDoUpdate({
      target: [netWorthSnapshots.userId, netWorthSnapshots.date, netWorthSnapshots.assetClass],
      set: { amount, source: "snapshot", updatedAt: new Date() },
    });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm exec vitest run lib/net-worth/snapshots.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Type check and commit**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

```bash
git add lib/db/schema/net-worth-snapshots.ts lib/db/schema/index.ts lib/net-worth/snapshots.ts lib/net-worth/snapshots.test.ts
git commit -m "feat: tabella net_worth_snapshots con ricostruzione una tantum e snapshot giornaliero"
```

---

### Task 4: Daily snapshot scheduler

**Files:**
- Create: `lib/net-worth/scheduler.ts`
- Test: `lib/net-worth/scheduler.test.ts`
- Modify: `instrumentation.ts`

**Interfaces:**
- Consumes: `backfillDerivedHistory`, `writeDailySnapshot` (Task 3).
- Produces:
  - `NET_WORTH_SNAPSHOT_CRON = "50 23 * * *"`
  - `findUsersWithAccounts(): Promise<string[]>`
  - `snapshotUser(userId: string, today?: Date): Promise<void>` — reconstruction first, then snapshot
  - `runDailySnapshots(today?: Date): Promise<void>`
  - `startNetWorthScheduler(): void`

- [ ] **Step 1: Write the failing test**

Create `lib/net-worth/scheduler.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { findUsersWithAccounts, snapshotUser } from "./scheduler";

// runDailySnapshots() is never called here: it would run over all users of the shared development DB.
const TODAY = new Date(2026, 8, 13);

describe("net-worth scheduler", () => {
  let userId: string;
  let userWithoutAccountsId: string;

  async function createUser(prefix: string) {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `${prefix}-${crypto.randomUUID()}`,
        name: "Test Net Worth Scheduler",
        email: `${prefix}-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    return user.id;
  }

  beforeEach(async () => {
    userId = await createUser("test-net-worth-scheduler");
    userWithoutAccountsId = await createUser("test-net-worth-scheduler-empty");
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, userWithoutAccountsId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("findUsersWithAccounts include solo gli utenti con almeno un conto", async () => {
    await db.insert(accounts).values({ userId, name: "Contanti", type: "Contanti", balance: "10.00" });

    const userIds = await findUsersWithAccounts();

    expect(userIds).toContain(userId);
    expect(userIds).not.toContain(userWithoutAccountsId);
  });

  it("snapshotUser ricostruisce lo storico prima di scrivere lo snapshot del giorno", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "1000.00", source: "auto" })
      .returning();
    const [category] = await db.insert(categories).values({ userId, name: "Varie", type: "variabile" }).returning();
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId: category.id,
      description: "Spesa",
      amount: "-100.00",
      date: "2026-09-12",
      source: "auto",
    });

    await snapshotUser(userId, TODAY);

    const rows = await db
      .select()
      .from(netWorthSnapshots)
      .where(eq(netWorthSnapshots.userId, userId))
      .orderBy(netWorthSnapshots.date);
    expect(rows.map((r) => [r.date, r.amount, r.source])).toEqual([
      ["2026-09-12", "1000.00", "derivato"],
      ["2026-09-13", "1000.00", "snapshot"],
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/net-worth/scheduler.test.ts`
Expected: FAIL — `Failed to resolve import "./scheduler"`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/net-worth/scheduler.ts`:

```ts
import cron from "node-cron";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { backfillDerivedHistory, writeDailySnapshot } from "./snapshots";

/** Snapshot cron time: every day at 23:50, server time. */
export const NET_WORTH_SNAPSHOT_CRON = "50 23 * * *";

/** Ids of the users with at least one account. */
export async function findUsersWithAccounts(): Promise<string[]> {
  const rows = await db.selectDistinct({ userId: accounts.userId }).from(accounts);
  return rows.map((r) => r.userId);
}

/** Snapshot of one user: one-off reconstruction (if it has no rows yet) and then the day's real snapshot. */
export async function snapshotUser(userId: string, today: Date = new Date()): Promise<void> {
  await backfillDerivedHistory(userId, today);
  await writeDailySnapshot(userId, today);
}

/** Runs the snapshot for all users with accounts; an error on one user is logged and does not block the others. */
export async function runDailySnapshots(today: Date = new Date()): Promise<void> {
  const userIds = await findUsersWithAccounts();
  for (const userId of userIds) {
    try {
      await snapshotUser(userId, today);
    } catch (error) {
      console.error(`Snapshot patrimonio fallito per l'utente ${userId}`, error);
    }
  }
}

let started = false;

/** Starts the daily net worth snapshot cron; no-op if already started in the current process. */
export function startNetWorthScheduler(): void {
  if (started) return;
  started = true;
  cron.schedule(NET_WORTH_SNAPSHOT_CRON, () => {
    runDailySnapshots().catch((error) => console.error("Snapshot patrimonio fallito", error));
  });
}
```

Replace the content of `instrumentation.ts` with:

```ts
/** Next.js boot hook: starts the schedulers (GoCardless sync, net worth snapshots) in the Node.js runtime. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startGoCardlessScheduler } = await import("@/lib/gocardless/scheduler");
    startGoCardlessScheduler();
    const { startNetWorthScheduler } = await import("@/lib/net-worth/scheduler");
    startNetWorthScheduler();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/net-worth/scheduler.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Type check and commit**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

```bash
git add lib/net-worth/scheduler.ts lib/net-worth/scheduler.test.ts instrumentation.ts
git commit -m "feat: cron giornaliero degli snapshot del patrimonio netto"
```

---

### Task 5: API `GET /api/net-worth/snapshots` and client hook

**Files:**
- Create: `app/api/net-worth/snapshots/route.ts`
- Test: `app/api/net-worth/snapshots/route.test.ts`
- Create: `lib/queries/net-worth.ts`

**Interfaces:**
- Consumes: `backfillDerivedHistory` (Task 3), `netWorthSnapshots`, `NetWorthSnapshot` (Task 3), `toDateKey`, `addDays` (Task 1).
- Produces:
  - `GET(request: NextRequest): Promise<Response>` — 401 without a session, 400 on missing `from`/`to` or not `YYYY-MM-DD`, 200 with `NetWorthSnapshot[]` sorted by ascending date.
  - `useNetWorthSnapshotsQuery(from: string, to: string)` — `useQuery` with key `["net-worth-snapshots", from, to]`, data `NetWorthSnapshot[]`.

- [ ] **Step 1: Write the failing test**

Create `app/api/net-worth/snapshots/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { addDays, toDateKey } from "@/lib/calc/net-worth";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function request(query: string) {
  return new NextRequest(`http://localhost/api/net-worth/snapshots${query}`);
}

describe("GET /api/net-worth/snapshots", () => {
  let userId: string;
  let otherUserId: string;
  const today = new Date();
  const range = `?from=${toDateKey(addDays(today, -30))}&to=${toDateKey(today)}`;

  async function createUser(prefix: string) {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `${prefix}-${crypto.randomUUID()}`,
        name: "Test Net Worth API",
        email: `${prefix}-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    return user.id;
  }

  beforeEach(async () => {
    userId = await createUser("test-net-worth-api");
    otherUserId = await createUser("test-net-worth-api-other");
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await GET(request(range));
    expect(response.status).toBe(401);
  });

  it("risponde 400 se from/to mancano o non sono date valide", async () => {
    expect((await GET(request(""))).status).toBe(400);
    expect((await GET(request("?from=13-09-2026&to=2026-09-13"))).status).toBe(400);
  });

  it("ricostruisce lo storico alla prima chiamata e non lo riscrive alle successive", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "1000.00", source: "auto" })
      .returning();
    const [category] = await db.insert(categories).values({ userId, name: "Varie", type: "variabile" }).returning();
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId: category.id,
      description: "Spesa",
      amount: "-100.00",
      date: toDateKey(addDays(today, -2)),
      source: "auto",
    });

    const first = await (await GET(request(range))).json();
    const second = await (await GET(request(range))).json();

    expect(first).toHaveLength(2);
    expect(first.every((row: { source: string }) => row.source === "derivato")).toBe(true);
    expect(second).toHaveLength(2);
    const stored = await db.select().from(netWorthSnapshots).where(eq(netWorthSnapshots.userId, userId));
    expect(stored).toHaveLength(2);
  });

  it("restituisce solo le righe dell'utente autenticato", async () => {
    await db.insert(netWorthSnapshots).values({
      userId: otherUserId,
      date: toDateKey(addDays(today, -1)),
      assetClass: "liquidita",
      amount: "999.00",
      source: "snapshot",
    });

    const response = await GET(request(range));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run app/api/net-worth/snapshots/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Write minimal implementation**

Create `app/api/net-worth/snapshots/route.ts`:

```ts
import { NextRequest } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { backfillDerivedHistory } from "@/lib/net-worth/snapshots";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/net-worth/snapshots?from&to — the user's snapshot rows in the period; on the first call it reconstructs the history. */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !DATE_FORMAT.test(from) || !DATE_FORMAT.test(to)) {
    return Response.json({ error: "from e to sono obbligatori nel formato YYYY-MM-DD" }, { status: 400 });
  }

  await backfillDerivedHistory(session.user.id);

  const rows = await db
    .select()
    .from(netWorthSnapshots)
    .where(
      and(eq(netWorthSnapshots.userId, session.user.id), gte(netWorthSnapshots.date, from), lte(netWorthSnapshots.date, to))
    )
    .orderBy(asc(netWorthSnapshots.date));

  return Response.json(rows);
}
```

Create `lib/queries/net-worth.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { NetWorthSnapshot } from "@/lib/db/schema/net-worth-snapshots";

async function fetchNetWorthSnapshots(from: string, to: string): Promise<NetWorthSnapshot[]> {
  const response = await fetch(`/api/net-worth/snapshots?from=${from}&to=${to}`);
  if (!response.ok) {
    throw new Error("Impossibile caricare lo storico del patrimonio");
  }
  return response.json();
}

/** Fetches the user's net worth snapshot rows in the range [from, to] (YYYY-MM-DD). */
export function useNetWorthSnapshotsQuery(from: string, to: string) {
  return useQuery({
    queryKey: ["net-worth-snapshots", from, to] as const,
    queryFn: () => fetchNetWorthSnapshots(from, to),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run app/api/net-worth/snapshots/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type check and commit**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

```bash
git add app/api/net-worth/snapshots/route.ts app/api/net-worth/snapshots/route.test.ts lib/queries/net-worth.ts
git commit -m "feat: API snapshot patrimonio netto con ricostruzione alla prima lettura"
```

---

### Task 6: Panoramica domain components

**Files:**
- Create: `components/domain/net-worth/net-worth-composition-row.utils.ts`
- Test: `components/domain/net-worth/net-worth-composition-row.utils.test.ts`
- Create: `components/domain/net-worth/net-worth-period-selector.tsx`
- Create: `components/domain/net-worth/net-worth-chart-card.tsx`
- Create: `components/domain/net-worth/net-worth-composition-row.tsx`
- Create: `components/domain/net-worth/month-summary-card.tsx`
- Create: `components/domain/net-worth/index.ts`

**Interfaces:**
- Consumes: `NetWorthPeriod`, `NetWorthSeriesPoint`, `NetWorthChange` (Task 2); `parseDateOnly` from `lib/calc/expenses.ts`; `formatCurrency(value, currency, { maximumFractionDigits? })` from `lib/format.ts`; `Card`, `CardHeader`, `CardTitle`, `CardContent` from `components/ui/card`; `ChartContainer`, `ChartTooltip`, `type ChartConfig` from `components/ui/chart`; `cn` from `lib/utils`; type `Account`.
- Produces (all exported from the barrel):
  - `interface NetWorthCompositionItem { key: string; label: string; detail: string; amount: number; href: string }`
  - `buildCompositionItems(accounts: Account[]): NetWorthCompositionItem[]`
  - `NetWorthPeriodSelector` — props `{ value: NetWorthPeriod; onChange: (period: NetWorthPeriod) => void }`
  - `NetWorthChartCard` — props `{ series: NetWorthSeriesPoint[]; change: NetWorthChange; period: NetWorthPeriod; onPeriodChange: (period: NetWorthPeriod) => void; currency: string }`
  - `NetWorthCompositionRow` — props `{ items: NetWorthCompositionItem[]; currency: string }`
  - `MonthSummaryCard` — props `{ entrate: number; uscite: number; currency: string; href?: string }`

- [ ] **Step 1: Write the failing test**

Create `components/domain/net-worth/net-worth-composition-row.utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCompositionItems } from "./net-worth-composition-row.utils";
import type { Account } from "@/lib/db/schema/accounts";

function makeAccount(balance: string): Account {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    name: "Conto",
    type: "Conto corrente",
    balance,
    color: "slate",
    icon: "wallet",
    source: "manuale",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("buildCompositionItems", () => {
  it("nessuna voce senza conti", () => {
    expect(buildCompositionItems([])).toEqual([]);
  });

  it("una voce Liquidità con totale e numero di conti, che porta a Conti", () => {
    expect(buildCompositionItems([makeAccount("100.50"), makeAccount("-20.50")])).toEqual([
      { key: "liquidita", label: "Liquidità", detail: "2 conti", amount: 80, href: "/conti" },
    ]);
  });

  it("singolare con un solo conto", () => {
    expect(buildCompositionItems([makeAccount("10.00")])[0].detail).toBe("1 conto");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run components/domain/net-worth/net-worth-composition-row.utils.test.ts`
Expected: FAIL — `Failed to resolve import "./net-worth-composition-row.utils"`.

- [ ] **Step 3: Write the utils**

Create `components/domain/net-worth/net-worth-composition-row.utils.ts`:

```ts
import type { Account } from "@/lib/db/schema/accounts";

/** Item of the net worth composition row: one per existing asset class. */
export interface NetWorthCompositionItem {
  key: string;
  label: string;
  detail: string;
  amount: number;
  href: string;
}

/** Composition items for the asset classes present only; today only Liquidità, if the user has at least one account. */
export function buildCompositionItems(accounts: Account[]): NetWorthCompositionItem[] {
  if (accounts.length === 0) return [];
  const amount = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const detail = accounts.length === 1 ? "1 conto" : `${accounts.length} conti`;
  return [{ key: "liquidita", label: "Liquidità", detail, amount, href: "/conti" }];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run components/domain/net-worth/net-worth-composition-row.utils.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the period selector**

Create `components/domain/net-worth/net-worth-period-selector.tsx`:

```tsx
"use client";

/** 1M/3M/1A/Max period selector for the net worth chart (same pill pattern as CashflowPeriodSelector). */

import { cn } from "@/lib/utils";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";

const PERIOD_OPTIONS: { value: NetWorthPeriod; label: string }[] = [
  { value: "1mese", label: "1M" },
  { value: "3mesi", label: "3M" },
  { value: "1anno", label: "1A" },
  { value: "max", label: "Max" },
];

export interface NetWorthPeriodSelectorProps {
  value: NetWorthPeriod;
  onChange: (period: NetWorthPeriod) => void;
}

export function NetWorthPeriodSelector({ value, onChange }: NetWorthPeriodSelectorProps) {
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Write the chart card**

Create `components/domain/net-worth/net-worth-chart-card.tsx`:

```tsx
"use client";

/** Main Panoramica card: current net worth, change over the period, period selector and area chart. */

import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { parseDateOnly } from "@/lib/calc/expenses";
import type { NetWorthChange, NetWorthPeriod, NetWorthSeriesPoint } from "@/lib/calc/net-worth";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NetWorthPeriodSelector } from "./net-worth-period-selector";

const CHART_CONFIG = {
  value: { label: "Patrimonio netto", color: "var(--primary)" },
} satisfies ChartConfig;

const AREA_FILL_ID = "net-worth-area-fill";

const PERIOD_CHANGE_LABELS: Record<NetWorthPeriod, string> = {
  "1mese": "nell'ultimo mese",
  "3mesi": "negli ultimi 3 mesi",
  "1anno": "nell'ultimo anno",
  max: "dall'inizio",
};

const NO_HISTORY_MESSAGE = "L'andamento comparirà nei prossimi giorni.";
const ESTIMATED_LABEL = "stimato";
const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

interface NetWorthTooltipProps {
  active?: boolean;
  payload?: { payload: NetWorthSeriesPoint }[];
  currency: string;
}

function NetWorthTooltip({ active, payload, currency }: NetWorthTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">
        {TOOLTIP_DATE_FORMAT.format(parseDateOnly(point.date))}
        {point.isEstimated ? ` · ${ESTIMATED_LABEL}` : ""}
      </p>
      <p className="font-mono font-medium tabular-nums text-foreground">{formatCurrency(point.value, currency)}</p>
    </div>
  );
}

export interface NetWorthChartCardProps {
  series: NetWorthSeriesPoint[];
  change: NetWorthChange;
  period: NetWorthPeriod;
  onPeriodChange: (period: NetWorthPeriod) => void;
  currency: string;
}

export function NetWorthChartCard({ series, change, period, onPeriodChange, currency }: NetWorthChartCardProps) {
  const hasHistory = series.length >= 2;
  const isNegative = change.delta < 0;
  const sign = isNegative ? "−" : "+";
  const pctText = change.deltaPct !== null ? ` (${sign}${Math.abs(change.deltaPct * 100).toFixed(1)}%)` : "";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Patrimonio netto
          </CardTitle>
          <p className="font-heading text-4xl font-medium tabular-nums text-foreground">
            {formatCurrency(change.end, currency, { maximumFractionDigits: 0 })}
          </p>
          {hasHistory ? (
            <p className={cn("text-sm tabular-nums", isNegative ? "text-neg" : "text-pos")}>
              {sign}
              {formatCurrency(Math.abs(change.delta), currency, { maximumFractionDigits: 0 })}
              {pctText} <span className="text-muted-foreground">{PERIOD_CHANGE_LABELS[period]}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{NO_HISTORY_MESSAGE}</p>
          )}
        </div>
        {hasHistory ? <NetWorthPeriodSelector value={period} onChange={onPeriodChange} /> : null}
      </CardHeader>
      {hasHistory ? (
        <CardContent>
          <ChartContainer config={CHART_CONFIG} className="max-h-64 w-full">
            <AreaChart data={series}>
              <defs>
                <linearGradient id={AREA_FILL_ID} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <ChartTooltip cursor={false} content={<NetWorthTooltip currency={currency} />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                fill={`url(#${AREA_FILL_ID})`}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 7: Write the composition row and month summary**

Create `components/domain/net-worth/net-worth-composition-row.tsx`:

```tsx
/** Row of mini-cards with the net worth composition: one card per existing asset class, each linking to its section. */

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { NetWorthCompositionItem } from "./net-worth-composition-row.utils";

export interface NetWorthCompositionRowProps {
  items: NetWorthCompositionItem[];
  currency: string;
}

export function NetWorthCompositionRow({ items, currency }: NetWorthCompositionRowProps) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <Link key={item.key} href={item.href} className="rounded-xl transition-opacity hover:opacity-80">
          <Card>
            <CardContent className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="font-heading text-2xl font-medium tabular-nums text-foreground">
                {formatCurrency(item.amount, currency, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
```

Create `components/domain/net-worth/month-summary-card.tsx`:

```tsx
/** "Questo mese" card: income, outflows and how much was set aside in the current month, with a link to Cash flow. */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MonthSummaryCardProps {
  entrate: number;
  uscite: number;
  currency: string;
  href?: string;
}

export function MonthSummaryCard({ entrate, uscite, currency, href = "/cash-flow" }: MonthSummaryCardProps) {
  const saved = entrate - uscite;
  const format = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });

  return (
    <Link href={href} className="rounded-xl transition-opacity hover:opacity-80">
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Questo mese
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Entrate</p>
            <p className="font-heading text-xl font-medium tabular-nums text-pos">{format(entrate)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Uscite</p>
            <p className="font-heading text-xl font-medium tabular-nums text-neg">{format(uscite)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Messo da parte</p>
            <p className={cn("font-heading text-xl font-medium tabular-nums", saved < 0 ? "text-neg" : "text-pos")}>
              {format(saved)}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

Create `components/domain/net-worth/index.ts`:

```ts
/**
 * components/domain/net-worth — barrel file
 *
 * Single entry point for the components of the Panoramica screen.
 */

export { NetWorthPeriodSelector } from "./net-worth-period-selector";
export type { NetWorthPeriodSelectorProps } from "./net-worth-period-selector";
export { NetWorthChartCard } from "./net-worth-chart-card";
export type { NetWorthChartCardProps } from "./net-worth-chart-card";
export { NetWorthCompositionRow } from "./net-worth-composition-row";
export type { NetWorthCompositionRowProps } from "./net-worth-composition-row";
export { buildCompositionItems } from "./net-worth-composition-row.utils";
export type { NetWorthCompositionItem } from "./net-worth-composition-row.utils";
export { MonthSummaryCard } from "./month-summary-card";
export type { MonthSummaryCardProps } from "./month-summary-card";
```

- [ ] **Step 8: Type check and lint**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. If Recharts rejects the type of `content={<NetWorthTooltip ... />}`, compare with the custom tooltip already used in `components/domain/expenses/expense-trend-chart.tsx` and adopt the same signature.

Run: `pnpm lint`
Expected: no new errors in the `components/domain/net-worth/` files (only the 2 pre-existing ones remain).

- [ ] **Step 9: Commit**

```bash
git add components/domain/net-worth
git commit -m "feat: componenti Panoramica (grafico patrimonio, composizione, questo mese)"
```

---

### Task 7: Panoramica page, home redirect and documentation

**Files:**
- Create: `app/(app)/panoramica/page.tsx`
- Modify: `app/(app)/page.tsx` (full replacement)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `buildNetWorthSeries`, `computeNetWorthChange`, `toDateKey`, `type NetWorthPeriod` (Task 2); `useNetWorthSnapshotsQuery` (Task 5); components and `buildCompositionItems` from the `@/components/domain/net-worth` barrel (Task 6); `computeAccountsKpi` from `@/components/domain/accounts`; `useAccountsQuery` from `@/lib/queries/accounts`; `useTransactionsQuery` from `@/lib/queries/transactions`; `computeMonthlySeries` from `@/lib/calc/cashflow`; `startOfDay`, `startOfMonth`, `endOfMonth` from `@/lib/calc/expenses`; `authClient` from `@/lib/auth/client`.
- Produces: route `/panoramica`; `/` redirects to `/panoramica`.

- [ ] **Step 1: Write the page**

Create `app/(app)/panoramica/page.tsx`:

```tsx
"use client";

/** Panoramica page: net worth over time, composition by asset class and summary of the current month. */

import * as React from "react";
import Link from "next/link";
import { computeAccountsKpi } from "@/components/domain/accounts";
import {
  buildCompositionItems,
  MonthSummaryCard,
  NetWorthChartCard,
  NetWorthCompositionRow,
} from "@/components/domain/net-worth";
import { authClient } from "@/lib/auth/client";
import { computeMonthlySeries } from "@/lib/calc/cashflow";
import { endOfMonth, startOfDay, startOfMonth } from "@/lib/calc/expenses";
import { buildNetWorthSeries, computeNetWorthChange, toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useNetWorthSnapshotsQuery } from "@/lib/queries/net-worth";
import { useTransactionsQuery } from "@/lib/queries/transactions";

/** Start of the snapshot fetch window: the whole history, so changing period needs no new requests. */
const NET_WORTH_FETCH_FROM = "2000-01-01";
const DEFAULT_PERIOD: NetWorthPeriod = "3mesi";
const HEADER_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function PanoramicaPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [period, setPeriod] = React.useState<NetWorthPeriod>(DEFAULT_PERIOD);
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const monthRange = React.useMemo(() => ({ from: startOfMonth(today), to: endOfMonth(today) }), [today]);

  const accountsQuery = useAccountsQuery();
  const snapshotsQuery = useNetWorthSnapshotsQuery(NET_WORTH_FETCH_FROM, toDateKey(today));
  const monthTransactionsQuery = useTransactionsQuery(toDateKey(monthRange.from), toDateKey(monthRange.to), "tutte");

  const isLoading = accountsQuery.isLoading || snapshotsQuery.isLoading || monthTransactionsQuery.isLoading;
  const isError = accountsQuery.isError || snapshotsQuery.isError || monthTransactionsQuery.isError;
  const retry = () => {
    accountsQuery.refetch();
    snapshotsQuery.refetch();
    monthTransactionsQuery.refetch();
  };

  const accounts = accountsQuery.data ?? [];
  const { totalLiquidity } = computeAccountsKpi(accounts);
  const series = buildNetWorthSeries(snapshotsQuery.data ?? [], totalLiquidity, period, today);
  const change = computeNetWorthChange(series);
  const compositionItems = buildCompositionItems(accounts);
  const [currentMonth] = computeMonthlySeries(monthTransactionsQuery.data ?? [], monthRange);
  const headerDate = HEADER_DATE_FORMAT.format(today);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Panoramica</h1>
        <p className="text-sm text-muted-foreground">{headerDate.charAt(0).toUpperCase() + headerDate.slice(1)}</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <div className="h-80 animate-pulse rounded-xl bg-muted" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare i dati.{" "}
          <button onClick={retry} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-heading text-lg font-medium text-foreground">Nessun conto ancora</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggiungi o collega un conto per vedere il tuo patrimonio netto.
          </p>
          <Link href="/conti" className="mt-4 inline-block text-sm text-primary underline underline-offset-2">
            Vai a Conti
          </Link>
        </div>
      ) : (
        <>
          <NetWorthChartCard
            series={series}
            change={change}
            period={period}
            onPeriodChange={setPeriod}
            currency={currency}
          />
          <NetWorthCompositionRow items={compositionItems} currency={currency} />
          <MonthSummaryCard
            entrate={currentMonth?.entrate ?? 0}
            uscite={currentMonth?.uscite ?? 0}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace the home placeholder with a redirect**

Replace the whole content of `app/(app)/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

/** Home: the app's main screen is the Panoramica. */
export default function Home() {
  redirect("/panoramica");
}
```

- [ ] **Step 3: Verify the whole project**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: only the 2 known pre-existing errors.

Run: `pnpm exec vitest run lib/calc/net-worth.test.ts lib/net-worth app/api/net-worth components/domain/net-worth`
Expected: PASS.

Run: `pnpm exec vitest run`
Expected: no new failures (the 3 pre-existing ones in `lib/gocardless/scheduler.test.ts` remain).

Run: `pnpm build`
Expected: build succeeds, route `/panoramica` present in the list.

- [ ] **Step 4: Update CLAUDE.md**

In `CLAUDE.md`, section "Stato del progetto": replace the sentence starting with `**In corso ora**: schermata **Panoramica**` up to `esecuzione da avviare.` with:

```markdown
**In progress now**: no active plan. **Panoramica screen implemented** (plan `docs/superpowers/plans/2026-09-13-panoramica-patrimonio-netto.md`) — **manual user verification still to do**: estimated history visible for a user with Auto accounts, period switch 1M/3M/1A/Max, "stimato" tooltip, total updated after editing a balance, "nessun conto" state, redirect from `/`, first real snapshot written by the cron at 23:50.
```

In the same sentence listing the unimplemented screens (`Le altre schermate (Panoramica, Investimenti, ...`), remove "Panoramica, ".

In the "Log delle decisioni", under the 2026-09-13 entry, add an entry summarizing: tasks completed, any deviations from the plan, review outcome, remaining debt.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/panoramica/page.tsx" "app/(app)/page.tsx" CLAUDE.md
git commit -m "feat: pagina Panoramica con patrimonio netto nel tempo e redirect della home"
```
