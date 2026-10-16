# Conti (Accounts): manual sync with throttle + outcome feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Conti screen, show the last sync of each linked bank account, allow a manual sync with feedback (new/categorized/to-categorize transactions), respecting a budget shared with the automatic scheduler of at most 4 syncs per day per account and at least 4 hours between one sync and the next.

**Architecture:** New `sync_timestamps` column (jsonb) on `bank_account_links` + pure function `computeSyncEligibility` (24h sliding window + 4h minimum gap) shared between the existing cron scheduler and a new manual sync endpoint. `syncAccountLink` returns a structured summary (new/categorized/uncategorized) instead of `void`. UI: button + "last sync" text in `AccountRow`, toast (`sonner` library, new to the project) for the outcome.

**Tech Stack:** Next.js Route Handlers, Drizzle ORM/Postgres, TanStack Query, `sonner` (new dependency via shadcn), Vitest for tests.

## Global Constraints

- Sync budget: `MAX_SYNCS_PER_DAY = 4`, `MIN_SYNC_GAP_MS = 4h`, `SYNC_WINDOW_MS = 24h` — **shared** between the automatic scheduler and manual sync, **per account** (not per connection/bank).
- No DB migration is to be run autonomously by the agent: after modifying the Drizzle schema, the plan stops and explicitly asks the user to run `pnpm db:push` before continuing with the tasks that touch that column in the DB.
- Post-sync feedback via toast: `sonner` library, installed via `pnpm dlx shadcn@latest add sonner` (do not install `sonner` by hand via pnpm add — the shadcn component also generates the theme-aware wrapper).
- No new Tooltip component: the disabled state of the sync button uses the native `title` attribute.
- All user strings in Italian.
- The React components of this project have no automated tests (existing convention, see `components/domain/accounts/`): the check for the tasks that touch only UI is `pnpm build` + `pnpm lint`, not new tests. Manual verification in the browser remains the user's responsibility (no Postgres/Redis in the agentic sandbox).
- Wherever TypeScript code with new/changed types is touched, besides the tests also run `pnpm exec tsc --noEmit` — Vitest in this project does not type-check, it only transpiles.

---

### Task 1: `computeSyncEligibility` — pure sync budget function

**Files:**
- Create: `lib/gocardless/sync-eligibility.ts`
- Test: `lib/gocardless/sync-eligibility.test.ts`

**Interfaces:**
- Consumes: nothing (no dependency on other tasks).
- Produces: `MAX_SYNCS_PER_DAY: number`, `MIN_SYNC_GAP_MS: number`, `SYNC_WINDOW_MS: number`, `interface SyncEligibility { eligible: boolean; syncsUsedToday: number; syncsRemainingToday: number; nextEligibleAt: Date | null }`, `function computeSyncEligibility(recentSyncTimestamps: Date[], now: Date): SyncEligibility` — used by Task 2 (for `nextSyncEligibleAt`), Task 3 (scheduler), Task 4 (manual endpoint), Task 5 (status endpoint).

- [ ] **Step 1: Write the failing test**

