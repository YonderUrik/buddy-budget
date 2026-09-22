# Ottimizzazione performance sync GoCardless — Implementation Plan

> **SUPERATO (2026-09-22)** — mai implementato e non più valido (`categorize.ts` rimosso dalla categorizzazione a regole). Sostituito da `docs/superpowers/specs/2026-09-22-gocardless-sync-job-progress-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminare l'N+1 query e la sequenzialità che rendono lentissimo l'import GoCardless (conti trovati + sync manuale), sostituendo query-per-transazione con un matcher precaricato in memoria + insert batch, e parallelizzando il sync multi-conto; aggiungere feedback UI esplicito durante l'attesa.

**Architecture:** `lib/gocardless/categorize.ts` guadagna `buildCategoryMatcher(userId)` che precarica una volta lo storico categorizzato dell'utente e ritorna una funzione di match sincrona in memoria. `syncAccountLink` (`lib/gocardless/sync.ts`) usa il matcher invece di `resolveCategoryId` per transazione, e sostituisce l'insert riga-per-riga con un insert batch unico. `finalize/route.ts` sincronizza i conti selezionati in parallelo invece che in sequenza. Due componenti UI mostrano un testo esplicito di attesa.

**Tech Stack:** TypeScript, Drizzle ORM (postgres-js), Vitest (test di integrazione contro DB reale), Next.js Route Handlers.

**Spec:** `docs/superpowers/specs/2026-09-10-gocardless-sync-performance-design.md`

## Global Constraints

- Nessuna modifica allo schema DB.
- La logica di matching categoria resta "ultima transazione con descrizione uguale case-insensitive, altrimenti fallback" — cambia solo dove viene calcolata.
- `resolveCategoryId`/`getFallbackCategoryId`/`matchCategoryId` restano esportate e invariate (usate anche dal wizard "Categorizza automaticamente", fuori scope).
- L'idempotenza dell'import (vincolo unique `(accountId, externalId)`, `onConflictDoNothing`) deve restare identica.
- Comando test: `pnpm test` (`vitest run`). Comando typecheck: `pnpm exec tsc --noEmit`. Comando lint: `pnpm lint`.
- I test di integrazione in questo modulo (`categorize.test.ts`, `sync.test.ts`, `finalize/route.test.ts`) richiedono un Postgres reale raggiungibile da `DATABASE_URL` — se il DB non è raggiungibile nell'ambiente di esecuzione, documentarlo esplicitamente invece di dare per scontato che i test siano passati.

---

### Task 1: `buildCategoryMatcher` in `lib/gocardless/categorize.ts`

**Files:**
- Modify: `lib/gocardless/categorize.ts`
- Test: `lib/gocardless/categorize.test.ts`

**Interfaces:**
- Produces: `export interface CategoryMatcher { fallbackCategoryId: string; match(description: string): string; }` e `export async function buildCategoryMatcher(userId: string): Promise<CategoryMatcher>` — usati da Task 2 (`lib/gocardless/sync.ts`).

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `lib/gocardless/categorize.test.ts` (dentro il blocco `describe("categorize", ...)` esistente, dopo il test `"crea e riusa la categoria di fallback quando non trova match"`):

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

E aggiorna l'import in cima al file per includere `buildCategoryMatcher`:

```ts
import { FALLBACK_CATEGORY_NAME, buildCategoryMatcher, getFallbackCategoryId, resolveCategoryId } from "./categorize";
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm test lib/gocardless/categorize.test.ts`
Expected: FAIL — `buildCategoryMatcher` non è esportata da `./categorize`.

- [ ] **Step 3: Implementa `buildCategoryMatcher`**

In `lib/gocardless/categorize.ts`, aggiungi in fondo al file (dopo `resolveCategoryId`):

```ts
export interface CategoryMatcher {
  fallbackCategoryId: string;
  /** Categoria dell'ultima transazione con descrizione uguale (case-insensitive), altrimenti il fallback. */
  match(description: string): string;
}

