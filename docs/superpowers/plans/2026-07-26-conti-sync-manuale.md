# Conti: sync manuale con throttle + feedback esito — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nella schermata Conti, mostrare l'ultimo sync di ogni conto bancario collegato, permettere un sync manuale con feedback (nuove transazioni/categorizzate/da categorizzare), rispettando un budget condiviso con lo scheduler automatico di massimo 4 sync al giorno per conto e almeno 4 ore tra un sync e l'altro.

**Architecture:** Nuova colonna `sync_timestamps` (jsonb) su `bank_account_links` + funzione pura `computeSyncEligibility` (finestra scorrevole 24h + gap minimo 4h) condivisa tra lo scheduler cron esistente e un nuovo endpoint di sync manuale. `syncAccountLink` ritorna un riepilogo strutturato (nuove/categorizzate/non categorizzate) invece di `void`. UI: bottone + testo "ultimo sync" in `AccountRow`, toast (libreria `sonner`, nuova nel progetto) per l'esito.

**Tech Stack:** Next.js Route Handlers, Drizzle ORM/Postgres, TanStack Query, `sonner` (nuova dipendenza via shadcn), Vitest per i test.

## Global Constraints

- Budget di sync: `MAX_SYNCS_PER_DAY = 4`, `MIN_SYNC_GAP_MS = 4h`, `SYNC_WINDOW_MS = 24h` — **condiviso** tra scheduler automatico e sync manuale, **per conto** (non per connessione/banca).
- Nessuna migrazione DB va eseguita autonomamente dall'agente: dopo aver modificato lo schema Drizzle, il piano si ferma e chiede esplicitamente all'utente di eseguire `pnpm db:push` prima di proseguire con i task che toccano quella colonna a DB.
- Feedback post-sync via toast: libreria `sonner`, installata tramite `pnpm dlx shadcn@latest add sonner` (non installare `sonner` a mano via pnpm add — il componente shadcn genera anche il wrapper theme-aware).
- Nessun nuovo componente Tooltip: lo stato disabilitato del bottone sync usa l'attributo nativo `title`.
- Tutte le stringhe utente in italiano.
- I componenti React di questo progetto non hanno test automatici (convenzione esistente, vedi `components/domain/accounts/`): la verifica per i task che toccano solo UI è `pnpm build` + `pnpm lint`, non nuovi test. La verifica manuale in browser resta a carico dell'utente (nessun Postgres/Redis nel sandbox agentico).
- Ovunque si tocchi codice TypeScript con tipi nuovi/cambiati, oltre ai test lanciare anche `pnpm exec tsc --noEmit` — Vitest in questo progetto non fa type-check, solo transpile.

---

### Task 1: `computeSyncEligibility` — funzione pura del budget di sync

**Files:**
- Create: `lib/gocardless/sync-eligibility.ts`
- Test: `lib/gocardless/sync-eligibility.test.ts`

**Interfaces:**
- Consumes: nulla (nessuna dipendenza da altri task).
- Produces: `MAX_SYNCS_PER_DAY: number`, `MIN_SYNC_GAP_MS: number`, `SYNC_WINDOW_MS: number`, `interface SyncEligibility { eligible: boolean; syncsUsedToday: number; syncsRemainingToday: number; nextEligibleAt: Date | null }`, `function computeSyncEligibility(recentSyncTimestamps: Date[], now: Date): SyncEligibility` — usati da Task 2 (per `nextSyncEligibleAt`), Task 3 (scheduler), Task 4 (endpoint manuale), Task 5 (status endpoint).

