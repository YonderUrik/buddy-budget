# GoCardless sync performance optimization — Implementation Plan

> **SUPERSEDED (2026-09-22)** — never implemented and no longer valid (`categorize.ts` removed by rule-based categorization). Replaced by `docs/superpowers/specs/2026-09-22-gocardless-sync-job-progress-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the N+1 queries and the sequential processing that make the GoCardless import (found accounts + manual sync) extremely slow, replacing the per-transaction query with a matcher preloaded in memory + a batch insert, and parallelizing the multi-account sync; add explicit UI feedback while waiting.

**Architecture:** `lib/gocardless/categorize.ts` gains `buildCategoryMatcher(userId)`, which preloads the user's categorized history once and returns a synchronous in-memory match function. `syncAccountLink` (`lib/gocardless/sync.ts`) uses the matcher instead of `resolveCategoryId` per transaction, and replaces the row-by-row insert with a single batch insert. `finalize/route.ts` syncs the selected accounts in parallel instead of sequentially. Two UI components show an explicit waiting text.

**Tech Stack:** TypeScript, Drizzle ORM (postgres-js), Vitest (integration tests against a real DB), Next.js Route Handlers.

**Spec:** `docs/superpowers/specs/2026-09-10-gocardless-sync-performance-design.md`

## Global Constraints

- No changes to the DB schema.
- The category matching logic stays "latest transaction with the same case-insensitive description, otherwise fallback" — only where it is computed changes.
- `resolveCategoryId`/`getFallbackCategoryId`/`matchCategoryId` stay exported and unchanged (also used by the "Categorizza automaticamente" ("Categorize automatically") wizard, out of scope).
- Import idempotency (unique constraint `(accountId, externalId)`, `onConflictDoNothing`) must stay identical.
- Test command: `pnpm test` (`vitest run`). Typecheck command: `pnpm exec tsc --noEmit`. Lint command: `pnpm lint`.
- The integration tests in this module (`categorize.test.ts`, `sync.test.ts`, `finalize/route.test.ts`) need a real Postgres reachable via `DATABASE_URL` — if the DB is not reachable in the execution environment, document it explicitly instead of assuming the tests passed.

---

### Task 1: `buildCategoryMatcher` in `lib/gocardless/categorize.ts`

**Files:**
- Modify: `lib/gocardless/categorize.ts`
- Test: `lib/gocardless/categorize.test.ts`

**Interfaces:**
- Produces: `export interface CategoryMatcher { fallbackCategoryId: string; match(description: string): string; }` and `export async function buildCategoryMatcher(userId: string): Promise<CategoryMatcher>` — used by Task 2 (`lib/gocardless/sync.ts`).

- [ ] **Step 1: Write the failing test**

Add at the bottom of `lib/gocardless/categorize.test.ts` (inside the existing `describe("categorize", ...)` block, after the test `"crea e riusa la categoria di fallback quando non trova match"`):

```ts
  it("buildCategoryMatcher: assegna la categoria dell'ultima transazione con descrizione uguale (case-insensitive), altrimenti il fallback", async () => {
    const fallbackId = await getFallbackCategoryId(userId);
    const [category] = await db.insert(categories).values({ userId, name: "Trasporti", type: "variabile" }).returning();
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto matcher", type: "Conto corrente", balance: "0" })
      .returning();
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId: category.id,
      description: "Trenitalia",
      amount: "-25.00",
      date: "2026-07-10",
    });

    const matcher = await buildCategoryMatcher(userId);
    expect(matcher.fallbackCategoryId).toBe(fallbackId);
    expect(matcher.match("trenitalia")).toBe(category.id);
    expect(matcher.match("Descrizione mai vista prima del matcher")).toBe(fallbackId);
  });
```

And update the import at the top of the file to include `buildCategoryMatcher`:

```ts
import { FALLBACK_CATEGORY_NAME, buildCategoryMatcher, getFallbackCategoryId, resolveCategoryId } from "./categorize";
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test lib/gocardless/categorize.test.ts`
Expected: FAIL — `buildCategoryMatcher` is not exported from `./categorize`.

- [ ] **Step 3: Implement `buildCategoryMatcher`**

In `lib/gocardless/categorize.ts`, add at the bottom of the file (after `resolveCategoryId`):

```ts
export interface CategoryMatcher {
  fallbackCategoryId: string;
  /** Category of the latest transaction with the same description (case-insensitive), otherwise the fallback. */
  match(description: string): string;
}

/**
 * Preloads the user's categorized transaction history once and returns a synchronous
 * in-memory matcher — used by `syncAccountLink` to avoid one query per transaction
 * imported in a sync batch.
 */