```ts
// lib/gocardless/sync-eligibility.test.ts
import { describe, expect, it } from "vitest";
import { computeSyncEligibility, MAX_SYNCS_PER_DAY, MIN_SYNC_GAP_MS, SYNC_WINDOW_MS } from "./sync-eligibility";

const HOUR = 60 * 60 * 1000;
const now = new Date(1_800_000_000_000);

function hoursAgo(hours: number): Date {
  return new Date(now.getTime() - hours * HOUR);
}

describe("computeSyncEligibility", () => {
  it("nessuno storico: sempre eleggibile, 4 slot residui", () => {
    expect(computeSyncEligibility([], now)).toEqual({
      eligible: true,
      syncsUsedToday: 0,
      syncsRemainingToday: 4,
      nextEligibleAt: null,
    });
  });

  it("ultimo sync troppo recente (< 4h): non eleggibile, prossimo = ultimo + 4h", () => {
    const last = hoursAgo(3);
    const result = computeSyncEligibility([last], now);
    expect(result.eligible).toBe(false);
    expect(result.nextEligibleAt).toEqual(new Date(last.getTime() + MIN_SYNC_GAP_MS));
  });

  it("ultimo sync esattamente a 4h: eleggibile (bordo incluso)", () => {
    expect(computeSyncEligibility([hoursAgo(4)], now).eligible).toBe(true);
  });

  it("ultimo sync abbastanza vecchio (> 4h): eleggibile, un solo slot usato", () => {
    const result = computeSyncEligibility([hoursAgo(5)], now);
    expect(result.eligible).toBe(true);
    expect(result.syncsRemainingToday).toBe(3);
  });

  it("timestamp esattamente a 24h è fuori dalla finestra (bordo escluso)", () => {
    const result = computeSyncEligibility([hoursAgo(24)], now);
    expect(result.syncsUsedToday).toBe(0);
    expect(result.syncsRemainingToday).toBe(MAX_SYNCS_PER_DAY);
  });

  it("4 sync in finestra, ultimo abbastanza vecchio per il gap: blocca per tetto giornaliero", () => {
    const timestamps = [hoursAgo(23), hoursAgo(18), hoursAgo(10), hoursAgo(5)];
    const result = computeSyncEligibility(timestamps, now);
    expect(result.eligible).toBe(false);
    expect(result.syncsUsedToday).toBe(4);
    expect(result.syncsRemainingToday).toBe(0);
    expect(result.nextEligibleAt).toEqual(new Date(hoursAgo(23).getTime() + SYNC_WINDOW_MS));
  });

  it("4 sync recenti e ravvicinati: il tetto giornaliero domina sul gap minimo", () => {
    const timestamps = [hoursAgo(3), hoursAgo(2), hoursAgo(1), hoursAgo(0.5)];
    const result = computeSyncEligibility(timestamps, now);
    expect(result.eligible).toBe(false);
    expect(result.nextEligibleAt).toEqual(new Date(hoursAgo(3).getTime() + SYNC_WINDOW_MS));
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec vitest run lib/gocardless/sync-eligibility.test.ts`
Expected: FAIL — `Cannot find module './sync-eligibility'` (the file does not exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// lib/gocardless/sync-eligibility.ts
export const MAX_SYNCS_PER_DAY = 4;
export const MIN_SYNC_GAP_MS = 4 * 60 * 60 * 1000;
export const SYNC_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SyncEligibility {
  eligible: boolean;
  syncsUsedToday: number;
  syncsRemainingToday: number;
  nextEligibleAt: Date | null;
}

/**
 * Eligibility of a sync (automatic or manual) given the history of recent
 * timestamps: cap of MAX_SYNCS_PER_DAY in a 24h sliding window, plus a
 * minimum gap of 4h from the last sync. `nextEligibleAt` is the moment when
 * BOTH conditions become true again (the later of the two deadlines).
 */
export function computeSyncEligibility(recentSyncTimestamps: Date[], now: Date): SyncEligibility {
  const windowStart = now.getTime() - SYNC_WINDOW_MS;
  const recentInWindow = recentSyncTimestamps
    .filter((t) => t.getTime() > windowStart)
    .sort((a, b) => a.getTime() - b.getTime());

  const syncsUsedToday = recentInWindow.length;
  const syncsRemainingToday = Math.max(0, MAX_SYNCS_PER_DAY - syncsUsedToday);
  const capOk = syncsUsedToday < MAX_SYNCS_PER_DAY;

  const lastSync = recentSyncTimestamps.reduce<Date | null>(
    (latest, t) => (!latest || t.getTime() > latest.getTime() ? t : latest),
    null
  );
  const minGapOk = !lastSync || now.getTime() - lastSync.getTime() >= MIN_SYNC_GAP_MS;

  const eligible = minGapOk && capOk;

  const minGapDeadline = lastSync ? lastSync.getTime() + MIN_SYNC_GAP_MS : -Infinity;
  const capDeadline = capOk ? -Infinity : recentInWindow[0].getTime() + SYNC_WINDOW_MS;
  const nextEligibleAt = eligible ? null : new Date(Math.max(minGapDeadline, capDeadline));

  return { eligible, syncsUsedToday, syncsRemainingToday, nextEligibleAt };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm exec vitest run lib/gocardless/sync-eligibility.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/gocardless/sync-eligibility.ts lib/gocardless/sync-eligibility.test.ts
git commit -m "feat: aggiunge computeSyncEligibility per il budget condiviso di sync"
```

---

### Task 2: `sync_timestamps` schema + `syncAccountLink` with extended result

**Files:**
- Modify: `lib/db/schema/bank-connections.ts` (`syncTimestamps` column on `bankAccountLinks`)
- Modify: `lib/gocardless/sync.ts`
- Modify: `lib/gocardless/sync.test.ts`

**Interfaces:**
- Consumes: `MIN_SYNC_GAP_MS` from `./sync-eligibility` (Task 1).
- Produces: `bankAccountLinks.syncTimestamps: string[]` (DB column), `export type SyncResult = { status: "synced"; newTransactionsCount: number; categorizedCount: number; uncategorizedCount: number; balanceUpdated: true } | { status: "gocardless-limited" } | { status: "expired" }`, `syncAccountLink(link: SyncableLink, rateLimitStore: RateLimitStore): Promise<SyncResult>` (it was `Promise<void>`) — used by Tasks 3, 4, 7, 8.

- [ ] **Step 1: Add the column to the schema**

Modify `lib/db/schema/bank-connections.ts`, line 1 (import) and the `bankAccountLinks` block (lines 31-44):

```ts
import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
```

```ts
export const bankAccountLinks = pgTable("bank_account_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => bankConnections.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  externalAccountId: text("external_account_id").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  nextSyncEligibleAt: timestamp("next_sync_eligible_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Last (at most 4) ISO timestamps of successful syncs, automatic or manual,
  // used by computeSyncEligibility for the shared 4/day budget + 4h gap.
  syncTimestamps: jsonb("sync_timestamps").$type<string[]>().notNull().default([]),
});
```

- [ ] **Step 2: USER ACTION REQUIRED — apply the migration**

This repo never has an agent run `pnpm db:push` (local DB shared with `main`, convention established in CLAUDE.md). **Stop here and explicitly ask the user to run:**

```bash
pnpm db:push
```

Do not continue with Step 3 until the user confirms having done it — the tests of this task and of the following Tasks 3-5 fail against a DB without the `sync_timestamps` column.

- [ ] **Step 3: Write the failing tests (extended result + counts + storage)**

Replace the contents of `lib/gocardless/sync.test.ts` with:

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { MIN_SYNC_GAP_MS } from "./sync-eligibility";
import type { RateLimitStore } from "./rate-limit";

vi.mock("@/lib/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/client")>();
  return { ...actual, getAccountBalances: vi.fn(), getAccountTransactions: vi.fn() };
});

import { getAccountBalances, getAccountTransactions, GoCardlessError } from "./client";
import { syncAccountLink, type SyncableLink } from "./sync";

function createMemoryStore(): RateLimitStore {
  const map = new Map<string, string>();
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

describe("syncAccountLink", () => {
  let userId: string;
  let link: SyncableLink;

  beforeEach(async () => {
    const testId = `test-sync-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Sync",
        email: `test-sync-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "linked" })
      .returning();
    const [linkRow] = await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-1" })
      .returning();

    link = {
      linkId: linkRow.id,
      connectionId: connection.id,
      accountId: account.id,
      externalAccountId: "ext-1",
      userId,
    };

    vi.mocked(getAccountBalances).mockReset();
    vi.mocked(getAccountTransactions).mockReset();
  });

  afterAll(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await client.end();
  });

  it("aggiorna saldo, importa transazioni e conta il risultato come non categorizzato (fallback)", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "150.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: { remaining: 3, resetSeconds: 3600 },
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-1",
          transactionAmount: { amount: "-20.00", currency: "EUR" },
          remittanceInformationUnstructured: "Supermercato",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: { remaining: 3, resetSeconds: 3600 },
    });

    const result = await syncAccountLink(link, createMemoryStore());
    expect(result).toEqual({
      status: "synced",
      newTransactionsCount: 1,
      categorizedCount: 0,
      uncategorizedCount: 1,
      balanceUpdated: true,
    });

    const [account] = await db.select().from(accounts).where(eq(accounts.id, link.accountId));
    expect(account.balance).toBe("150.00");

    const storedTransactions = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(storedTransactions).toHaveLength(1);
    expect(storedTransactions[0].externalId).toBe("tx-1");
    expect(storedTransactions[0].amount).toBe("-20.00");
  });

  it("distingue le transazioni categorizzate per storico da quelle finite nel fallback", async () => {
    const [category] = await db.insert(categories).values({ userId, name: "Spesa", type: "variabile" }).returning();
    await db.insert(transactions).values({
      userId,
      accountId: link.accountId,
      categoryId: category.id,
      description: "Supermercato",
      amount: "-10.00",
      date: "2026-06-01",
      source: "manuale",
    });

    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-cat",
          transactionAmount: { amount: "-15.00", currency: "EUR" },
          remittanceInformationUnstructured: "Supermercato",
          bookingDate: "2026-07-02",
        },
        {
          internalTransactionId: "tx-fallback",
          transactionAmount: { amount: "-5.00", currency: "EUR" },
          remittanceInformationUnstructured: "Sconosciuto",
          bookingDate: "2026-07-02",
        },
      ],
      rateLimit: null,
    });

    const result = await syncAccountLink(link, createMemoryStore());
    expect(result).toEqual({
      status: "synced",
      newTransactionsCount: 2,
      categorizedCount: 1,
      uncategorizedCount: 1,
      balanceUpdated: true,
    });
  });

  it("è idempotente: un secondo sync con la stessa transazione non la riconta come nuova", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "150.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-1",
          transactionAmount: { amount: "-20.00", currency: "EUR" },
          remittanceInformationUnstructured: "Supermercato",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());
    const secondResult = await syncAccountLink(link, createMemoryStore());

    expect(secondResult).toEqual({
      status: "synced",
      newTransactionsCount: 0,
      categorizedCount: 0,
      uncategorizedCount: 0,
      balanceUpdated: true,
    });
    const storedTransactions = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(storedTransactions).toHaveLength(1);
  });

  it("su 401 marca la connessione come 'expired' e ritorna status 'expired'", async () => {
    vi.mocked(getAccountBalances).mockRejectedValue(new GoCardlessError("unauthorized", 401));

    const result = await syncAccountLink(link, createMemoryStore());
    expect(result).toEqual({ status: "expired" });

    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.id, link.connectionId));
    expect(connection.status).toBe("expired");
  });

  it("aggiorna lastSyncedAt/syncTimestamps/nextSyncEligibleAt dopo un sync riuscito", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "50.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({ transactions: [], rateLimit: null });

    const before = Date.now();
    await syncAccountLink(link, createMemoryStore());

    const [updatedLink] = await db.select().from(bankAccountLinks).where(eq(bankAccountLinks.id, link.linkId));
    expect(updatedLink.lastSyncedAt).not.toBeNull();
    expect(updatedLink.syncTimestamps).toHaveLength(1);
    expect(new Date(updatedLink.syncTimestamps[0]).getTime()).toBeGreaterThanOrEqual(before);
    expect(updatedLink.nextSyncEligibleAt.getTime()).toBeGreaterThanOrEqual(before + MIN_SYNC_GAP_MS);
  });

  it("mantiene solo gli ultimi 4 timestamp di sync", async () => {
    await db
      .update(bankAccountLinks)
      .set({
        syncTimestamps: [4, 8, 12, 16].map((h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString()),
      })
      .where(eq(bankAccountLinks.id, link.linkId));

    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "0", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({ transactions: [], rateLimit: null });

    await syncAccountLink(link, createMemoryStore());

    const [updatedLink] = await db.select().from(bankAccountLinks).where(eq(bankAccountLinks.id, link.linkId));
    expect(updatedLink.syncTimestamps).toHaveLength(4);
  });
});
```

- [ ] **Step 4: Run the test and verify it fails**

Run: `pnpm exec vitest run lib/gocardless/sync.test.ts`
Expected: FAIL — `syncAccountLink` still returns `undefined`, the `expect(result).toEqual(...)` fail.

- [ ] **Step 5: Rewrite `syncAccountLink`**

Replace the contents of `lib/gocardless/sync.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { transactions } from "@/lib/db/schema/transactions";
import { GoCardlessError, getAccountBalances, getAccountTransactions } from "./client";
import { isRateLimited, recordRateLimit, type RateLimitStore } from "./rate-limit";
import { getFallbackCategoryId, resolveCategoryId } from "./categorize";
import { MIN_SYNC_GAP_MS } from "./sync-eligibility";

const MAX_STORED_SYNC_TIMESTAMPS = 4;

export interface SyncableLink {
  linkId: string;
  connectionId: string;
  accountId: string;
  externalAccountId: string;
  userId: string;
}

export type SyncResult =
  | {
      status: "synced";
      newTransactionsCount: number;
      categorizedCount: number;
      uncategorizedCount: number;
      balanceUpdated: true;
    }
  | { status: "gocardless-limited" }
  | { status: "expired" };

/** Syncs balance and transactions of a linked account; updates the timestamps or marks the connection as expired. */
export async function syncAccountLink(link: SyncableLink, rateLimitStore: RateLimitStore): Promise<SyncResult> {
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "balances")) {
    return { status: "gocardless-limited" };
  }
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "transactions")) {
    return { status: "gocardless-limited" };
  }

  try {
    const { balance, rateLimit: balanceRateLimit } = await getAccountBalances(link.externalAccountId);
    if (balanceRateLimit) {
      await recordRateLimit(
        rateLimitStore,
        link.externalAccountId,
        "balances",
        balanceRateLimit.remaining,
        balanceRateLimit.resetSeconds
      );
    }
    await db
      .update(accounts)
      .set({ balance: balance.balanceAmount.amount, updatedAt: new Date() })
      .where(eq(accounts.id, link.accountId));

    const { transactions: bankTransactions, rateLimit: txRateLimit } = await getAccountTransactions(
      link.externalAccountId
    );
    if (txRateLimit) {
      await recordRateLimit(
        rateLimitStore,
        link.externalAccountId,
        "transactions",
        txRateLimit.remaining,
        txRateLimit.resetSeconds
      );
    }

    const fallbackCategoryId = await getFallbackCategoryId(link.userId);
    let newTransactionsCount = 0;
    let categorizedCount = 0;
    let uncategorizedCount = 0;

    for (const bankTransaction of bankTransactions) {
      const externalId = bankTransaction.internalTransactionId ?? bankTransaction.transactionId;
      if (!externalId) continue;

      const description = bankTransaction.remittanceInformationUnstructured ?? "Movimento bancario";
      const categoryId = await resolveCategoryId(link.userId, description);

      const [inserted] = await db
        .insert(transactions)
        .values({
          userId: link.userId,
          accountId: link.accountId,
          categoryId,
          description,
          amount: bankTransaction.transactionAmount.amount,
          date: bankTransaction.bookingDate,
          source: "auto",
          externalId,
        })
        .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
        .returning({ categoryId: transactions.categoryId });

      if (inserted) {
        newTransactionsCount += 1;
        if (inserted.categoryId === fallbackCategoryId) {
          uncategorizedCount += 1;
        } else {
          categorizedCount += 1;
        }
      }
    }

    const [currentLink] = await db
      .select({ syncTimestamps: bankAccountLinks.syncTimestamps })
      .from(bankAccountLinks)
      .where(eq(bankAccountLinks.id, link.linkId));
    const now = new Date();
    const updatedTimestamps = [now.toISOString(), ...(currentLink?.syncTimestamps ?? [])].slice(
      0,
      MAX_STORED_SYNC_TIMESTAMPS
    );

    await db
      .update(bankAccountLinks)
      .set({
        lastSyncedAt: now,
        syncTimestamps: updatedTimestamps,
        nextSyncEligibleAt: new Date(now.getTime() + MIN_SYNC_GAP_MS),
      })
      .where(eq(bankAccountLinks.id, link.linkId));

    return { status: "synced", newTransactionsCount, categorizedCount, uncategorizedCount, balanceUpdated: true };
  } catch (error) {
    if (error instanceof GoCardlessError && error.status === 401) {
      await db
        .update(bankConnections)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(bankConnections.id, link.connectionId));
      return { status: "expired" };
    }
    throw error;
  }
}
```

- [ ] **Step 6: Run the test and verify it passes**

Run: `pnpm exec vitest run lib/gocardless/sync.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Verify the types**

Run: `pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema/bank-connections.ts lib/gocardless/sync.ts lib/gocardless/sync.test.ts
git commit -m "feat: syncAccountLink ritorna un riepilogo strutturato e traccia i timestamp di sync"
```

---

### Task 3: Scheduler — respects the shared budget

**Files:**
- Modify: `lib/gocardless/scheduler.ts`
- Modify: `lib/gocardless/scheduler.test.ts`

**Interfaces:**
- Consumes: `computeSyncEligibility` (Task 1), `syncAccountLink`/`SyncableLink` (Task 2, the `SyncableLink` signature is unchanged).
- Produces: `interface DueLink extends SyncableLink { syncTimestamps: string[] }`, `findDueLinks(): Promise<DueLink[]>` (it was `Promise<SyncableLink[]>`) — no other task consumes `findDueLinks` directly.

- [ ] **Step 1: Write the failing test**

Add at the bottom of `lib/gocardless/scheduler.test.ts` (inside the `describe("scheduler", ...)` block, after the existing test "runDueSyncs chiama syncAccountLink..."):

```ts
  it("salta i link che hanno esaurito il budget condiviso di sync anche se nextSyncEligibleAt è passato", async () => {
    const past = new Date(Date.now() - 60_000);
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "linked" })
      .returning();
    const recentTimestamps = [0, 6, 12, 18].map((h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString());
    await db.insert(bankAccountLinks).values({
      connectionId: connection.id,
      accountId: account.id,
      externalAccountId: "ext-1",
      nextSyncEligibleAt: past,
      syncTimestamps: recentTimestamps,
    });

    await runDueSyncs();

    expect(syncAccountLink).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec vitest run lib/gocardless/scheduler.test.ts`
Expected: FAIL — `syncAccountLink` is called (the scheduler does not check the shared budget yet).

- [ ] **Step 3: Update the scheduler**

Replace the contents of `lib/gocardless/scheduler.ts`:

```ts
import cron from "node-cron";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { computeSyncEligibility } from "./sync-eligibility";
import { redisRateLimitStore } from "./redis-rate-limit-store";
import { syncAccountLink, type SyncableLink } from "./sync";

export interface DueLink extends SyncableLink {
  syncTimestamps: string[];
}

/** Linked accounts with an overdue sync and a still valid connection (not expired/error). */
export async function findDueLinks(): Promise<DueLink[]> {
  return db
    .select({
      linkId: bankAccountLinks.id,
      connectionId: bankAccountLinks.connectionId,
      accountId: bankAccountLinks.accountId,
      externalAccountId: bankAccountLinks.externalAccountId,
      userId: bankConnections.userId,
      syncTimestamps: bankAccountLinks.syncTimestamps,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(and(lte(bankAccountLinks.nextSyncEligibleAt, new Date()), eq(bankConnections.status, "linked")));
}

/**
 * Syncs all the due accounts. An error on one account (network, GoCardless 5xx)
 * is logged and must not block the sync of the other accounts in the same tick.
 * Silently skips the accounts that have already used up the shared sync budget
 * (4/day, 4h minimum gap) because of manual syncs that happened in the meantime.
 */
export async function runDueSyncs(): Promise<void> {
  const due = await findDueLinks();
  const now = new Date();
  for (const link of due) {
    const timestamps = link.syncTimestamps.map((t) => new Date(t));
    if (!computeSyncEligibility(timestamps, now).eligible) continue;
    try {
      await syncAccountLink(link, redisRateLimitStore);
    } catch (error) {
      console.error(`Sync fallito per il conto ${link.accountId}`, error);
    }
  }
}

let started = false;

/** Starts the cron scheduler (every 12h); no-op if already started in the current process. */
export function startGoCardlessScheduler(): void {
  if (started) return;
  started = true;
  cron.schedule("0 */12 * * *", () => {
    runDueSyncs().catch((error) => console.error("Sync GoCardless fallito", error));
  });
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm exec vitest run lib/gocardless/scheduler.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Verify the types**

Run: `pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add lib/gocardless/scheduler.ts lib/gocardless/scheduler.test.ts
git commit -m "feat: lo scheduler rispetta il budget condiviso di sync anche se nextSyncEligibleAt è passato"
```

---

### Task 4: Manual sync endpoint

**Files:**
- Create: `app/api/gocardless/accounts/[accountId]/sync/route.ts`
- Test: `app/api/gocardless/accounts/[accountId]/sync/route.test.ts`

**Interfaces:**
- Consumes: `computeSyncEligibility` (Task 1), `syncAccountLink`/`SyncResult` (Task 2), `redisRateLimitStore` (existing, `lib/gocardless/redis-rate-limit-store.ts`).
- Produces: `POST /api/gocardless/accounts/[accountId]/sync` — 200 `SyncResult` (`synced` variant), 404 if the account does not belong to the user or is not `linked`, 429 `{ status: "not-eligible" | "gocardless-limited"; nextEligibleAt?: Date | null; syncsRemainingToday?: number }`, 409 `{ status: "expired" }`. Consumed by Task 8 (`useSyncAccountMutation`).

- [ ] **Step 1: Write the failing test**

```ts
// app/api/gocardless/accounts/[accountId]/sync/route.test.ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/gocardless/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/sync")>();
  return { ...actual, syncAccountLink: vi.fn() };
});

import { auth } from "@/lib/auth";
import { syncAccountLink } from "@/lib/gocardless/sync";
import { POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("POST /api/gocardless/accounts/[accountId]/sync", () => {
  let userId: string;
  let accountId: string;

  async function createLinkedAccount(syncTimestamps: string[] = []) {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "linked" })
      .returning();
    await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-1", syncTimestamps });
    accountId = account.id;
  }

  beforeEach(async () => {
    const testId = `test-manual-sync-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Manual Sync",
        email: `test-manual-sync-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(syncAccountLink).mockReset();
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 404 se il conto non è dell'utente collegato", async () => {
    await createLinkedAccount();
    mockedGetSession.mockResolvedValueOnce({ user: { id: "altro-utente" } } as never);

    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/accounts/${accountId}/sync`, { method: "POST" }),
      { params: Promise.resolve({ accountId }) }
    );
    expect(response.status).toBe(404);
    expect(syncAccountLink).not.toHaveBeenCalled();
  });

  it("risponde 429 senza chiamare syncAccountLink se il budget condiviso è esaurito", async () => {
    const recentTimestamps = [0, 6, 12, 18].map((h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString());
    await createLinkedAccount(recentTimestamps);

    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/accounts/${accountId}/sync`, { method: "POST" }),
      { params: Promise.resolve({ accountId }) }
    );
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.status).toBe("not-eligible");
    expect(syncAccountLink).not.toHaveBeenCalled();
  });

  it("sincronizza e restituisce il riepilogo quando eleggibile", async () => {
    await createLinkedAccount();
    vi.mocked(syncAccountLink).mockResolvedValue({
      status: "synced",
      newTransactionsCount: 3,
      categorizedCount: 2,
      uncategorizedCount: 1,
      balanceUpdated: true,
    });

    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/accounts/${accountId}/sync`, { method: "POST" }),
      { params: Promise.resolve({ accountId }) }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "synced",
      newTransactionsCount: 3,
      categorizedCount: 2,
      uncategorizedCount: 1,
      balanceUpdated: true,
    });
  });

  it("mappa 'gocardless-limited' a 429 ed 'expired' a 409", async () => {
    await createLinkedAccount();

    vi.mocked(syncAccountLink).mockResolvedValueOnce({ status: "gocardless-limited" });
    const limitedResponse = await POST(
      new NextRequest(`http://localhost/api/gocardless/accounts/${accountId}/sync`, { method: "POST" }),
      { params: Promise.resolve({ accountId }) }
    );
    expect(limitedResponse.status).toBe(429);

    vi.mocked(syncAccountLink).mockResolvedValueOnce({ status: "expired" });
    const expiredResponse = await POST(
      new NextRequest(`http://localhost/api/gocardless/accounts/${accountId}/sync`, { method: "POST" }),
      { params: Promise.resolve({ accountId }) }
    );
    expect(expiredResponse.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec vitest run app/api/gocardless/accounts/[accountId]/sync/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (the file does not exist yet).

- [ ] **Step 3: Write the endpoint**

```ts
// app/api/gocardless/accounts/[accountId]/sync/route.ts
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "@/lib/gocardless/redis-rate-limit-store";
import { syncAccountLink } from "@/lib/gocardless/sync";
import { computeSyncEligibility } from "@/lib/gocardless/sync-eligibility";

export async function POST(request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const { accountId } = await params;

  const [link] = await db
    .select({
      linkId: bankAccountLinks.id,
      connectionId: bankAccountLinks.connectionId,
      accountId: bankAccountLinks.accountId,
      externalAccountId: bankAccountLinks.externalAccountId,
      syncTimestamps: bankAccountLinks.syncTimestamps,
      userId: bankConnections.userId,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(
      and(
        eq(bankAccountLinks.accountId, accountId),
        eq(bankConnections.userId, session.user.id),
        eq(bankConnections.status, "linked")
      )
    );

  if (!link) return Response.json({ error: "Conto non trovato o non collegato" }, { status: 404 });

  const eligibility = computeSyncEligibility(
    link.syncTimestamps.map((t) => new Date(t)),
    new Date()
  );
  if (!eligibility.eligible) {
    return Response.json(
      {
        status: "not-eligible",
        nextEligibleAt: eligibility.nextEligibleAt,
        syncsRemainingToday: eligibility.syncsRemainingToday,
      },
      { status: 429 }
    );
  }

  const result = await syncAccountLink(link, redisRateLimitStore);

  if (result.status === "gocardless-limited") {
    return Response.json({ status: "gocardless-limited" }, { status: 429 });
  }
  if (result.status === "expired") {
    return Response.json({ status: "expired" }, { status: 409 });
  }
  return Response.json(result, { status: 200 });
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm exec vitest run app/api/gocardless/accounts/[accountId]/sync/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Verify the types**

Run: `pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "app/api/gocardless/accounts/[accountId]/sync/route.ts" "app/api/gocardless/accounts/[accountId]/sync/route.test.ts"
git commit -m "feat: aggiunge l'endpoint di sync manuale per singolo conto"
```

---

### Task 5: Extend the status endpoint with sync eligibility

**Files:**
- Modify: `app/api/gocardless/connections/route.ts` (`GET` only, lines 9-20)
- Modify: `app/api/gocardless/connections/route.test.ts` (the test "GET restituisce lo stato delle connessioni per conto")

**Interfaces:**
- Consumes: `computeSyncEligibility` (Task 1).
- Produces: `GET /api/gocardless/connections` now returns `{ accountId, status, lastSyncedAt, eligible, nextEligibleAt, syncsRemainingToday }[]` (it was `{ accountId, status }[]`) — consumed by Task 8/9 on the frontend.

- [ ] **Step 1: Update the existing test (it fails against the current implementation)**

In `app/api/gocardless/connections/route.test.ts`, replace the test `"GET restituisce lo stato delle connessioni per conto"` with:

```ts
  it("GET restituisce lo stato delle connessioni per conto, incluso l'ultimo sync e l'eleggibilità", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "expired" })
      .returning();
    await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-1" });

    const response = await GET(new NextRequest("http://localhost/api/gocardless/connections"));
    const body = await response.json();
    expect(body).toEqual([
      {
        accountId: account.id,
        status: "expired",
        lastSyncedAt: null,
        eligible: true,
        nextEligibleAt: null,
        syncsRemainingToday: 4,
      },
    ]);
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec vitest run app/api/gocardless/connections/route.test.ts`
Expected: FAIL — the returned body does not have `lastSyncedAt`/`eligible`/`nextEligibleAt`/`syncsRemainingToday` yet.

- [ ] **Step 3: Update the GET handler**

In `app/api/gocardless/connections/route.ts`, add the import at the top of the file:

```ts
import { computeSyncEligibility } from "@/lib/gocardless/sync-eligibility";
```

Replace the whole `GET` function (lines 9-20):

```ts
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const rows = await db
    .select({
      accountId: bankAccountLinks.accountId,
      status: bankConnections.status,
      lastSyncedAt: bankAccountLinks.lastSyncedAt,
      syncTimestamps: bankAccountLinks.syncTimestamps,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(eq(bankConnections.userId, session.user.id));

  const now = new Date();
  return Response.json(
    rows.map((row) => {
      const eligibility = computeSyncEligibility(
        row.syncTimestamps.map((t) => new Date(t)),
        now
      );
      return {
        accountId: row.accountId,
        status: row.status,
        lastSyncedAt: row.lastSyncedAt,
        eligible: eligibility.eligible,
        nextEligibleAt: eligibility.nextEligibleAt,
        syncsRemainingToday: eligibility.syncsRemainingToday,
      };
    })
  );
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm exec vitest run app/api/gocardless/connections/route.test.ts`
Expected: PASS (all the tests of the file)

- [ ] **Step 5: Verify the types**

Run: `pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/api/gocardless/connections/route.ts app/api/gocardless/connections/route.test.ts
git commit -m "feat: lo status endpoint espone ultimo sync ed eleggibilità per conto"
```

---

### Task 6: `formatRelativeTime`

**Files:**
- Modify: `lib/format.ts`
- Modify: `lib/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatRelativeTime(date: Date, now?: Date): string` — used by Task 9 (`AccountRow`).

- [ ] **Step 1: Write the failing test**

Add at the bottom of `lib/format.test.ts`:

```ts
import { formatCurrency, formatRelativeTime, getCurrencySymbol } from "./format";

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-26T12:00:00.000Z");

  it("restituisce 'adesso' per meno di un minuto fa", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 30_000), now)).toBe("adesso");
  });

  it("restituisce i minuti per meno di un'ora fa", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000), now)).toBe("5 min fa");
  });

  it("restituisce le ore per meno di un giorno fa", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 60 * 60_000), now)).toBe("3 h fa");
  });

  it("restituisce i giorni per meno di 7 giorni fa", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 2 * 24 * 60 * 60_000), now)).toBe("2 giorni fa");
  });

  it("restituisce una data assoluta breve oltre i 7 giorni", () => {
    const past = new Date(now.getTime() - 10 * 24 * 60 * 60_000);
    const expected = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(past);
    expect(formatRelativeTime(past, now)).toBe(expected);
  });
});
```

(Note: the line `import { formatCurrency, formatRelativeTime, getCurrencySymbol } from "./format";` replaces the existing import at the top of the file, line 2.)

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec vitest run lib/format.test.ts`
Expected: FAIL — `formatRelativeTime` is not exported from `./format`.