- [ ] **Step 1: Scrivi il test che fallisce**

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

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm exec vitest run lib/gocardless/sync-eligibility.test.ts`
Expected: FAIL — `Cannot find module './sync-eligibility'` (il file non esiste ancora).

- [ ] **Step 3: Scrivi l'implementazione**

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
 * Eleggibilità di un sync (automatico o manuale) dato lo storico dei timestamp
 * recenti: tetto di MAX_SYNCS_PER_DAY in una finestra scorrevole di 24h, più un
 * gap minimo di 4h dall'ultimo sync. `nextEligibleAt` è il momento in cui
 * ENTRAMBE le condizioni tornano vere (il massimo tra le due scadenze).
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

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm exec vitest run lib/gocardless/sync-eligibility.test.ts`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add lib/gocardless/sync-eligibility.ts lib/gocardless/sync-eligibility.test.ts
git commit -m "feat: aggiunge computeSyncEligibility per il budget condiviso di sync"
```

---

### Task 2: Schema `sync_timestamps` + `syncAccountLink` con risultato esteso

**Files:**
- Modify: `lib/db/schema/bank-connections.ts` (colonna `syncTimestamps` su `bankAccountLinks`)
- Modify: `lib/gocardless/sync.ts`
- Modify: `lib/gocardless/sync.test.ts`

**Interfaces:**
- Consumes: `MIN_SYNC_GAP_MS` da `./sync-eligibility` (Task 1).
- Produces: `bankAccountLinks.syncTimestamps: string[]` (colonna DB), `export type SyncResult = { status: "synced"; newTransactionsCount: number; categorizedCount: number; uncategorizedCount: number; balanceUpdated: true } | { status: "gocardless-limited" } | { status: "expired" }`, `syncAccountLink(link: SyncableLink, rateLimitStore: RateLimitStore): Promise<SyncResult>` (era `Promise<void>`) — usati da Task 3, 4, 7, 8.

- [ ] **Step 1: Aggiungi la colonna allo schema**

Modifica `lib/db/schema/bank-connections.ts`, riga 1 (import) e blocco `bankAccountLinks` (righe 31-44):

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
  // Ultimi (al massimo 4) timestamp ISO di sync riuscito, automatico o manuale,
  // usati da computeSyncEligibility per il budget condiviso 4/giorno + gap 4h.
  syncTimestamps: jsonb("sync_timestamps").$type<string[]>().notNull().default([]),
});
```

- [ ] **Step 2: AZIONE UTENTE RICHIESTA — applica la migrazione**

Questo repo non fa mai eseguire `pnpm db:push` a un agente (DB locale condiviso con `main`, convenzione stabilita in CLAUDE.md). **Fermati qui e chiedi esplicitamente all'utente di eseguire:**

```bash
pnpm db:push
```

Non proseguire con lo Step 3 finché l'utente non conferma di averlo fatto — i test di questo task e dei successivi Task 3-5 falliscono contro un DB senza la colonna `sync_timestamps`.

- [ ] **Step 3: Scrivi i test che fallisce (risultato esteso + conteggi + storage)**

Sostituisci il contenuto di `lib/gocardless/sync.test.ts` con:

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

- [ ] **Step 4: Esegui il test e verifica che fallisca**

Run: `pnpm exec vitest run lib/gocardless/sync.test.ts`
Expected: FAIL — `syncAccountLink` ritorna ancora `undefined`, gli `expect(result).toEqual(...)` falliscono.

- [ ] **Step 5: Riscrivi `syncAccountLink`**

Sostituisci il contenuto di `lib/gocardless/sync.ts`:

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

/** Sincronizza saldo e transazioni di un conto collegato; aggiorna i timestamp o marca la connessione scaduta. */
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

- [ ] **Step 6: Esegui il test e verifica che passi**

Run: `pnpm exec vitest run lib/gocardless/sync.test.ts`
Expected: PASS (6 test)

- [ ] **Step 7: Verifica i tipi**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema/bank-connections.ts lib/gocardless/sync.ts lib/gocardless/sync.test.ts
git commit -m "feat: syncAccountLink ritorna un riepilogo strutturato e traccia i timestamp di sync"
```

---

### Task 3: Scheduler — rispetta il budget condiviso

**Files:**
- Modify: `lib/gocardless/scheduler.ts`
- Modify: `lib/gocardless/scheduler.test.ts`

**Interfaces:**
- Consumes: `computeSyncEligibility` (Task 1), `syncAccountLink`/`SyncableLink` (Task 2, invariata la firma di `SyncableLink`).
- Produces: `interface DueLink extends SyncableLink { syncTimestamps: string[] }`, `findDueLinks(): Promise<DueLink[]>` (era `Promise<SyncableLink[]>`) — nessun altro task consuma `findDueLinks` direttamente.

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `lib/gocardless/scheduler.test.ts` (dentro il blocco `describe("scheduler", ...)`, dopo il test esistente "runDueSyncs chiama syncAccountLink..."):

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

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm exec vitest run lib/gocardless/scheduler.test.ts`
Expected: FAIL — `syncAccountLink` viene chiamato (lo scheduler non controlla ancora il budget condiviso).