export async function buildCategoryMatcher(userId: string): Promise<CategoryMatcher> {
  const fallbackCategoryId = await getFallbackCategoryId(userId);

  const history = await db
    .select({ description: transactions.description, categoryId: transactions.categoryId })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), ne(transactions.categoryId, fallbackCategoryId)))
    .orderBy(desc(transactions.date));

  const byDescription = new Map<string, string>();
  for (const row of history) {
    const key = row.description.trim().toLowerCase();
    if (!byDescription.has(key)) {
      byDescription.set(key, row.categoryId);
    }
  }

  return {
    fallbackCategoryId,
    match(description: string): string {
      const key = description.trim().toLowerCase();
      return byDescription.get(key) ?? fallbackCategoryId;
    },
  };
}
```

No changes to the existing imports at the top of the file: `and`, `desc`, `eq`, `ne` are already imported from `drizzle-orm`; `db`/`transactions` are already imported.

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm test lib/gocardless/categorize.test.ts`
Expected: PASS (3 tests in total in the file)

- [ ] **Step 5: Commit**

```bash
git add lib/gocardless/categorize.ts lib/gocardless/categorize.test.ts
git commit -m "feat: matcher categorie precaricato in memoria per il sync GoCardless

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `syncAccountLink` uses the matcher + batch insert

**Files:**
- Modify: `lib/gocardless/sync.ts`
- Test: `lib/gocardless/sync.test.ts`

**Interfaces:**
- Consumes: `buildCategoryMatcher(userId: string): Promise<CategoryMatcher>` from Task 1 (`CategoryMatcher` has `fallbackCategoryId: string` and `match(description: string): string`).
- Produces: `syncAccountLink` keeps its signature and its `SyncResult` return type unchanged — no external consumer to update.

- [ ] **Step 1: Write the failing test**

Add in `lib/gocardless/sync.test.ts`, inside `describe("syncAccountLink", ...)`, after the test `"è idempotente: un secondo sync con la stessa transazione non la riconta come nuova"`:

```ts
  it("in un batch con una transazione già esistente (stesso externalId) e una nuova, inserisce e conta solo quella nuova", async () => {
    const [category] = await db.insert(categories).values({ userId, name: "Varie", type: "variabile" }).returning();
    await db.insert(transactions).values({
      userId,
      accountId: link.accountId,
      categoryId: category.id,
      description: "Già importata",
      amount: "-1.00",
      date: "2026-07-01",
      source: "auto",
      externalId: "tx-existing",
    });

    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-existing",
          transactionAmount: { amount: "-1.00", currency: "EUR" },
          remittanceInformationUnstructured: "Già importata",
          bookingDate: "2026-07-01",
        },
        {
          internalTransactionId: "tx-new-in-batch",
          transactionAmount: { amount: "-9.00", currency: "EUR" },
          remittanceInformationUnstructured: "Nuova nel batch",
          bookingDate: "2026-07-02",
        },
      ],
      rateLimit: null,
    });

    const result = await syncAccountLink(link, createMemoryStore());
    expect(result).toEqual({
      status: "synced",
      newTransactionsCount: 1,
      categorizedCount: 0,
      uncategorizedCount: 1,
      balanceUpdated: true,
    });

    const storedTransactions = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(storedTransactions).toHaveLength(2);
  });