- [ ] **Step 3: Implement `formatRelativeTime`**

Add at the bottom of `lib/format.ts`:

```ts
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_TIME_MAX_DAYS = 7;

/**
 * Formats the time distance between `date` and `now` in Italian, with decreasing
 * granularity (minutes/hours/days); beyond RELATIVE_TIME_MAX_DAYS days it falls back to
 * a short absolute date (e.g. "12 lug").
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < MINUTE_MS) return "adesso";
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)} min fa`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)} h fa`;
  if (diffMs < RELATIVE_TIME_MAX_DAYS * DAY_MS) return `${Math.floor(diffMs / DAY_MS)} giorni fa`;
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(date);
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm exec vitest run lib/format.test.ts`
Expected: PASS (all the tests of the file)

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts lib/format.test.ts
git commit -m "feat: aggiunge formatRelativeTime per l'ultimo sync in Conti"
```

---

### Task 7: Toast messages (`sync-messages.ts`)

**Files:**
- Create: `lib/gocardless/sync-messages.ts`
- Test: `lib/gocardless/sync-messages.test.ts`

**Interfaces:**
- Consumes: `SyncResult` (type-only, from `./sync`, Task 2).
- Produces: `export type SyncSuccessResult = Extract<SyncResult, { status: "synced" }>`, `export type SyncErrorInfo = { status: "not-eligible"; nextEligibleAt: string | null; syncsRemainingToday: number } | { status: "gocardless-limited" } | { status: "expired" } | { status: "unknown" }`, `buildSyncSummaryMessage(result: SyncSuccessResult): string`, `buildSyncErrorMessage(error: SyncErrorInfo): string` — used by Task 8 (`useSyncAccountMutation`).

- [ ] **Step 1: Write the failing test**

```ts
// lib/gocardless/sync-messages.test.ts
import { describe, expect, it } from "vitest";
import { buildSyncErrorMessage, buildSyncSummaryMessage } from "./sync-messages";