/**
 * Precarica una volta lo storico delle transazioni categorizzate dell'utente e ritorna un
 * matcher sincrono in memoria — usato da `syncAccountLink` per evitare una query per ogni
 * transazione importata in un batch di sync.
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

Nessuna modifica agli import esistenti in cima al file: `and`, `desc`, `eq`, `ne` sono già importati da `drizzle-orm`; `db`/`transactions` già importati.

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm test lib/gocardless/categorize.test.ts`
Expected: PASS (3 test totali nel file)

- [ ] **Step 5: Commit**

```bash
git add lib/gocardless/categorize.ts lib/gocardless/categorize.test.ts
git commit -m "feat: matcher categorie precaricato in memoria per il sync GoCardless

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `syncAccountLink` usa il matcher + insert batch

**Files:**
- Modify: `lib/gocardless/sync.ts`
- Test: `lib/gocardless/sync.test.ts`

**Interfaces:**
- Consumes: `buildCategoryMatcher(userId: string): Promise<CategoryMatcher>` da Task 1 (`CategoryMatcher` ha `fallbackCategoryId: string` e `match(description: string): string`).
- Produces: `syncAccountLink` mantiene la firma e il tipo di ritorno `SyncResult` invariati — nessun consumer esterno da aggiornare.

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in `lib/gocardless/sync.test.ts`, dentro `describe("syncAccountLink", ...)`, dopo il test `"è idempotente: un secondo sync con la stessa transazione non la riconta come nuova"`:

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

Questo test verifica che l'insert batch (Step 3) rispetti ancora l'idempotenza per-riga tramite `onConflictDoNothing` — non deve scartare o duplicare l'intero batch quando solo una riga è in conflitto.

- [ ] **Step 2: Esegui i test e verifica che il nuovo passi già oggi (baseline) o fallisca dopo il refactor**

Run: `pnpm test lib/gocardless/sync.test.ts`
Expected: PASS con l'implementazione attuale (riga-per-riga) — è un test di comportamento, non di implementazione. Confermalo PASS ora, poi procedi al refactor e verificalo di nuovo PASS a fine Step 4 (garantisce che il refactor non cambi il comportamento osservabile).

- [ ] **Step 3: Refactora `syncAccountLink`**

In `lib/gocardless/sync.ts`, sostituisci l'import:

```ts
import { getFallbackCategoryId, resolveCategoryId } from "./categorize";
```

con:

```ts
import { buildCategoryMatcher } from "./categorize";
```

Sostituisci il blocco che va dalla riga `const fallbackCategoryId = await getFallbackCategoryId(link.userId);` fino alla fine del `for` loop (comprese le dichiarazioni di `newTransactionsCount`/`categorizedCount`/`uncategorizedCount` e l'insert) con:

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

Il resto della funzione (aggiornamento `syncTimestamps`/`lastSyncedAt`/`nextSyncEligibleAt` e il `return`) resta invariato.

- [ ] **Step 4: Esegui tutti i test del file e verifica che passino**

Run: `pnpm test lib/gocardless/sync.test.ts`
Expected: PASS — tutti gli 11 test (10 esistenti + 1 nuovo), incluso quello di Step 1.

- [ ] **Step 5: Verifica il typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add lib/gocardless/sync.ts lib/gocardless/sync.test.ts
git commit -m "perf: elimina N+1 query nel sync GoCardless con matcher in memoria e insert batch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Sync multi-conto in parallelo nella finalizzazione

**Files:**
- Modify: `app/api/gocardless/connections/[id]/finalize/route.ts`
- Test: `app/api/gocardless/connections/[id]/finalize/route.test.ts` (nessuna modifica prevista — verifica solo che i test esistenti restino verdi)

**Interfaces:**
- Consumes: `syncAccountLink(link: SyncableLink, rateLimitStore: RateLimitStore): Promise<SyncResult>` (invariata da Task 2).

- [ ] **Step 1: Esegui i test esistenti come baseline**

Run: `pnpm test app/api/gocardless/connections/\[id\]/finalize/route.test.ts`
Expected: PASS (5 test, incluso `"risponde comunque 201 se il sync iniziale fallisce (l'account resta creato)"`).

- [ ] **Step 2: Parallelizza il loop di sync**

In `app/api/gocardless/connections/[id]/finalize/route.ts`, sostituisci:

```ts
  for (const link of linksToSync) {
    try {
      await syncAccountLink(link, redisRateLimitStore);
    } catch (error) {
      console.error(`Sync iniziale fallito per il conto ${link.accountId}`, error);
    }
  }
```

con:

```ts
  await Promise.all(
    linksToSync.map((link) =>
      syncAccountLink(link, redisRateLimitStore).catch((error) => {
        console.error(`Sync iniziale fallito per il conto ${link.accountId}`, error);
      })
    )
  );
```

Il commento sopra il blocco ("Best-effort: gli account/link sono già creati...") resta invariato, descrive ancora correttamente il comportamento.

- [ ] **Step 3: Esegui di nuovo i test e verifica che passino**

Run: `pnpm test app/api/gocardless/connections/\[id\]/finalize/route.test.ts`
Expected: PASS — stessi 5 test di prima, nessuna modifica di comportamento osservabile (il test sul fallimento del sync usa `mockRejectedValueOnce`, compatibile con `.catch` per-promise dentro `Promise.all`).

- [ ] **Step 4: Commit**

```bash
git add "app/api/gocardless/connections/[id]/finalize/route.ts"
git commit -m "perf: sincronizza i conti selezionati in parallelo nella finalizzazione GoCardless

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Feedback UI durante l'attesa

**Files:**
- Modify: `app/(app)/conti/collega/[connectionId]/page.tsx`
- Modify: `components/domain/accounts/account-row.tsx`

**Interfaces:**
- Nessuna nuova interfaccia esportata: solo testo JSX condizionale su stato di mutation già esistente (`finalize.isPending`, `syncMutation.isPending`).

- [ ] **Step 1: Testo esplicito sul bottone "Conferma" (conti trovati)**

In `app/(app)/conti/collega/[connectionId]/page.tsx`, sostituisci:

```tsx
      <Button onClick={handleConfirm} disabled={finalize.isPending}>
        Conferma
      </Button>
```

con:

```tsx
      <Button onClick={handleConfirm} disabled={finalize.isPending}>
        {finalize.isPending ? "Sincronizzazione in corso, può richiedere qualche minuto…" : "Conferma"}
      </Button>
```

- [ ] **Step 2: Testo esplicito sul bottone di sync manuale**

In `components/domain/accounts/account-row.tsx`, trova (dentro il blocco `{isAuto && (...)}` del bottone sync, attorno alla riga 238):

```tsx
            title={buildSyncButtonTitle(syncInfo, needsReconnect)}
```

e sostituiscilo con:

```tsx
            title={
              syncMutation.isPending
                ? "Sincronizzazione in corso, può richiedere qualche minuto…"
                : buildSyncButtonTitle(syncInfo, needsReconnect)
            }
```

- [ ] **Step 3: Verifica typecheck e lint**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

Run: `pnpm lint`
Expected: nessun nuovo errore rispetto alla baseline pre-esistente (gli unici errori noti pre-esistenti sono `react-hooks/set-state-in-effect` in `theme-toggle.tsx`/`CategoryLegendRow`, non toccati da questo task).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/conti/collega/[connectionId]/page.tsx" components/domain/accounts/account-row.tsx
git commit -m "feat: feedback esplicito durante l'attesa del sync GoCardless (conti trovati + sync manuale)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verifica finale (dopo Task 4)

- [ ] Run: `pnpm test` — suite completa verde (a parte i 3 fallimenti pre-esistenti e non correlati in `lib/gocardless/scheduler.test.ts`, già noti da sessioni precedenti — verificarne il numero esatto prima di concludere, non assumerlo).
- [ ] Run: `pnpm exec tsc --noEmit` — nessun errore.
- [ ] Run: `pnpm lint` — nessun nuovo errore.
- [ ] Aggiornare `CLAUDE.md` (sezione "Stato del progetto" + nuova voce in "Log delle decisioni") con il riepilogo del lavoro svolto, seguendo lo stile delle voci esistenti.