```

This test checks that the batch insert (Step 3) still respects per-row idempotency through `onConflictDoNothing` — it must not drop or duplicate the whole batch when only one row conflicts.

- [ ] **Step 2: Run the tests and verify the new one already passes today (baseline) or fails after the refactor**

Run: `pnpm test lib/gocardless/sync.test.ts`
Expected: PASS with the current (row-by-row) implementation — it is a behavior test, not an implementation test. Confirm it PASSES now, then proceed with the refactor and check it PASSES again at the end of Step 4 (this guarantees the refactor does not change observable behavior).

- [ ] **Step 3: Refactor `syncAccountLink`**

In `lib/gocardless/sync.ts`, replace the import:

```ts
import { getFallbackCategoryId, resolveCategoryId } from "./categorize";
```

with:

```ts
import { buildCategoryMatcher } from "./categorize";
```

Replace the block going from the line `const fallbackCategoryId = await getFallbackCategoryId(link.userId);` to the end of the `for` loop (including the declarations of `newTransactionsCount`/`categorizedCount`/`uncategorizedCount` and the insert) with:

```ts
    const matcher = await buildCategoryMatcher(link.userId);

    const rows = bankTransactions
      .map((bankTransaction) => {
        const externalId = bankTransaction.internalTransactionId ?? bankTransaction.transactionId;
        if (!externalId) return null;

        const rawDescription = bankTransaction.remittanceInformationUnstructured ?? null;
        const isExpense = Number(bankTransaction.transactionAmount.amount) < 0;
        const merchantName = (isExpense ? bankTransaction.creditorName : bankTransaction.debtorName)?.trim();
        const description = merchantName || rawDescription || "Movimento bancario";

        return {
          userId: link.userId,
          accountId: link.accountId,
          categoryId: matcher.match(description),
          description,
          rawDescription,
          amount: bankTransaction.transactionAmount.amount,
          date: bankTransaction.bookingDate,
          source: "auto" as const,
          externalId,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    let newTransactionsCount = 0;
    let categorizedCount = 0;
    let uncategorizedCount = 0;

    if (rows.length > 0) {
      const inserted = await db
        .insert(transactions)
        .values(rows)
        .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
        .returning({ categoryId: transactions.categoryId });

      newTransactionsCount = inserted.length;
      for (const row of inserted) {
        if (row.categoryId === matcher.fallbackCategoryId) {
          uncategorizedCount += 1;
        } else {
          categorizedCount += 1;
        }
      }
    }
```

The rest of the function (updating `syncTimestamps`/`lastSyncedAt`/`nextSyncEligibleAt` and the `return`) stays unchanged.

- [ ] **Step 4: Run all the tests in the file and verify they pass**

Run: `pnpm test lib/gocardless/sync.test.ts`
Expected: PASS — all 11 tests (10 existing + 1 new), including the one from Step 1.

- [ ] **Step 5: Check the typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/gocardless/sync.ts lib/gocardless/sync.test.ts
git commit -m "perf: elimina N+1 query nel sync GoCardless con matcher in memoria e insert batch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Multi-account sync in parallel during finalization

**Files:**
- Modify: `app/api/gocardless/connections/[id]/finalize/route.ts`
- Test: `app/api/gocardless/connections/[id]/finalize/route.test.ts` (no changes planned — only check that the existing tests stay green)

**Interfaces:**
- Consumes: `syncAccountLink(link: SyncableLink, rateLimitStore: RateLimitStore): Promise<SyncResult>` (unchanged by Task 2).

- [ ] **Step 1: Run the existing tests as a baseline**

Run: `pnpm test app/api/gocardless/connections/\[id\]/finalize/route.test.ts`
Expected: PASS (5 tests, including `"risponde comunque 201 se il sync iniziale fallisce (l'account resta creato)"`).

- [ ] **Step 2: Parallelize the sync loop**

In `app/api/gocardless/connections/[id]/finalize/route.ts`, replace:

```ts
  for (const link of linksToSync) {
    try {
      await syncAccountLink(link, redisRateLimitStore);
    } catch (error) {
      console.error(`Sync iniziale fallito per il conto ${link.accountId}`, error);
    }
  }
```

with:

```ts
  await Promise.all(
    linksToSync.map((link) =>
      syncAccountLink(link, redisRateLimitStore).catch((error) => {
        console.error(`Sync iniziale fallito per il conto ${link.accountId}`, error);
      })
    )
  );
```

The comment above the block ("Best-effort: gli account/link sono già creati...", i.e. "the accounts/links are already created...") stays unchanged; it still describes the behavior correctly.

- [ ] **Step 3: Run the tests again and verify they pass**

Run: `pnpm test app/api/gocardless/connections/\[id\]/finalize/route.test.ts`
Expected: PASS — the same 5 tests as before, no change in observable behavior (the sync-failure test uses `mockRejectedValueOnce`, compatible with the per-promise `.catch` inside `Promise.all`).

- [ ] **Step 4: Commit**

```bash
git add "app/api/gocardless/connections/[id]/finalize/route.ts"
git commit -m "perf: sincronizza i conti selezionati in parallelo nella finalizzazione GoCardless

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: UI feedback while waiting

**Files:**
- Modify: `app/(app)/conti/collega/[connectionId]/page.tsx`
- Modify: `components/domain/accounts/account-row.tsx`

**Interfaces:**
- No new exported interface: only conditional JSX text on already existing mutation state (`finalize.isPending`, `syncMutation.isPending`).

- [ ] **Step 1: Explicit text on the "Conferma" ("Confirm") button (found accounts)**

In `app/(app)/conti/collega/[connectionId]/page.tsx`, replace:

```tsx
      <Button onClick={handleConfirm} disabled={finalize.isPending}>
        Conferma
      </Button>
```

with:

```tsx
      <Button onClick={handleConfirm} disabled={finalize.isPending}>
        {finalize.isPending ? "Sincronizzazione in corso, può richiedere qualche minuto…" : "Conferma"}
      </Button>
```

- [ ] **Step 2: Explicit text on the manual sync button**

In `components/domain/accounts/account-row.tsx`, find (inside the `{isAuto && (...)}` block of the sync button, around line 238):

```tsx
            title={buildSyncButtonTitle(syncInfo, needsReconnect)}
```

and replace it with:

```tsx
            title={
              syncMutation.isPending
                ? "Sincronizzazione in corso, può richiedere qualche minuto…"
                : buildSyncButtonTitle(syncInfo, needsReconnect)
            }
```

- [ ] **Step 3: Check typecheck and lint**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: no new errors compared with the pre-existing baseline (the only known pre-existing errors are `react-hooks/set-state-in-effect` in `theme-toggle.tsx`/`CategoryLegendRow`, not touched by this task).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/conti/collega/[connectionId]/page.tsx" components/domain/accounts/account-row.tsx
git commit -m "feat: feedback esplicito durante l'attesa del sync GoCardless (conti trovati + sync manuale)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final verification (after Task 4)

- [ ] Run: `pnpm test` — full suite green (apart from the 3 pre-existing, unrelated failures in `lib/gocardless/scheduler.test.ts`, already known from previous sessions — check their exact number before concluding, do not assume it).
- [ ] Run: `pnpm exec tsc --noEmit` — no errors.
- [ ] Run: `pnpm lint` — no new errors.
- [ ] Update `CLAUDE.md` (section "Stato del progetto" + new entry in "Log delle decisioni") with a summary of the work done, following the style of the existing entries.