describe("buildSyncSummaryMessage", () => {
  it("segnala nessuna nuova transazione", () => {
    expect(
      buildSyncSummaryMessage({
        status: "synced",
        newTransactionsCount: 0,
        categorizedCount: 0,
        uncategorizedCount: 0,
        balanceUpdated: true,
      })
    ).toBe("Nessuna nuova transazione trovata. Saldo aggiornato.");
  });

  it("riepiloga nuove transazioni categorizzate e non", () => {
    expect(
      buildSyncSummaryMessage({
        status: "synced",
        newTransactionsCount: 5,
        categorizedCount: 3,
        uncategorizedCount: 2,
        balanceUpdated: true,
      })
    ).toBe("5 nuove transazioni (3 categorizzate, 2 da categorizzare). Saldo aggiornato.");
  });

  it("usa il singolare per una sola transazione categorizzata", () => {
    expect(
      buildSyncSummaryMessage({
        status: "synced",
        newTransactionsCount: 1,
        categorizedCount: 1,
        uncategorizedCount: 0,
        balanceUpdated: true,
      })
    ).toBe("1 nuova transazione (1 categorizzata). Saldo aggiornato.");
  });
});

describe("buildSyncErrorMessage", () => {
  it("gocardless-limited", () => {
    expect(buildSyncErrorMessage({ status: "gocardless-limited" })).toBe(
      "La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi."
    );
  });

  it("expired", () => {
    expect(buildSyncErrorMessage({ status: "expired" })).toBe(
      "Sessione con la banca scaduta. Riconnetti il conto per sincronizzare."
    );
  });

  it("not-eligible con orario", () => {
    const nextEligibleAt = new Date("2026-07-26T15:30:00.000Z").toISOString();
    const message = buildSyncErrorMessage({ status: "not-eligible", nextEligibleAt, syncsRemainingToday: 0 });
    expect(message).toContain("Prossimo disponibile alle");
  });

  it("not-eligible senza orario", () => {
    expect(buildSyncErrorMessage({ status: "not-eligible", nextEligibleAt: null, syncsRemainingToday: 0 })).toBe(
      "Sync non disponibile al momento. Riprova più tardi."
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec vitest run lib/gocardless/sync-messages.test.ts`
Expected: FAIL — `Cannot find module './sync-messages'`.

- [ ] **Step 3: Implement `sync-messages.ts`**

```ts
// lib/gocardless/sync-messages.ts
import type { SyncResult } from "./sync";

export type SyncSuccessResult = Extract<SyncResult, { status: "synced" }>;

export type SyncErrorInfo =
  | { status: "not-eligible"; nextEligibleAt: string | null; syncsRemainingToday: number }
  | { status: "gocardless-limited" }
  | { status: "expired" }
  | { status: "unknown" };

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** Success message shown in the toast after a successful manual sync. */
export function buildSyncSummaryMessage(result: SyncSuccessResult): string {
  if (result.newTransactionsCount === 0) {
    return "Nessuna nuova transazione trovata. Saldo aggiornato.";
  }
  const parts: string[] = [];
  if (result.categorizedCount > 0) {
    parts.push(`${result.categorizedCount} ${pluralize(result.categorizedCount, "categorizzata", "categorizzate")}`);
  }
  if (result.uncategorizedCount > 0) {
    parts.push(`${result.uncategorizedCount} da categorizzare`);
  }
  const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  const label = pluralize(result.newTransactionsCount, "nuova transazione", "nuove transazioni");
  return `${result.newTransactionsCount} ${label}${detail}. Saldo aggiornato.`;
}

/** Error message shown in the toast when the manual sync does not succeed. */
export function buildSyncErrorMessage(error: SyncErrorInfo): string {
  switch (error.status) {
    case "not-eligible": {
      if (!error.nextEligibleAt) return "Sync non disponibile al momento. Riprova più tardi.";
      const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(
        new Date(error.nextEligibleAt)
      );
      return `Hai raggiunto il limite di sync per ora. Prossimo disponibile alle ${time}.`;
    }
    case "gocardless-limited":
      return "La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi.";
    case "expired":
      return "Sessione con la banca scaduta. Riconnetti il conto per sincronizzare.";
    default:
      return "Impossibile completare la sincronizzazione. Riprova più tardi.";
  }
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm exec vitest run lib/gocardless/sync-messages.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/gocardless/sync-messages.ts lib/gocardless/sync-messages.test.ts
git commit -m "feat: aggiunge i messaggi toast per l'esito del sync manuale"
```

---

### Task 8: Frontend plumbing — sonner + `useSyncAccountMutation`

**Files:**
- Modify: `app/layout.tsx`
- Create (via CLI): `components/ui/sonner.tsx`
- Modify: `lib/queries/gocardless.ts`

**Interfaces:**
- Consumes: `buildSyncSummaryMessage`/`buildSyncErrorMessage`/`SyncSuccessResult`/`SyncErrorInfo` (Task 7), endpoint `POST /api/gocardless/accounts/[accountId]/sync` (Task 4), extended fields of `BankConnectionStatus` (Task 5).
- Produces: `interface BankConnectionStatus { accountId: string; status: ...; lastSyncedAt: string | null; eligible: boolean; nextEligibleAt: string | null; syncsRemainingToday: number }` (extended), `useSyncAccountMutation(): UseMutationResult<SyncSuccessResult, SyncNotAvailableError, string>` — used by Task 9 (`AccountRow`).

No automated test for this task (TanStack Query hooks and UI wiring are not unit-tested in this project, see Global Constraints) — the check is build/typecheck.

- [ ] **Step 1: Install `sonner` via shadcn**

Run: `pnpm dlx shadcn@latest add sonner`

Verify that `components/ui/sonner.tsx` has been created (it exports `Toaster`) and that `sonner` appears in the `dependencies` of `package.json`.

- [ ] **Step 2: Mount `<Toaster />` in the root layout**

In `app/layout.tsx`, add the import at the top of the file (after the `QueryProvider` import):

```ts
import { Toaster } from "@/components/ui/sonner";
```

Replace the `<ThemeProvider>` block (lines 40-42):

```tsx
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
            <Toaster />
          </ThemeProvider>
```

- [ ] **Step 3: Extend `lib/queries/gocardless.ts`**

Replace the `BankConnectionStatus` interface (lines 13-16):

```ts
export interface BankConnectionStatus {
  accountId: string;
  status: "pending" | "linked" | "expired" | "error";
  lastSyncedAt: string | null;
  eligible: boolean;
  nextEligibleAt: string | null;
  syncsRemainingToday: number;
}
```

Add at the top of the file (after the existing imports) and at the bottom of the file (after `useFinalizeConnectionMutation`):

```ts
import { toast } from "sonner";
import { buildSyncErrorMessage, buildSyncSummaryMessage } from "@/lib/gocardless/sync-messages";
import type { SyncErrorInfo, SyncSuccessResult } from "@/lib/gocardless/sync-messages";
```

```ts
export class SyncNotAvailableError extends Error {
  constructor(public readonly info: SyncErrorInfo) {
    super("Sync non disponibile");
  }
}

/** Starts a manual sync for an account: shows a toast with the outcome and invalidates accounts/transactions/connection status. */
export function useSyncAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string): Promise<SyncSuccessResult> => {
      const response = await fetch(`/api/gocardless/accounts/${accountId}/sync`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new SyncNotAvailableError(body);
      return body as SyncSuccessResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["gocardless", "connections", "status"] });
      toast.success(buildSyncSummaryMessage(result));
    },
    onError: (error: unknown) => {
      const info: SyncErrorInfo = error instanceof SyncNotAvailableError ? error.info : { status: "unknown" };
      toast.error(buildSyncErrorMessage(info));
    },
  });
}
```

- [ ] **Step 4: Verify build and types**

Run: `pnpm exec tsc --noEmit`
Expected: no errors

Run: `pnpm build`
Expected: build completed without errors

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx components/ui/sonner.tsx lib/queries/gocardless.ts package.json pnpm-lock.yaml
git commit -m "feat: aggiunge sonner e useSyncAccountMutation per il sync manuale"
```

---

### Task 9: UI — sync button + last sync in `AccountRow`

**Files:**
- Modify: `components/domain/accounts/account-row.tsx`
- Modify: `app/(app)/conti/page.tsx`

**Interfaces:**
- Consumes: `useSyncAccountMutation` (Task 8), `formatRelativeTime` (Task 6), extended `BankConnectionStatus` (Task 5/8).
- Produces: `AccountRowProps.syncInfo?: { lastSyncedAt: string | null; eligible: boolean; nextEligibleAt: string | null; syncsRemainingToday: number }` — no consumer besides `ContiPage`, it is the last task of the plan.

No automated test (React components are not unit-tested in this project) — check with build/lint + manual user verification.

- [ ] **Step 1: Extend `AccountRowProps` and import the dependencies**

In `components/domain/accounts/account-row.tsx`, add to the existing imports (after the line `import { formatCurrency } from "@/lib/format";`):

```ts
import { formatRelativeTime } from "@/lib/format";
import { useSyncAccountMutation } from "@/lib/queries/gocardless";
```

(Note: `formatCurrency` is already imported from `"@/lib/format"` at line 41 — extend that import instead of duplicating it: `import { formatCurrency, formatRelativeTime } from "@/lib/format";`)

Extend the `AccountRowProps` interface (lines 53-61):

```ts
export interface AccountRowProps {
  account: Account;
  /** User currency (ISO 4217), used to format the balance. */
  currency: string;
  /** True if the bank consent linked to this account is expired/in error. */
  needsReconnect?: boolean;
  /** Called when the user clicks "Riconnetti". */
  onReconnect?: () => void;
  /** Sync info (auto accounts only): last sync and eligibility for the next manual sync. */
  syncInfo?: {
    lastSyncedAt: string | null;
    eligible: boolean;
    nextEligibleAt: string | null;
    syncsRemainingToday: number;
  };
}
```

Add a module-level helper (before the component definition, next to `CUSTOM_TYPE_VALUE`):

```ts
/** Text of the sync button's native `title`, explains why it is disabled when not eligible. */
function buildSyncButtonTitle(syncInfo: AccountRowProps["syncInfo"]): string {
  if (!syncInfo || syncInfo.eligible) return "Sincronizza ora";
  if (!syncInfo.nextEligibleAt) return "Sync non disponibile";
  const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(syncInfo.nextEligibleAt)
  );
  return syncInfo.syncsRemainingToday === 0
    ? `Limite di 4 sync al giorno raggiunto. Prossimo alle ${time}.`
    : `Prossimo sync disponibile alle ${time}.`;
}
```

- [ ] **Step 2: Update the component signature and add the mutation**

Replace line 63:

```ts
export function AccountRow({ account, currency, needsReconnect, onReconnect, syncInfo }: AccountRowProps) {
```

Right after `const deleteMutation = useDeleteAccountMutation();` (line 66), add:

```ts
  const syncMutation = useSyncAccountMutation();
```

- [ ] **Step 3: Show "Ultimo sync" and the button**

In the `<div className="flex items-center gap-2">` block that already contains `needsReconnect` and the Auto/Manuale `Badge` (lines 188-197), add **before** the existing `Badge`:

```tsx
            {isAuto && syncInfo && (
              <span className="text-[10px] text-muted-foreground">
                {syncInfo.lastSyncedAt
                  ? `Ultimo sync: ${formatRelativeTime(new Date(syncInfo.lastSyncedAt))}`
                  : "Mai sincronizzato"}
              </span>
            )}
```

Right **before** the `<DropdownMenu>` block (line 200), add:

```tsx
        {isAuto && (
          <button
            type="button"
            onClick={() => syncMutation.mutate(account.id)}
            disabled={!syncInfo?.eligible || syncMutation.isPending}
            title={buildSyncButtonTitle(syncInfo)}
            aria-label="Sincronizza ora"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw size={15} className={syncMutation.isPending ? "animate-spin" : undefined} />
          </button>
        )}
```

- [ ] **Step 4: Pass `syncInfo` from `ContiPage`**

In `app/(app)/conti/page.tsx`, right after the `reconnectAccountIds` block (lines 29-33), add:

```tsx
  const syncInfoByAccountId = new Map(
    (connectionStatuses ?? []).map((status) => [
      status.accountId,
      {
        lastSyncedAt: status.lastSyncedAt,
        eligible: status.eligible,
        nextEligibleAt: status.nextEligibleAt,
        syncsRemainingToday: status.syncsRemainingToday,
      },
    ])
  );
```

Pass the new prop to `<AccountRow />` (lines 84-93):

```tsx
            <AccountRow
              key={account.id}
              account={account}
              currency={currency}
              needsReconnect={reconnectAccountIds.has(account.id)}
              syncInfo={syncInfoByAccountId.get(account.id)}
              onReconnect={() => {
                setReconnectTrigger((n) => n + 1);
                setCreateDialogOpen(true);
              }}
            />
```

- [ ] **Step 5: Verify build, types and lint**

Run: `pnpm exec tsc --noEmit`
Expected: no errors

Run: `pnpm build`
Expected: build completed without errors

Run: `pnpm lint`
Expected: no new errors compared to the pre-existing technical debt already known in CLAUDE.md (2 `react-hooks/set-state-in-effect` errors unrelated to this work)

- [ ] **Step 6: Commit**

```bash
git add components/domain/accounts/account-row.tsx "app/(app)/conti/page.tsx"
git commit -m "feat: bottone sync manuale e ultimo sync in AccountRow"
```

- [ ] **Step 7: Note for manual verification**

This task closes the plan but cannot be verified end-to-end by the agent (no Postgres/Redis in the agentic sandbox, same constraint already documented in CLAUDE.md for the previous Conti/Categorie features). Explicitly tell the user, at the end of the implementation, what remains to be done manually in the browser:
- Sync button visible only on "Auto" accounts, disabled with the correct tooltip when not eligible.
- Click on an eligible account → success toast with the correct summary (new/categorized/to categorize) or error toast (gocardless-limited/expired).
- After 4 close-together syncs on the same account, the fifth is blocked on the UI side (button disabled) and on the server side (429 even when forcing the call to the endpoint).
- "Ultimo sync" updates and shows the correct relative format (min/h/days).

---

## Self-Review

**Spec coverage:**
- Last sync visible per account → Task 5 (data) + Task 6 (formatting) + Task 9 (UI). ✓
- Manual sync per single account → Task 4 (endpoint) + Task 9 (button). ✓
- 4/day cap + 4h gap, budget shared between automatic/manual → Task 1 (pure function) + Task 2 (storage) + Task 3 (scheduler) + Task 4 (endpoint, pre-check before calling GoCardless). ✓
- Post-sync feedback (new/categorized/to categorize) → Task 2 (counts in `syncAccountLink`) + Task 7 (messages) + Task 8 (toast). ✓
- No regression on the existing scheduler → Task 3, existing tests kept + new skip test. ✓

**Placeholder scan:** no "TBD"/"TODO"/generic "add validation" in the plan — every step has complete code.

**Type consistency:** `SyncResult` (Task 2) → `SyncSuccessResult = Extract<SyncResult, {status:"synced"}>` (Task 7) → reused in Task 8 without parallel redefinitions. `BankConnectionStatus` extended only once (Task 5 on the server side, Task 8 on the client type side) with identical fields (`lastSyncedAt`, `eligible`, `nextEligibleAt`, `syncsRemainingToday`). `SyncableLink` unchanged throughout the plan (Tasks 2/3/4 consume it without modifying it), `DueLink` (Task 3) extends it only for internal use by the scheduler.

Plan complete and saved to `docs/superpowers/plans/2026-07-26-conti-sync-manuale.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute the tasks in this session with executing-plans, batch execution with review checkpoints

Which do you prefer?