- [ ] **Step 3: Aggiorna lo scheduler**

Sostituisci il contenuto di `lib/gocardless/scheduler.ts`:

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

/** Conti collegati con sync scaduto e connessione ancora valida (non expired/error). */
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
 * Sincronizza tutti i conti dovuti. Un errore su un conto (rete, 5xx GoCardless)
 * viene loggato e non deve bloccare il sync degli altri conti nello stesso tick.
 * Salta silenziosamente i conti che hanno già esaurito il budget condiviso di
 * sync (4/giorno, gap minimo 4h) per via di sync manuali avvenuti nel frattempo.
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

/** Avvia lo scheduler cron (ogni 12h); no-op se già avviato nel processo corrente. */
export function startGoCardlessScheduler(): void {
  if (started) return;
  started = true;
  cron.schedule("0 */12 * * *", () => {
    runDueSyncs().catch((error) => console.error("Sync GoCardless fallito", error));
  });
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm exec vitest run lib/gocardless/scheduler.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Verifica i tipi**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 6: Commit**

```bash
git add lib/gocardless/scheduler.ts lib/gocardless/scheduler.test.ts
git commit -m "feat: lo scheduler rispetta il budget condiviso di sync anche se nextSyncEligibleAt è passato"
```

---

### Task 4: Endpoint di sync manuale

**Files:**
- Create: `app/api/gocardless/accounts/[accountId]/sync/route.ts`
- Test: `app/api/gocardless/accounts/[accountId]/sync/route.test.ts`

**Interfaces:**
- Consumes: `computeSyncEligibility` (Task 1), `syncAccountLink`/`SyncResult` (Task 2), `redisRateLimitStore` (esistente, `lib/gocardless/redis-rate-limit-store.ts`).
- Produces: `POST /api/gocardless/accounts/[accountId]/sync` — 200 `SyncResult` (variante `synced`), 404 se il conto non è dell'utente o non è `linked`, 429 `{ status: "not-eligible" | "gocardless-limited"; nextEligibleAt?: Date | null; syncsRemainingToday?: number }`, 409 `{ status: "expired" }`. Consumato da Task 8 (`useSyncAccountMutation`).

- [ ] **Step 1: Scrivi il test che fallisce**

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

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm exec vitest run app/api/gocardless/accounts/[accountId]/sync/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (il file non esiste ancora).

- [ ] **Step 3: Scrivi l'endpoint**

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

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm exec vitest run app/api/gocardless/accounts/[accountId]/sync/route.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Verifica i tipi**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

- [ ] **Step 6: Commit**

```bash
git add "app/api/gocardless/accounts/[accountId]/sync/route.ts" "app/api/gocardless/accounts/[accountId]/sync/route.test.ts"
git commit -m "feat: aggiunge l'endpoint di sync manuale per singolo conto"
```

---

### Task 5: Estendi lo status endpoint con l'eleggibilità di sync

**Files:**
- Modify: `app/api/gocardless/connections/route.ts` (solo `GET`, righe 9-20)
- Modify: `app/api/gocardless/connections/route.test.ts` (il test "GET restituisce lo stato delle connessioni per conto")

**Interfaces:**
- Consumes: `computeSyncEligibility` (Task 1).
- Produces: `GET /api/gocardless/connections` ritorna ora `{ accountId, status, lastSyncedAt, eligible, nextEligibleAt, syncsRemainingToday }[]` (era `{ accountId, status }[]`) — consumato da Task 8/9 lato frontend.

- [ ] **Step 1: Aggiorna il test esistente (fallisce contro l'implementazione attuale)**

In `app/api/gocardless/connections/route.test.ts`, sostituisci il test `"GET restituisce lo stato delle connessioni per conto"` con:

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

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm exec vitest run app/api/gocardless/connections/route.test.ts`
Expected: FAIL — il body ritornato non ha ancora `lastSyncedAt`/`eligible`/`nextEligibleAt`/`syncsRemainingToday`.

- [ ] **Step 3: Aggiorna il GET handler**

In `app/api/gocardless/connections/route.ts`, aggiungi l'import in cima al file:

```ts
import { computeSyncEligibility } from "@/lib/gocardless/sync-eligibility";
```

Sostituisci l'intera funzione `GET` (righe 9-20):

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

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm exec vitest run app/api/gocardless/connections/route.test.ts`
Expected: PASS (tutti i test del file)

- [ ] **Step 5: Verifica i tipi**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

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
- Consumes: nulla.
- Produces: `formatRelativeTime(date: Date, now?: Date): string` — usata da Task 9 (`AccountRow`).

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `lib/format.test.ts`:

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

(Nota: la riga `import { formatCurrency, formatRelativeTime, getCurrencySymbol } from "./format";` sostituisce l'import esistente in cima al file, riga 2.)

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm exec vitest run lib/format.test.ts`
Expected: FAIL — `formatRelativeTime` non è esportata da `./format`.

- [ ] **Step 3: Implementa `formatRelativeTime`**

Aggiungi in fondo a `lib/format.ts`:

```ts
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_TIME_MAX_DAYS = 7;

/**
 * Formatta la distanza temporale tra `date` e `now` in italiano, con granularità
 * decrescente (minuti/ore/giorni); oltre RELATIVE_TIME_MAX_DAYS giorni torna a
 * una data assoluta breve (es. "12 lug").
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

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm exec vitest run lib/format.test.ts`
Expected: PASS (tutti i test del file)

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts lib/format.test.ts
git commit -m "feat: aggiunge formatRelativeTime per l'ultimo sync in Conti"
```

---

### Task 7: Messaggi toast (`sync-messages.ts`)

**Files:**
- Create: `lib/gocardless/sync-messages.ts`
- Test: `lib/gocardless/sync-messages.test.ts`

**Interfaces:**
- Consumes: `SyncResult` (type-only, da `./sync`, Task 2).
- Produces: `export type SyncSuccessResult = Extract<SyncResult, { status: "synced" }>`, `export type SyncErrorInfo = { status: "not-eligible"; nextEligibleAt: string | null; syncsRemainingToday: number } | { status: "gocardless-limited" } | { status: "expired" } | { status: "unknown" }`, `buildSyncSummaryMessage(result: SyncSuccessResult): string`, `buildSyncErrorMessage(error: SyncErrorInfo): string` — usati da Task 8 (`useSyncAccountMutation`).

- [ ] **Step 1: Scrivi il test che fallisce**

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

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm exec vitest run lib/gocardless/sync-messages.test.ts`
Expected: FAIL — `Cannot find module './sync-messages'`.

- [ ] **Step 3: Implementa `sync-messages.ts`**

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

/** Messaggio di successo mostrato nel toast dopo un sync manuale riuscito. */
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

/** Messaggio d'errore mostrato nel toast quando il sync manuale non va a buon fine. */
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

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm exec vitest run lib/gocardless/sync-messages.test.ts`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add lib/gocardless/sync-messages.ts lib/gocardless/sync-messages.test.ts
git commit -m "feat: aggiunge i messaggi toast per l'esito del sync manuale"
```

---

### Task 8: Plumbing frontend — sonner + `useSyncAccountMutation`

**Files:**
- Modify: `app/layout.tsx`
- Create (via CLI): `components/ui/sonner.tsx`
- Modify: `lib/queries/gocardless.ts`

**Interfaces:**
- Consumes: `buildSyncSummaryMessage`/`buildSyncErrorMessage`/`SyncSuccessResult`/`SyncErrorInfo` (Task 7), endpoint `POST /api/gocardless/accounts/[accountId]/sync` (Task 4), campi estesi di `BankConnectionStatus` (Task 5).
- Produces: `interface BankConnectionStatus { accountId: string; status: ...; lastSyncedAt: string | null; eligible: boolean; nextEligibleAt: string | null; syncsRemainingToday: number }` (estesa), `useSyncAccountMutation(): UseMutationResult<SyncSuccessResult, SyncNotAvailableError, string>` — usato da Task 9 (`AccountRow`).

Nessun test automatico per questo task (hook TanStack Query e wiring UI non sono testati a unit in questo progetto, vedi Global Constraints) — la verifica è build/typecheck.

- [ ] **Step 1: Installa `sonner` via shadcn**

Run: `pnpm dlx shadcn@latest add sonner`

Verifica che sia stato creato `components/ui/sonner.tsx` (esporta `Toaster`) e che `sonner` compaia in `dependencies` di `package.json`.

- [ ] **Step 2: Monta `<Toaster />` nel root layout**

In `app/layout.tsx`, aggiungi l'import in cima al file (dopo l'import di `QueryProvider`):

```ts
import { Toaster } from "@/components/ui/sonner";
```

Sostituisci il blocco `<ThemeProvider>` (righe 40-42):

```tsx
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
            <Toaster />
          </ThemeProvider>
```

- [ ] **Step 3: Estendi `lib/queries/gocardless.ts`**

Sostituisci l'interfaccia `BankConnectionStatus` (righe 13-16):

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

Aggiungi in cima al file (dopo gli import esistenti) e in fondo al file (dopo `useFinalizeConnectionMutation`):

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

/** Avvia un sync manuale per un conto: mostra un toast con l'esito e invalida conti/transazioni/stato connessioni. */
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

- [ ] **Step 4: Verifica build e tipi**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

Run: `pnpm build`
Expected: build completata senza errori

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx components/ui/sonner.tsx lib/queries/gocardless.ts package.json pnpm-lock.yaml
git commit -m "feat: aggiunge sonner e useSyncAccountMutation per il sync manuale"
```

---

### Task 9: UI — bottone sync + ultimo sync in `AccountRow`

**Files:**
- Modify: `components/domain/accounts/account-row.tsx`
- Modify: `app/(app)/conti/page.tsx`

**Interfaces:**
- Consumes: `useSyncAccountMutation` (Task 8), `formatRelativeTime` (Task 6), `BankConnectionStatus` esteso (Task 5/8).
- Produces: `AccountRowProps.syncInfo?: { lastSyncedAt: string | null; eligible: boolean; nextEligibleAt: string | null; syncsRemainingToday: number }` — nessun consumatore oltre `ContiPage`, è l'ultimo task del piano.

Nessun test automatico (componenti React non testati a unit in questo progetto) — verifica con build/lint + verifica manuale utente.

- [ ] **Step 1: Estendi `AccountRowProps` e importa le dipendenze**

In `components/domain/accounts/account-row.tsx`, aggiungi agli import esistenti (dopo la riga `import { formatCurrency } from "@/lib/format";`):

```ts
import { formatRelativeTime } from "@/lib/format";
import { useSyncAccountMutation } from "@/lib/queries/gocardless";
```

(Nota: `formatCurrency` è già importato da `"@/lib/format"` alla riga 41 — estendi quell'import invece di duplicarlo: `import { formatCurrency, formatRelativeTime } from "@/lib/format";`)

Estendi l'interfaccia `AccountRowProps` (righe 53-61):

```ts
export interface AccountRowProps {
  account: Account;
  /** Valuta dell'utente (ISO 4217), usata per formattare il saldo. */
  currency: string;
  /** True se il consenso bancario collegato a questo conto è scaduto/in errore. */
  needsReconnect?: boolean;
  /** Chiamato quando l'utente clicca "Riconnetti". */
  onReconnect?: () => void;
  /** Info di sync (solo per conti auto): ultimo sync ed eleggibilità al prossimo sync manuale. */
  syncInfo?: {
    lastSyncedAt: string | null;
    eligible: boolean;
    nextEligibleAt: string | null;
    syncsRemainingToday: number;
  };
}
```

Aggiungi un helper module-level (prima della definizione del componente, accanto a `CUSTOM_TYPE_VALUE`):

```ts
/** Testo del `title` nativo del bottone sync, spiega perché è disabilitato quando non eleggibile. */
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

- [ ] **Step 2: Aggiorna la firma del componente e aggiungi la mutation**

Sostituisci la riga 63:

```ts
export function AccountRow({ account, currency, needsReconnect, onReconnect, syncInfo }: AccountRowProps) {
```

Subito dopo `const deleteMutation = useDeleteAccountMutation();` (riga 66), aggiungi:

```ts
  const syncMutation = useSyncAccountMutation();
```

- [ ] **Step 3: Mostra "Ultimo sync" e il bottone**

Nel blocco `<div className="flex items-center gap-2">` che contiene già `needsReconnect` e il `Badge` Auto/Manuale (righe 188-197), aggiungi **prima** del `Badge` esistente:

```tsx
            {isAuto && syncInfo && (
              <span className="text-[10px] text-muted-foreground">
                {syncInfo.lastSyncedAt
                  ? `Ultimo sync: ${formatRelativeTime(new Date(syncInfo.lastSyncedAt))}`
                  : "Mai sincronizzato"}
              </span>
            )}
```

Subito **prima** del blocco `<DropdownMenu>` (riga 200), aggiungi:

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

- [ ] **Step 4: Passa `syncInfo` da `ContiPage`**

In `app/(app)/conti/page.tsx`, subito dopo il blocco `reconnectAccountIds` (righe 29-33), aggiungi:

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

Passa la nuova prop a `<AccountRow />` (righe 84-93):

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

- [ ] **Step 5: Verifica build, tipi e lint**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore

Run: `pnpm build`
Expected: build completata senza errori

Run: `pnpm lint`
Expected: nessun nuovo errore rispetto al debito tecnico pre-esistente già noto in CLAUDE.md (2 errori `react-hooks/set-state-in-effect` non correlati a questo lavoro)

- [ ] **Step 6: Commit**

```bash
git add components/domain/accounts/account-row.tsx "app/(app)/conti/page.tsx"
git commit -m "feat: bottone sync manuale e ultimo sync in AccountRow"
```

- [ ] **Step 7: Nota per la verifica manuale**

Questo task chiude il piano ma non è verificabile end-to-end dall'agente (nessun Postgres/Redis nel sandbox agentico, stesso vincolo già documentato in CLAUDE.md per le feature precedenti su Conti/Categorie). Segnala esplicitamente all'utente, a fine implementazione, che resta da fare manualmente in browser:
- Bottone sync visibile solo sui conti "Auto", disabilitato con tooltip corretto quando non eleggibile.
- Click su un conto eleggibile → toast di successo con il riepilogo corretto (nuove/categorizzate/da categorizzare) o toast di errore (gocardless-limited/expired).
- Dopo 4 sync ravvicinati sullo stesso conto, il quinto è bloccato lato UI (bottone disabilitato) e lato server (429 anche forzando la chiamata all'endpoint).
- "Ultimo sync" si aggiorna e mostra il formato relativo corretto (min/h/giorni).

---

## Self-Review

**Copertura spec:**
- Ultimo sync visibile per conto → Task 5 (dati) + Task 6 (formattazione) + Task 9 (UI). ✓
- Sync manuale per singolo conto → Task 4 (endpoint) + Task 9 (bottone). ✓
- Tetto 4/giorno + gap 4h, budget condiviso automatico/manuale → Task 1 (funzione pura) + Task 2 (storage) + Task 3 (scheduler) + Task 4 (endpoint, pre-check prima di chiamare GoCardless). ✓
- Feedback post-sync (nuove/categorizzate/da categorizzare) → Task 2 (conteggi in `syncAccountLink`) + Task 7 (messaggi) + Task 8 (toast). ✓
- Nessuna regressione sullo scheduler esistente → Task 3, test esistenti mantenuti + nuovo test di skip. ✓

**Scansione placeholder:** nessun "TBD"/"TODO"/generico "aggiungi validazione" nel piano — ogni step ha codice completo.

**Coerenza tipi:** `SyncResult` (Task 2) → `SyncSuccessResult = Extract<SyncResult, {status:"synced"}>` (Task 7) → riusato in Task 8 senza ridefinizioni parallele. `BankConnectionStatus` esteso una sola volta (Task 5 lato server, Task 8 lato tipo client) con campi identici (`lastSyncedAt`, `eligible`, `nextEligibleAt`, `syncsRemainingToday`). `SyncableLink` invariata in tutto il piano (Task 2/3/4 la consumano senza modificarla), `DueLink` (Task 3) la estende solo per uso interno allo scheduler.

Plan complete and saved to `docs/superpowers/plans/2026-07-26-conti-sync-manuale.md`. Due opzioni di esecuzione:

**1. Subagent-Driven (consigliato)** — dispatch di un subagent fresco per task, review tra un task e l'altro, iterazione rapida

**2. Inline Execution** — esecuzione dei task in questa sessione con executing-plans, batch execution con checkpoint di revisione

Quale preferisci?
