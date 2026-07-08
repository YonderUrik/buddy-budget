# Open Banking via GoCardless Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collegare conti bancari reali via GoCardless Bank Account Data API (consenso PSD2, import saldo/transazioni, sync automatico ogni 12h), integrato nella schermata Conti esistente.

**Architecture:** Nuove tabelle `bank_connections`/`bank_account_links`/`gocardless_token` accanto al modello dati esistente (`accounts`/`transactions` invariati salvo una colonna `externalId` per l'idempotenza). Un client HTTP sottile verso l'API GoCardless, un motore di sync che aggiorna saldo/transazioni rispettando i rate limit (contati in Redis), uno scheduler `node-cron` in-process avviato da `instrumentation.ts`. Il flusso utente riusa il form "+ Aggiungi conto" esistente con una nuova opzione "Collega banca".

**Tech Stack:** Next.js Route Handlers, Drizzle ORM/Postgres, `ioredis`, `node-cron`, TanStack Query, Zod, Vitest (test di integrazione su DB reale, mock su `fetch`/moduli GoCardless — nessun ambiente jsdom/component test nel progetto).

## Global Constraints

- Package manager: **pnpm**.
- **L'agente non esegue MAI comandi git in questo repo.** Ogni step di commit va presentato come comando esatto che l'utente esegue lui stesso, con richiesta di conferma prima di procedere al task successivo.
- Spec di riferimento: `docs/superpowers/specs/2026-07-06-gocardless-open-banking-design.md` — ogni deviazione da questo spec va segnalata esplicitamente nel task in cui avviene (es. Task 2: `requisitionId` nullable, non `NOT NULL` come implicito nello spec, per gestire lo stato `pending` prima che la requisition esista).
- Migration **versionate** (`pnpm db:generate` + `pnpm db:migrate`), mai `db:push`, coerente con il resto del progetto.
- Barrel file (`index.ts`) solo per componenti usati da fuori la cartella — `ConnectBankFlow` resta interno a `components/domain/accounts/` (usato solo da `add-account-form.tsx` nella stessa cartella), nessuna voce di barrel per lui.
- Nessun colore/raggio hardcoded nei componenti — solo classi Tailwind sui token già definiti in `app/globals.css`.
- JSDoc minimo (una riga `/** ... */`) su ogni funzione/componente pubblico nuovo, in italiano, come da convenzione di progetto.
- Stringhe visibili all'utente in italiano.
- Test: pattern esistente in `lib/db/integration.test.ts` e `app/api/accounts/route.test.ts` — DB Postgres reale (mai mockato), `vi.mock("@/lib/auth", ...)` per la sessione, moduli GoCardless/Redis mockati con `vi.mock(..., async (importOriginal) => ...)` per preservare i tipi/classi reali (es. `GoCardlessError`). Nessun test di componente React (nessuna infrastruttura jsdom nel progetto) — le UI task si verificano con `pnpm exec tsc --noEmit` + verifica manuale finale (Task 16).
- Rate limit GoCardless: intervallo di sync **12 ore**, storico iniziale **tutto il disponibile** (`transaction_total_days` dell'istituto), scope paesi **tutti quelli supportati da GoCardless**.

---

## File Structure

- `lib/db/schema/bank-connections.ts` (nuovo) — tabelle `bank_connections`, `bank_account_links`, `gocardless_token`.
- `lib/db/schema/transactions.ts` (modifica) — colonna `externalId` + vincolo unique `(accountId, externalId)`.
- `lib/db/schema/categories.ts` (modifica) — aggiunge `"Da categorizzare"` a `DEFAULT_CATEGORIES`.
- `lib/db/schema/index.ts` (modifica) — esporta il nuovo file schema.
- `lib/redis/client.ts` (nuovo) — client `ioredis` condiviso.
- `lib/gocardless/rate-limit.ts` (nuovo) — logica pura di rate limit, store iniettabile (testabile senza Redis reale).
- `lib/gocardless/redis-rate-limit-store.ts` (nuovo) — adapter Redis dell'interfaccia `RateLimitStore`.
- `lib/gocardless/client.ts` (nuovo) — client HTTP GoCardless (token cache, istituti, agreement/requisition, dettagli/saldi/transazioni conto).
- `lib/gocardless/categorize.ts` (nuovo) — matching categoria + categoria di fallback.
- `lib/gocardless/sync.ts` (nuovo) — `syncAccountLink`, il motore di sync per un singolo conto collegato.
- `lib/gocardless/scheduler.ts` (nuovo) — `findDueLinks`/`runDueSyncs`/`startGoCardlessScheduler` (cron ogni 12h).
- `instrumentation.ts` (nuovo, root) — hook di boot Next.js che avvia lo scheduler.
- `lib/validation/gocardless.ts` (nuovo) — schemi Zod per creazione connessione e finalizzazione selezione.
- `lib/queries/gocardless.ts` (nuovo) — hook TanStack Query lato client.
- `app/api/gocardless/institutions/route.ts` (nuovo) — GET lista istituti per paese.
- `app/api/gocardless/connections/route.ts` (nuovo) — POST crea connessione+requisition, GET stato connessioni per badge "Riconnetti".
- `app/api/gocardless/callback/route.ts` (nuovo) — redirect di ritorno dal consenso bancario.
- `app/api/gocardless/connections/[id]/accounts/route.ts` (nuovo) — GET conti esterni trovati dopo il consenso.
- `app/api/gocardless/connections/[id]/finalize/route.ts` (nuovo) — POST crea/ricollega i conti selezionati e lancia il sync iniziale.
- `components/domain/accounts/connect-bank-flow.tsx` (nuovo) — UI selezione paese/istituto + redirect consenso.
- `components/domain/accounts/add-account-form.tsx` (modifica) — aggiunge lo switch "Manuale"/"Collega banca".
- `components/domain/accounts/account-row.tsx` (modifica) — badge/bottone "Riconnetti".
- `app/(app)/conti/collega/[connectionId]/page.tsx` (nuovo) — pagina di selezione conti esterni post-consenso.
- `app/(app)/conti/page.tsx` (modifica) — recupera stato connessioni, passa `needsReconnect`/`onReconnect` alle righe.
- `.env.local.example` (modifica) — nuove variabili GoCardless/Redis.
- `package.json` (modifica) — dipendenze `ioredis`, `node-cron`, `@types/node-cron`.

---

### Task 1: Dipendenze e variabili d'ambiente

**Files:**
- Modify: `package.json`
- Modify: `.env.local.example`

**Interfaces:**
- Produces: `ioredis`, `node-cron` disponibili per tutti i task successivi; `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`, `REDIS_URL` come variabili attese da `lib/gocardless/client.ts` (Task 4) e `lib/redis/client.ts` (Task 3).

- [ ] **Step 1: Installare le dipendenze**

Run: `pnpm add ioredis node-cron`
Run: `pnpm add -D @types/node-cron`

Expected: entrambi i comandi terminano senza errori; `package.json` mostra `ioredis` e `node-cron` in `dependencies`, `@types/node-cron` in `devDependencies`.

- [ ] **Step 2: Aggiungere le variabili d'ambiente a `.env.local.example`**

Aggiungi in fondo al file:

```
# GoCardless Bank Account Data (Open Banking) — https://bankaccountdata.gocardless.com
# Credenziali sandbox da creare su https://bankaccountdata.gocardless.com/
GOCARDLESS_SECRET_ID=<secret-id-sandbox>
GOCARDLESS_SECRET_KEY=<secret-key-sandbox>

# Redis — rate limiting del sync GoCardless (es. `docker run -p 6379:6379 redis`)
REDIS_URL=redis://localhost:6379
```

- [ ] **Step 3: Copiare in `.env.local` locale e verificare il type-check**

Copia le nuove righe anche nel tuo `.env.local` (non committato) con valori reali o placeholder per ora.

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore (nessun codice applicativo ancora, solo config).

- [ ] **Step 4: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add package.json pnpm-lock.yaml .env.local.example
git commit -m "chore: add ioredis and node-cron dependencies for GoCardless sync"
```

---

### Task 2: Schema DB — connessioni bancarie, link conti, cache token, categoria di fallback

**Files:**
- Create: `lib/db/schema/bank-connections.ts`
- Modify: `lib/db/schema/transactions.ts`
- Modify: `lib/db/schema/categories.ts`
- Modify: `lib/db/schema/index.ts`
- Create: `lib/db/bank-connections.integration.test.ts`

**Interfaces:**
- Consumes: `authUser` (`lib/db/schema/auth.ts`), `accounts` (`lib/db/schema/accounts.ts`).
- Produces: `bankConnections`, `bankAccountLinks`, `gocardlessToken` tabelle e relativi tipi (`BankConnection`, `BankAccountLink`, `GoCardlessToken`), usati da Task 4 (client), Task 6 (sync), Task 7 (scheduler), Task 9-11 (route API). `transactions.externalId` usato da Task 6. `FALLBACK_CATEGORY_NAME = "Da categorizzare"` definita in Task 5, seminata qui solo nei `DEFAULT_CATEGORIES` per i nuovi utenti (gli utenti esistenti la ricevono lazy via `getFallbackCategoryId`, Task 5).

- [ ] **Step 1: Creare `lib/db/schema/bank-connections.ts`**

```ts
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { accounts } from "./accounts";

export const bankConnectionStatusEnum = pgEnum("bank_connection_status", [
  "pending",
  "linked",
  "expired",
  "error",
]);

export const bankConnections = pgTable("bank_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  institutionId: text("institution_id").notNull(),
  institutionName: text("institution_name").notNull(),
  // Nullable: nasce nulla quando la connessione è "pending" (creata prima ancora
  // di aver chiamato GoCardless), valorizzata subito dopo dalla stessa richiesta.
  requisitionId: text("requisition_id"),
  status: bankConnectionStatusEnum("status").notNull().default("pending"),
  consentExpiresAt: timestamp("consent_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BankConnection = typeof bankConnections.$inferSelect;
export type NewBankConnection = typeof bankConnections.$inferInsert;

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
});

export type BankAccountLink = typeof bankAccountLinks.$inferSelect;
export type NewBankAccountLink = typeof bankAccountLinks.$inferInsert;

/** Singola riga: cache dell'access token applicativo GoCardless (non è per-utente). */
export const gocardlessToken = pgTable("gocardless_token", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type GoCardlessToken = typeof gocardlessToken.$inferSelect;
```

- [ ] **Step 2: Aggiungere `externalId` a `lib/db/schema/transactions.ts`**

Modifica l'import in cima al file:

```ts
import { date, index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
```

Nel corpo di `pgTable`, dopo `source`, aggiungi:

```ts
    // Id della transazione lato GoCardless — nullable (le transazioni manuali non ce l'hanno),
    // usato per l'idempotenza dei sync periodici (nessun duplicato a ogni run del cron).
    externalId: text("external_id"),
```

E aggiorna l'array del terzo argomento:

```ts
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.date),
    unique("transactions_account_external_id_unique").on(table.accountId, table.externalId),
  ]
```

- [ ] **Step 3: Aggiungere la categoria di fallback a `lib/db/schema/categories.ts`**

Nell'array `DEFAULT_CATEGORIES`, aggiungi come ultimo elemento:

```ts
  { name: "Da categorizzare", type: "variabile" },
```

- [ ] **Step 4: Esportare il nuovo schema dal barrel**

In `lib/db/schema/index.ts`, aggiungi:

```ts
export * from "./bank-connections";
```

- [ ] **Step 5: Generare e applicare la migration**

Run: `pnpm db:generate`
Expected: nuovo file SQL sotto `lib/db/migrations/` con `CREATE TYPE bank_connection_status`, `CREATE TABLE bank_connections`, `CREATE TABLE bank_account_links`, `CREATE TABLE gocardless_token`, `ALTER TABLE transactions ADD COLUMN external_id` + il vincolo unique.

Run: `pnpm db:migrate`
Expected: conferma delle tabelle applicate, nessun errore.

- [ ] **Step 6: Scrivere il test di integrazione**

Crea `lib/db/bank-connections.integration.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { client, db } from "./client";
import { authUser } from "./schema/auth";
import { accounts } from "./schema/accounts";
import { bankAccountLinks, bankConnections } from "./schema/bank-connections";
import { categories, DEFAULT_CATEGORIES } from "./schema/categories";

describe("bank_connections / bank_account_links — round trip", () => {
  let userId: string;

  afterAll(async () => {
    if (userId) await db.delete(authUser).where(eq(authUser.id, userId));
    await client.end();
  });

  it("crea connessione + link conto, e li rilegge tramite join", async () => {
    const testId = `test-bank-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Bank User",
        email: `test-bank-${Date.now()}@example.com`,
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
      .values({
        userId,
        institutionId: "SANDBOXFINANCE_SFIN0000",
        institutionName: "Sandbox Finance",
        status: "pending",
      })
      .returning();
    expect(connection.requisitionId).toBeNull();

    const [link] = await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-123" })
      .returning();

    const rows = await db
      .select({ status: bankConnections.status, externalAccountId: bankAccountLinks.externalAccountId })
      .from(bankAccountLinks)
      .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
      .where(eq(bankAccountLinks.id, link.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ status: "pending", externalAccountId: "ext-123" });
  });

  it("include 'Da categorizzare' tra le categorie seed", () => {
    expect(DEFAULT_CATEGORIES.map((c) => c.name)).toContain("Da categorizzare");
  });
});
```

- [ ] **Step 7: Eseguire i test**

Run: `pnpm test lib/db/bank-connections.integration.test.ts`
Expected: 2 test PASS.

- [ ] **Step 8: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/db/schema lib/db/migrations lib/db/bank-connections.integration.test.ts
git commit -m "feat: add bank_connections/bank_account_links schema and fallback category"
```

---

### Task 3: Redis client e logica di rate limit

**Files:**
- Create: `lib/redis/client.ts`
- Create: `lib/gocardless/rate-limit.ts`
- Create: `lib/gocardless/redis-rate-limit-store.ts`
- Test: `lib/gocardless/rate-limit.test.ts`

**Interfaces:**
- Produces: `RateLimitStore` interface, `recordRateLimit()`, `isRateLimited()` (Task 6 li usa), `redisRateLimitStore` (Task 7 scheduler, Task 11 finalize route).

- [ ] **Step 1: Scrivere il test (con uno store finto in memoria, niente Redis reale)**

Crea `lib/gocardless/rate-limit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isRateLimited, recordRateLimit, type RateLimitStore } from "./rate-limit";

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

describe("rate-limit", () => {
  it("nessuna voce registrata → via libera", async () => {
    const store = createMemoryStore();
    expect(await isRateLimited(store, "acc-1", "balances")).toBe(false);
  });

  it("remaining > 0 → via libera", async () => {
    const store = createMemoryStore();
    await recordRateLimit(store, "acc-1", "balances", 3, 3600);
    expect(await isRateLimited(store, "acc-1", "balances")).toBe(false);
  });

  it("remaining = 0 → bloccato", async () => {
    const store = createMemoryStore();
    await recordRateLimit(store, "acc-1", "balances", 0, 3600);
    expect(await isRateLimited(store, "acc-1", "balances")).toBe(true);
  });

  it("endpoint diversi sullo stesso conto sono indipendenti", async () => {
    const store = createMemoryStore();
    await recordRateLimit(store, "acc-1", "balances", 0, 3600);
    expect(await isRateLimited(store, "acc-1", "transactions")).toBe(false);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm test lib/gocardless/rate-limit.test.ts`
Expected: FAIL, `Cannot find module './rate-limit'`.

- [ ] **Step 3: Implementare `lib/gocardless/rate-limit.ts`**

```ts
/** Store minimale su cui gira la logica di rate limit — Redis in produzione, una Map nei test. */
export interface RateLimitStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

function rateLimitKey(externalAccountId: string, endpoint: string): string {
  return `gocardless:ratelimit:${endpoint}:${externalAccountId}`;
}

/** Salva le chiamate rimaste per un conto/endpoint, lette dagli header di risposta GoCardless. */
export async function recordRateLimit(
  store: RateLimitStore,
  externalAccountId: string,
  endpoint: string,
  remaining: number,
  resetSeconds: number
): Promise<void> {
  await store.set(rateLimitKey(externalAccountId, endpoint), String(remaining), Math.max(1, resetSeconds));
}

/** True se non restano chiamate per quel conto/endpoint; nessuna voce registrata = via libera. */
export async function isRateLimited(
  store: RateLimitStore,
  externalAccountId: string,
  endpoint: string
): Promise<boolean> {
  const value = await store.get(rateLimitKey(externalAccountId, endpoint));
  if (value === null) return false;
  return Number(value) <= 0;
}
```

- [ ] **Step 4: Eseguire di nuovo il test**

Run: `pnpm test lib/gocardless/rate-limit.test.ts`
Expected: 4 test PASS.

- [ ] **Step 5: Creare il client Redis e l'adapter**

Crea `lib/redis/client.ts`:

```ts
import "server-only";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL non è definita. Copia .env.local.example in .env.local.");
}

export const redis = new Redis(redisUrl);
```

Crea `lib/gocardless/redis-rate-limit-store.ts`:

```ts
import "server-only";
import { redis } from "@/lib/redis/client";
import type { RateLimitStore } from "./rate-limit";

/** Adapter Redis di `RateLimitStore`, usato dallo scheduler e dal sync iniziale post-collegamento. */
export const redisRateLimitStore: RateLimitStore = {
  async get(key) {
    return redis.get(key);
  },
  async set(key, value, ttlSeconds) {
    await redis.set(key, value, "EX", Math.max(1, Math.floor(ttlSeconds)));
  },
};
```

- [ ] **Step 6: Verificare il type-check**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/redis lib/gocardless/rate-limit.ts lib/gocardless/rate-limit.test.ts lib/gocardless/redis-rate-limit-store.ts
git commit -m "feat: add Redis-backed rate limit tracking for GoCardless sync"
```

---

### Task 4: Client HTTP GoCardless

**Files:**
- Create: `lib/gocardless/client.ts`
- Test: `lib/gocardless/client.test.ts`

**Interfaces:**
- Consumes: `gocardlessToken` (Task 2), `GOCARDLESS_SECRET_ID`/`GOCARDLESS_SECRET_KEY` (Task 1).
- Produces: `GoCardlessError`, `getAccessToken()`, `listInstitutions()`, `createRequisition()`, `getRequisition()`, `getAccountDetails()`, `getAccountBalances()`, `getAccountTransactions()`, tipi `Institution`/`Requisition`/`AccountDetails`/`Balance`/`BankTransaction`/`RateLimitInfo` — usati da Task 6 (sync), Task 9-11 (route API).

- [ ] **Step 1: Scrivere il test (fetch globale mockato, DB reale per la cache token)**

Crea `lib/gocardless/client.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client as dbClient, db } from "@/lib/db/client";
import { gocardlessToken } from "@/lib/db/schema/bank-connections";
import { getAccessToken, listInstitutions } from "./client";

describe("gocardless client", () => {
  beforeEach(async () => {
    await db.delete(gocardlessToken);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it("richiede un nuovo token quando non c'è cache, e lo salva", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ access: "token-1", access_expires: 3600 }), { status: 200 })
    );

    const token = await getAccessToken();
    expect(token).toBe("token-1");
    expect(fetch).toHaveBeenCalledTimes(1);

    const [cached] = await db.select().from(gocardlessToken);
    expect(cached.accessToken).toBe("token-1");
  });

  it("riusa il token in cache se non è scaduto, senza richiamare fetch", async () => {
    await db.insert(gocardlessToken).values({
      id: "singleton",
      accessToken: "cached-token",
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const token = await getAccessToken();
    expect(token).toBe("cached-token");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("listInstitutions chiama l'endpoint corretto e restituisce l'array", async () => {
    await db.insert(gocardlessToken).values({
      id: "singleton",
      accessToken: "cached-token",
      expiresAt: new Date(Date.now() + 3600_000),
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ id: "INST_1", name: "Banca Test", transaction_total_days: "90" }]),
        { status: 200 }
      )
    );

    const institutions = await listInstitutions("IT");
    expect(institutions).toEqual([{ id: "INST_1", name: "Banca Test", transaction_total_days: "90" }]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/institutions/?country=IT");
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm test lib/gocardless/client.test.ts`
Expected: FAIL, `Cannot find module './client'`.

- [ ] **Step 3: Implementare `lib/gocardless/client.ts`**

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { gocardlessToken } from "@/lib/db/schema/bank-connections";

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";
const TOKEN_ROW_ID = "singleton";

export class GoCardlessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GoCardlessError";
    this.status = status;
  }
}

async function fetchNewToken(): Promise<{ access: string; access_expires: number }> {
  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error("GOCARDLESS_SECRET_ID/GOCARDLESS_SECRET_KEY non definite.");
  }
  const response = await fetch(`${BASE_URL}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  if (!response.ok) {
    throw new GoCardlessError("Impossibile ottenere il token GoCardless", response.status);
  }
  return response.json();
}

/** Restituisce un access token valido, riusando la cache DB o rigenerandolo se scaduto/assente. */
export async function getAccessToken(): Promise<string> {
  const [cached] = await db.select().from(gocardlessToken).where(eq(gocardlessToken.id, TOKEN_ROW_ID));
  if (cached && cached.expiresAt.getTime() > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const token = await fetchNewToken();
  const expiresAt = new Date(Date.now() + token.access_expires * 1000);
  await db
    .insert(gocardlessToken)
    .values({ id: TOKEN_ROW_ID, accessToken: token.access, expiresAt })
    .onConflictDoUpdate({
      target: gocardlessToken.id,
      set: { accessToken: token.access, expiresAt },
    });

  return token.access;
}

export interface RateLimitInfo {
  remaining: number;
  resetSeconds: number;
}

interface GoCardlessResponse<T> {
  data: T;
  rateLimit: RateLimitInfo | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<GoCardlessResponse<T>> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new GoCardlessError(`GoCardless ${path} ha risposto ${response.status}`, response.status);
  }

  const remainingHeader = response.headers.get("x-ratelimit-remaining");
  const resetHeader = response.headers.get("x-ratelimit-reset");
  const rateLimit =
    remainingHeader !== null && resetHeader !== null
      ? { remaining: Number(remainingHeader), resetSeconds: Number(resetHeader) }
      : null;

  return { data: (await response.json()) as T, rateLimit };
}

export interface Institution {
  id: string;
  name: string;
  transaction_total_days: string;
}

/** Elenca gli istituti bancari GoCardless disponibili in un paese (codice ISO 3166-1 alpha-2). */
export async function listInstitutions(country: string): Promise<Institution[]> {
  const { data } = await request<Institution[]>(`/institutions/?country=${country}`);
  return data;
}

export interface Requisition {
  id: string;
  status: string;
  link: string;
  accounts: string[];
}

/** Crea un End User Agreement (storico = tutto il disponibile) + una Requisition; restituisce il link di consenso. */
export async function createRequisition(params: {
  institutionId: string;
  maxHistoricalDays: number;
  redirectUrl: string;
  reference: string;
}): Promise<Requisition> {
  const { data: agreement } = await request<{ id: string }>("/agreements/enduser/", {
    method: "POST",
    body: JSON.stringify({
      institution_id: params.institutionId,
      max_historical_days: params.maxHistoricalDays,
      access_valid_for_days: 90,
      access_scope: ["balances", "details", "transactions"],
    }),
  });

  const { data: requisition } = await request<Requisition>("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      redirect: params.redirectUrl,
      institution_id: params.institutionId,
      reference: params.reference,
      agreement: agreement.id,
      user_language: "IT",
    }),
  });

  return requisition;
}

/** Stato aggiornato di una requisition (`accounts` è popolato solo dopo il consenso dell'utente). */
export async function getRequisition(requisitionId: string): Promise<Requisition> {
  const { data } = await request<Requisition>(`/requisitions/${requisitionId}/`);
  return data;
}

export interface AccountDetails {
  iban?: string;
  name?: string;
  product?: string;
}

/** Dettagli identificativi di un conto esterno (nome/IBAN), usati nella UI di selezione. */
export async function getAccountDetails(externalAccountId: string): Promise<AccountDetails> {
  const { data } = await request<{ account: AccountDetails }>(`/accounts/${externalAccountId}/details/`);
  return data.account;
}

export interface Balance {
  balanceAmount: { amount: string; currency: string };
  balanceType: string;
}

/** Saldo di un conto esterno: preferisce "interimAvailable", altrimenti il primo disponibile. */
export async function getAccountBalances(
  externalAccountId: string
): Promise<{ balance: Balance; rateLimit: RateLimitInfo | null }> {
  const { data, rateLimit } = await request<{ balances: Balance[] }>(`/accounts/${externalAccountId}/balances/`);
  const balance = data.balances.find((b) => b.balanceType === "interimAvailable") ?? data.balances[0];
  return { balance, rateLimit };
}

export interface BankTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  bookingDate: string;
}

/** Transazioni "booked" di un conto esterno (le "pending" non si importano, per evitare doppioni al booking). */
export async function getAccountTransactions(
  externalAccountId: string
): Promise<{ transactions: BankTransaction[]; rateLimit: RateLimitInfo | null }> {
  const { data, rateLimit } = await request<{
    transactions: { booked: BankTransaction[]; pending: BankTransaction[] };
  }>(`/accounts/${externalAccountId}/transactions/`);
  return { transactions: data.transactions.booked, rateLimit };
}
```

- [ ] **Step 4: Eseguire di nuovo il test**

Run: `pnpm test lib/gocardless/client.test.ts`
Expected: 3 test PASS.

- [ ] **Step 5: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/gocardless/client.ts lib/gocardless/client.test.ts
git commit -m "feat: add GoCardless Bank Account Data HTTP client"
```

---

### Task 5: Categorizzazione best-effort delle transazioni importate

**Files:**
- Create: `lib/gocardless/categorize.ts`
- Test: `lib/gocardless/categorize.test.ts`

**Interfaces:**
- Consumes: `categories`, `transactions` (Task 2).
- Produces: `FALLBACK_CATEGORY_NAME`, `getFallbackCategoryId()`, `resolveCategoryId()` — usati da Task 6 (sync).

- [ ] **Step 1: Scrivere il test**

Crea `lib/gocardless/categorize.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { FALLBACK_CATEGORY_NAME, getFallbackCategoryId, resolveCategoryId } from "./categorize";

describe("categorize", () => {
  let userId: string;

  afterAll(async () => {
    if (userId) await db.delete(authUser).where(eq(authUser.id, userId));
    await client.end();
  });

  it("riusa la categoria di una transazione precedente con stessa descrizione (case-insensitive)", async () => {
    const testId = `test-categorize-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Categorize",
        email: `test-categorize-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Abbonamenti", type: "fissa" })
      .returning();
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto", type: "Conto corrente", balance: "0" })
      .returning();
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId: category.id,
      description: "Netflix",
      amount: "-12.99",
      date: "2026-07-01",
    });

    const matched = await resolveCategoryId(userId, "netflix");
    expect(matched).toBe(category.id);
  });

  it("crea e riusa la categoria di fallback quando non trova match", async () => {
    const fallbackId1 = await getFallbackCategoryId(userId);
    const fallbackId2 = await getFallbackCategoryId(userId);
    expect(fallbackId1).toBe(fallbackId2);

    const [fallbackCategory] = await db.select().from(categories).where(eq(categories.id, fallbackId1));
    expect(fallbackCategory.name).toBe(FALLBACK_CATEGORY_NAME);

    const resolved = await resolveCategoryId(userId, "Descrizione mai vista prima");
    expect(resolved).toBe(fallbackId1);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm test lib/gocardless/categorize.test.ts`
Expected: FAIL, `Cannot find module './categorize'`.

- [ ] **Step 3: Implementare `lib/gocardless/categorize.ts`**

```ts
import { and, desc, eq, ilike, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";

export const FALLBACK_CATEGORY_NAME = "Da categorizzare";

/** Id della categoria di fallback dell'utente, creata al volo se non esiste ancora. */
export async function getFallbackCategoryId(userId: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, FALLBACK_CATEGORY_NAME)));
  if (existing) return existing.id;

  const [created] = await db
    .insert(categories)
    .values({ userId, name: FALLBACK_CATEGORY_NAME, type: "variabile" })
    .returning();
  return created.id;
}

/** Categoria dell'ultima transazione con la stessa descrizione (case-insensitive), se già categorizzata. */
async function matchCategoryId(userId: string, description: string, fallbackId: string): Promise<string | null> {
  const [match] = await db
    .select({ categoryId: transactions.categoryId })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        ilike(transactions.description, description),
        ne(transactions.categoryId, fallbackId)
      )
    )
    .orderBy(desc(transactions.date))
    .limit(1);
  return match?.categoryId ?? null;
}

/** Categoria da assegnare a una transazione importata: match su descrizione esistente, altrimenti fallback. */
export async function resolveCategoryId(userId: string, description: string): Promise<string> {
  const fallbackId = await getFallbackCategoryId(userId);
  const matched = await matchCategoryId(userId, description, fallbackId);
  return matched ?? fallbackId;
}
```

- [ ] **Step 4: Eseguire di nuovo il test**

Run: `pnpm test lib/gocardless/categorize.test.ts`
Expected: 2 test PASS.

- [ ] **Step 5: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/gocardless/categorize.ts lib/gocardless/categorize.test.ts
git commit -m "feat: add best-effort category matching for imported transactions"
```

---

### Task 6: Motore di sync di un conto collegato

**Files:**
- Create: `lib/gocardless/sync.ts`
- Test: `lib/gocardless/sync.test.ts`

**Interfaces:**
- Consumes: `getAccountBalances`/`getAccountTransactions`/`GoCardlessError` (Task 4), `isRateLimited`/`recordRateLimit`/`RateLimitStore` (Task 3), `resolveCategoryId` (Task 5), `bankAccountLinks`/`bankConnections` (Task 2).
- Produces: `syncAccountLink(link, rateLimitStore)`, tipo `SyncableLink` — usati da Task 7 (scheduler), Task 11 (finalize).

- [ ] **Step 1: Scrivere il test (mock parziale del client GoCardless, store di rate limit in memoria, DB reale)**

Crea `lib/gocardless/sync.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { transactions } from "@/lib/db/schema/transactions";
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

  it("aggiorna saldo e importa transazioni con categoria di fallback", async () => {
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

    await syncAccountLink(link, createMemoryStore());

    const [account] = await db.select().from(accounts).where(eq(accounts.id, link.accountId));
    expect(account.balance).toBe("150.00");

    const storedTransactions = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(storedTransactions).toHaveLength(1);
    expect(storedTransactions[0].externalId).toBe("tx-1");
    expect(storedTransactions[0].amount).toBe("-20.00");
  });

  it("è idempotente: un secondo sync con la stessa transazione non duplica", async () => {
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
    await syncAccountLink(link, createMemoryStore());

    const storedTransactions = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(storedTransactions).toHaveLength(1);
  });

  it("su 401 marca la connessione come 'expired'", async () => {
    vi.mocked(getAccountBalances).mockRejectedValue(new GoCardlessError("unauthorized", 401));

    await syncAccountLink(link, createMemoryStore());

    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.id, link.connectionId));
    expect(connection.status).toBe("expired");
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm test lib/gocardless/sync.test.ts`
Expected: FAIL, `Cannot find module './sync'`.

- [ ] **Step 3: Implementare `lib/gocardless/sync.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { transactions } from "@/lib/db/schema/transactions";
import { GoCardlessError, getAccountBalances, getAccountTransactions } from "./client";
import { isRateLimited, recordRateLimit, type RateLimitStore } from "./rate-limit";
import { resolveCategoryId } from "./categorize";

const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

export interface SyncableLink {
  linkId: string;
  connectionId: string;
  accountId: string;
  externalAccountId: string;
  userId: string;
}

/** Sincronizza saldo e transazioni di un conto collegato; aggiorna i timestamp o marca la connessione scaduta. */
export async function syncAccountLink(link: SyncableLink, rateLimitStore: RateLimitStore): Promise<void> {
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "balances")) return;
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "transactions")) return;

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

    for (const bankTransaction of bankTransactions) {
      const externalId = bankTransaction.internalTransactionId ?? bankTransaction.transactionId;
      if (!externalId) continue;

      const description = bankTransaction.remittanceInformationUnstructured ?? "Movimento bancario";
      const categoryId = await resolveCategoryId(link.userId, description);

      await db
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
        .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] });
    }

    await db
      .update(bankAccountLinks)
      .set({ lastSyncedAt: new Date(), nextSyncEligibleAt: new Date(Date.now() + SYNC_INTERVAL_MS) })
      .where(eq(bankAccountLinks.id, link.linkId));
  } catch (error) {
    if (error instanceof GoCardlessError && error.status === 401) {
      await db
        .update(bankConnections)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(bankConnections.id, link.connectionId));
      return;
    }
    throw error;
  }
}
```

- [ ] **Step 4: Eseguire di nuovo il test**

Run: `pnpm test lib/gocardless/sync.test.ts`
Expected: 3 test PASS.

- [ ] **Step 5: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/gocardless/sync.ts lib/gocardless/sync.test.ts
git commit -m "feat: add GoCardless sync engine with idempotent transaction import"
```

---

### Task 7: Scheduler cron (ogni 12h) e boot Next.js

**Files:**
- Create: `lib/gocardless/scheduler.ts`
- Create: `instrumentation.ts`
- Test: `lib/gocardless/scheduler.test.ts`

**Interfaces:**
- Consumes: `syncAccountLink`/`SyncableLink` (Task 6), `redisRateLimitStore` (Task 3).
- Produces: `findDueLinks()`, `runDueSyncs()`, `startGoCardlessScheduler()`.

- [ ] **Step 1: Scrivere il test (DB reale per `findDueLinks`, `syncAccountLink` mockato per `runDueSyncs`)**

Crea `lib/gocardless/scheduler.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/gocardless/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/sync")>();
  return { ...actual, syncAccountLink: vi.fn() };
});

import { syncAccountLink } from "./sync";
import { findDueLinks, runDueSyncs } from "./scheduler";

describe("scheduler", () => {
  let userId: string;

  async function createLink(nextSyncEligibleAt: Date, status: "linked" | "expired" = "linked") {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status })
      .returning();
    await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-1", nextSyncEligibleAt });
  }

  beforeEach(async () => {
    const testId = `test-scheduler-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Scheduler",
        email: `test-scheduler-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    vi.mocked(syncAccountLink).mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await client.end();
  });

  it("trova solo i link scaduti e con connessione 'linked'", async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    await createLink(past, "linked");
    await createLink(past, "expired");
    await createLink(future, "linked");

    const due = await findDueLinks();
    expect(due).toHaveLength(1);
  });

  it("runDueSyncs chiama syncAccountLink una volta per ogni link dovuto", async () => {
    const past = new Date(Date.now() - 60_000);
    await createLink(past, "linked");
    await createLink(past, "linked");

    await runDueSyncs();

    expect(syncAccountLink).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm test lib/gocardless/scheduler.test.ts`
Expected: FAIL, `Cannot find module './scheduler'`.

- [ ] **Step 3: Implementare `lib/gocardless/scheduler.ts`**

```ts
import cron from "node-cron";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "./redis-rate-limit-store";
import { syncAccountLink, type SyncableLink } from "./sync";

/** Conti collegati con sync scaduto e connessione ancora valida (non expired/error). */
export async function findDueLinks(): Promise<SyncableLink[]> {
  return db
    .select({
      linkId: bankAccountLinks.id,
      connectionId: bankAccountLinks.connectionId,
      accountId: bankAccountLinks.accountId,
      externalAccountId: bankAccountLinks.externalAccountId,
      userId: bankConnections.userId,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(and(lte(bankAccountLinks.nextSyncEligibleAt, new Date()), eq(bankConnections.status, "linked")));
}

/**
 * Sincronizza tutti i conti dovuti. Un errore su un conto (rete, 5xx GoCardless)
 * viene loggato e non deve bloccare il sync degli altri conti nello stesso tick.
 */
export async function runDueSyncs(): Promise<void> {
  const due = await findDueLinks();
  for (const link of due) {
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

- [ ] **Step 4: Eseguire di nuovo il test**

Run: `pnpm test lib/gocardless/scheduler.test.ts`
Expected: 2 test PASS.

- [ ] **Step 5: Creare `instrumentation.ts` (boot Next.js)**

Crea `instrumentation.ts` nella root del progetto (stesso livello di `package.json`):

```ts
/** Hook di boot Next.js: avvia lo scheduler di sync GoCardless nel runtime Node.js. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startGoCardlessScheduler } = await import("@/lib/gocardless/scheduler");
    startGoCardlessScheduler();
  }
}
```

- [ ] **Step 6: Verificare il type-check**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/gocardless/scheduler.ts lib/gocardless/scheduler.test.ts instrumentation.ts
git commit -m "feat: schedule GoCardless sync every 12 hours via instrumentation hook"
```

---

### Task 8: Schemi di validazione Zod

**Files:**
- Create: `lib/validation/gocardless.ts`

**Interfaces:**
- Produces: `createConnectionSchema`/`CreateConnectionInput`, `finalizeSelectionSchema`/`FinalizeSelectionInput` — usati da Task 9 e 11 (route API) e Task 12 (query hooks).

- [ ] **Step 1: Implementare `lib/validation/gocardless.ts`**

```ts
import { z } from "zod";

export const createConnectionSchema = z.object({
  institutionId: z.string().trim().min(1),
  institutionName: z.string().trim().min(1),
  transactionTotalDays: z.number().int().positive(),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

export const finalizeSelectionSchema = z.object({
  selections: z
    .array(
      z.object({
        externalAccountId: z.string().trim().min(1),
        name: z.string().trim().min(1),
        type: z.string().trim().min(1),
        mode: z.enum(["new", "existing"]),
        existingAccountId: z.string().uuid().optional(),
      })
    )
    .min(1),
});

export type FinalizeSelectionInput = z.infer<typeof finalizeSelectionSchema>;
```

- [ ] **Step 2: Verificare il type-check**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/validation/gocardless.ts
git commit -m "feat: add validation schemas for GoCardless connection flow"
```

---

### Task 9: Route API — istituti e connessioni

**Files:**
- Create: `app/api/gocardless/institutions/route.ts`
- Create: `app/api/gocardless/connections/route.ts`
- Test: `app/api/gocardless/connections/route.test.ts`

**Interfaces:**
- Consumes: `listInstitutions`/`createRequisition` (Task 4), `createConnectionSchema` (Task 8), `bankConnections`/`bankAccountLinks` (Task 2).
- Produces: `GET /api/gocardless/institutions?country=`, `POST /api/gocardless/connections` (`{ link: string }`), `GET /api/gocardless/connections` (`{ accountId, status }[]`) — usati da Task 12 (query hooks).

- [ ] **Step 1: Implementare `app/api/gocardless/institutions/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listInstitutions } from "@/lib/gocardless/client";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const country = request.nextUrl.searchParams.get("country");
  if (!country) {
    return Response.json({ error: "Parametro country obbligatorio" }, { status: 400 });
  }

  const institutions = await listInstitutions(country);
  return Response.json(institutions);
}
```

- [ ] **Step 2: Scrivere il test per `connections/route.ts`**

Crea `app/api/gocardless/connections/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/client")>();
  return { ...actual, createRequisition: vi.fn() };
});

import { auth } from "@/lib/auth";
import { createRequisition } from "@/lib/gocardless/client";
import { GET, POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET/POST /api/gocardless/connections", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-connections-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Connections",
        email: `test-connections-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(createRequisition).mockReset();
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await POST(new NextRequest("http://localhost/api/gocardless/connections", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("crea la connessione e restituisce il link di consenso", async () => {
    vi.mocked(createRequisition).mockResolvedValue({
      id: "req-1",
      status: "CR",
      link: "https://ob.gocardless.com/psd2/start/req-1",
      accounts: [],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/gocardless/connections", {
        method: "POST",
        body: JSON.stringify({ institutionId: "INST_1", institutionName: "Banca Test", transactionTotalDays: 90 }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.link).toBe("https://ob.gocardless.com/psd2/start/req-1");

    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.userId, userId));
    expect(connection.requisitionId).toBe("req-1");
  });

  it("marca la connessione 'error' se GoCardless fallisce", async () => {
    vi.mocked(createRequisition).mockRejectedValue(new Error("GoCardless down"));

    const response = await POST(
      new NextRequest("http://localhost/api/gocardless/connections", {
        method: "POST",
        body: JSON.stringify({ institutionId: "INST_1", institutionName: "Banca Test", transactionTotalDays: 90 }),
      })
    );
    expect(response.status).toBe(502);

    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.userId, userId));
    expect(connection.status).toBe("error");
  });

  it("GET restituisce lo stato delle connessioni per conto", async () => {
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
    expect(body).toEqual([{ accountId: account.id, status: "expired" }]);
  });
});
```

- [ ] **Step 3: Eseguire il test e verificare che fallisca**

Run: `pnpm test app/api/gocardless/connections/route.test.ts`
Expected: FAIL, `Cannot find module './route'`.

- [ ] **Step 4: Implementare `app/api/gocardless/connections/route.ts`**

```ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { createRequisition } from "@/lib/gocardless/client";
import { createConnectionSchema } from "@/lib/validation/gocardless";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const rows = await db
    .select({ accountId: bankAccountLinks.accountId, status: bankConnections.status })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(eq(bankConnections.userId, session.user.id));

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const body = await request.json();
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [connection] = await db
    .insert(bankConnections)
    .values({
      userId: session.user.id,
      institutionId: parsed.data.institutionId,
      institutionName: parsed.data.institutionName,
      status: "pending",
    })
    .returning();

  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/gocardless/callback`;
  try {
    const requisition = await createRequisition({
      institutionId: parsed.data.institutionId,
      maxHistoricalDays: parsed.data.transactionTotalDays,
      redirectUrl,
      reference: connection.id,
    });

    await db
      .update(bankConnections)
      .set({
        requisitionId: requisition.id,
        consentExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .where(eq(bankConnections.id, connection.id));

    return Response.json({ link: requisition.link });
  } catch {
    await db.update(bankConnections).set({ status: "error" }).where(eq(bankConnections.id, connection.id));
    return Response.json({ error: "Impossibile avviare il collegamento con la banca" }, { status: 502 });
  }
}
```

- [ ] **Step 5: Eseguire di nuovo il test**

Run: `pnpm test app/api/gocardless/connections/route.test.ts`
Expected: 4 test PASS.

- [ ] **Step 6: Verificare il type-check completo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add app/api/gocardless/institutions app/api/gocardless/connections/route.ts app/api/gocardless/connections/route.test.ts
git commit -m "feat: add institutions listing and connection creation API routes"
```

---

### Task 10: Route API — callback di ritorno dal consenso

**Files:**
- Create: `app/api/gocardless/callback/route.ts`
- Test: `app/api/gocardless/callback/route.test.ts`

**Interfaces:**
- Consumes: `getRequisition` (Task 4), `bankConnections` (Task 2).
- Produces: `GET /api/gocardless/callback?ref=` → redirect 302 verso `/conti/collega/{id}` (successo) o `/conti?bankError=...` (errore).

- [ ] **Step 1: Scrivere il test**

Crea `app/api/gocardless/callback/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("@/lib/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/client")>();
  return { ...actual, getRequisition: vi.fn() };
});

import { getRequisition } from "@/lib/gocardless/client";
import { GET } from "./route";

describe("GET /api/gocardless/callback", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-callback-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Callback",
        email: `test-callback-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    vi.mocked(getRequisition).mockReset();
  });

  afterAll(async () => {
    if (userId) await db.delete(authUser).where(eq(authUser.id, userId));
    await client.end();
  });

  it("senza ref, redirige a /conti con errore", async () => {
    const response = await GET(new NextRequest("http://localhost/api/gocardless/callback"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/conti?bankError=missing_ref");
  });

  it("con requisition linkata (status LN), redirige alla pagina di selezione e marca 'linked'", async () => {
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", requisitionId: "req-1", status: "pending" })
      .returning();
    vi.mocked(getRequisition).mockResolvedValue({ id: "req-1", status: "LN", link: "", accounts: ["ext-1"] });

    const response = await GET(new NextRequest(`http://localhost/api/gocardless/callback?ref=${connection.id}`));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(`/conti/collega/${connection.id}`);

    const [updated] = await db.select().from(bankConnections).where(eq(bankConnections.id, connection.id));
    expect(updated.status).toBe("linked");
  });

  it("con requisition non completata, marca 'error' e redirige a /conti", async () => {
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", requisitionId: "req-2", status: "pending" })
      .returning();
    vi.mocked(getRequisition).mockResolvedValue({ id: "req-2", status: "RJ", link: "", accounts: [] });

    const response = await GET(new NextRequest(`http://localhost/api/gocardless/callback?ref=${connection.id}`));
    expect(response.headers.get("location")).toContain("/conti?bankError=consent_failed");

    const [updated] = await db.select().from(bankConnections).where(eq(bankConnections.id, connection.id));
    expect(updated.status).toBe("error");
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm test app/api/gocardless/callback/route.test.ts`
Expected: FAIL, `Cannot find module './route'`.

- [ ] **Step 3: Implementare `app/api/gocardless/callback/route.ts`**

```ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { getRequisition } from "@/lib/gocardless/client";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) {
    return Response.redirect(`${appUrl}/conti?bankError=missing_ref`, 302);
  }

  const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.id, ref));
  if (!connection || !connection.requisitionId) {
    return Response.redirect(`${appUrl}/conti?bankError=not_found`, 302);
  }

  const requisition = await getRequisition(connection.requisitionId);
  if (requisition.status !== "LN") {
    await db.update(bankConnections).set({ status: "error" }).where(eq(bankConnections.id, connection.id));
    return Response.redirect(`${appUrl}/conti?bankError=consent_failed`, 302);
  }

  await db.update(bankConnections).set({ status: "linked" }).where(eq(bankConnections.id, connection.id));
  return Response.redirect(`${appUrl}/conti/collega/${connection.id}`, 302);
}
```

- [ ] **Step 4: Eseguire di nuovo il test**

Run: `pnpm test app/api/gocardless/callback/route.test.ts`
Expected: 3 test PASS.

- [ ] **Step 5: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add app/api/gocardless/callback
git commit -m "feat: add GoCardless consent callback route"
```

---

### Task 11: Route API — conti esterni trovati e finalizzazione selezione

**Files:**
- Create: `app/api/gocardless/connections/[id]/accounts/route.ts`
- Create: `app/api/gocardless/connections/[id]/finalize/route.ts`
- Test: `app/api/gocardless/connections/[id]/finalize/route.test.ts`

**Interfaces:**
- Consumes: `getRequisition`/`getAccountDetails` (Task 4), `finalizeSelectionSchema` (Task 8), `syncAccountLink` (Task 6), `redisRateLimitStore` (Task 3), `accounts`/`bankAccountLinks`/`bankConnections` (Task 2).
- Produces: `GET .../accounts` → `{ externalAccounts, existingAutoAccounts }`, `POST .../finalize` → `201` — usati da Task 12 (query hooks), Task 14 (pagina di selezione).

- [ ] **Step 1: Implementare `app/api/gocardless/connections/[id]/accounts/route.ts`**

```ts
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { getAccountDetails, getRequisition } from "@/lib/gocardless/client";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const { id } = await params;
  const [connection] = await db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.id, id), eq(bankConnections.userId, session.user.id)));
  if (!connection || !connection.requisitionId) {
    return new Response(null, { status: 404 });
  }

  const requisition = await getRequisition(connection.requisitionId);
  const externalAccounts = await Promise.all(
    requisition.accounts.map(async (externalAccountId) => ({
      externalAccountId,
      details: await getAccountDetails(externalAccountId),
    }))
  );

  const existingAutoAccounts = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(and(eq(accounts.userId, session.user.id), eq(accounts.source, "auto")));

  return Response.json({ externalAccounts, existingAutoAccounts });
}
```

- [ ] **Step 2: Scrivere il test per la finalizzazione**

Crea `app/api/gocardless/connections/[id]/finalize/route.test.ts`:

```ts
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
  return { ...actual, syncAccountLink: vi.fn().mockResolvedValue(undefined) };
});

import { auth } from "@/lib/auth";
import { syncAccountLink } from "@/lib/gocardless/sync";
import { POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("POST /api/gocardless/connections/[id]/finalize", () => {
  let userId: string;
  let connectionId: string;

  beforeEach(async () => {
    const testId = `test-finalize-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Finalize",
        email: `test-finalize-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);

    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", requisitionId: "req-1", status: "linked" })
      .returning();
    connectionId = connection.id;
    vi.mocked(syncAccountLink).mockClear();
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("crea un nuovo conto per una selezione 'new' e lancia il sync", async () => {
    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          selections: [{ externalAccountId: "ext-1", name: "Conto Corrente", type: "Conto corrente", mode: "new" }],
        }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );
    expect(response.status).toBe(201);
    expect(syncAccountLink).toHaveBeenCalledTimes(1);

    const [createdAccount] = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(createdAccount.source).toBe("auto");

    const [link] = await db.select().from(bankAccountLinks).where(eq(bankAccountLinks.accountId, createdAccount.id));
    expect(link.externalAccountId).toBe("ext-1");
  });

  it("ricollega un conto esistente per una selezione 'existing'", async () => {
    const [existingAccount] = await db
      .insert(accounts)
      .values({ userId, name: "Vecchio Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [oldConnection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "expired" })
      .returning();
    await db
      .insert(bankAccountLinks)
      .values({ connectionId: oldConnection.id, accountId: existingAccount.id, externalAccountId: "old-ext" });

    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          selections: [
            {
              externalAccountId: "ext-new",
              name: "Conto Corrente",
              type: "Conto corrente",
              mode: "existing",
              existingAccountId: existingAccount.id,
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );
    expect(response.status).toBe(201);

    const [link] = await db.select().from(bankAccountLinks).where(eq(bankAccountLinks.accountId, existingAccount.id));
    expect(link.externalAccountId).toBe("ext-new");
    expect(link.connectionId).toBe(connectionId);
  });

  it("risponde 400 se 'existing' senza existingAccountId", async () => {
    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          selections: [{ externalAccountId: "ext-1", name: "Conto", type: "Conto corrente", mode: "existing" }],
        }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );
    expect(response.status).toBe(400);
  });

  it("risponde 404 se la connessione non è dell'utente", async () => {
    mockedGetSession.mockResolvedValueOnce({ user: { id: "altro-utente" } } as never);
    const response = await POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          selections: [{ externalAccountId: "ext-1", name: "Conto", type: "Conto corrente", mode: "new" }],
        }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 3: Eseguire il test e verificare che fallisca**

Run: `pnpm test app/api/gocardless/connections/[id]/finalize/route.test.ts`
Expected: FAIL, `Cannot find module './route'`.

- [ ] **Step 4: Implementare `app/api/gocardless/connections/[id]/finalize/route.ts`**

```ts
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "@/lib/gocardless/redis-rate-limit-store";
import { syncAccountLink, type SyncableLink } from "@/lib/gocardless/sync";
import { finalizeSelectionSchema } from "@/lib/validation/gocardless";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const { id } = await params;
  const [connection] = await db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.id, id), eq(bankConnections.userId, session.user.id)));
  if (!connection) return new Response(null, { status: 404 });

  const body = await request.json();
  const parsed = finalizeSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const linksToSync: SyncableLink[] = [];

  for (const selection of parsed.data.selections) {
    if (selection.mode === "existing") {
      if (!selection.existingAccountId) {
        return Response.json({ error: "existingAccountId richiesto per mode 'existing'" }, { status: 400 });
      }
      const [updatedLink] = await db
        .update(bankAccountLinks)
        .set({ connectionId: connection.id, externalAccountId: selection.externalAccountId })
        .where(eq(bankAccountLinks.accountId, selection.existingAccountId))
        .returning();
      linksToSync.push({
        linkId: updatedLink.id,
        connectionId: connection.id,
        accountId: selection.existingAccountId,
        externalAccountId: selection.externalAccountId,
        userId: session.user.id,
      });
    } else {
      const [account] = await db
        .insert(accounts)
        .values({ userId: session.user.id, name: selection.name, type: selection.type, source: "auto" })
        .returning();
      const [link] = await db
        .insert(bankAccountLinks)
        .values({ connectionId: connection.id, accountId: account.id, externalAccountId: selection.externalAccountId })
        .returning();
      linksToSync.push({
        linkId: link.id,
        connectionId: connection.id,
        accountId: account.id,
        externalAccountId: selection.externalAccountId,
        userId: session.user.id,
      });
    }
  }

  for (const link of linksToSync) {
    await syncAccountLink(link, redisRateLimitStore);
  }

  return Response.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 5: Eseguire di nuovo il test**

Run: `pnpm test app/api/gocardless/connections/[id]/finalize/route.test.ts`
Expected: 4 test PASS.

- [ ] **Step 6: Verificare il type-check completo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add "app/api/gocardless/connections/[id]"
git commit -m "feat: add external accounts listing and finalize connection routes"
```

---

### Task 12: Hook TanStack Query lato client

**Files:**
- Create: `lib/queries/gocardless.ts`

**Interfaces:**
- Consumes: `CreateConnectionInput`/`FinalizeSelectionInput` (Task 8), le route di Task 9-11.
- Produces: `useInstitutionsQuery`, `useBankConnectionsStatusQuery`, `useCreateConnectionMutation`, `useConnectionAccountsQuery`, `useFinalizeConnectionMutation`, tipi `Institution`/`BankConnectionStatus`/`ExternalAccount`/`ConnectionAccountsResponse` — usati da Task 13 e 14.

- [ ] **Step 1: Implementare `lib/queries/gocardless.ts`**

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateConnectionInput, FinalizeSelectionInput } from "@/lib/validation/gocardless";

export interface Institution {
  id: string;
  name: string;
  transaction_total_days: string;
}

export interface BankConnectionStatus {
  accountId: string;
  status: "pending" | "linked" | "expired" | "error";
}

export interface ExternalAccount {
  externalAccountId: string;
  details: { iban?: string; name?: string; product?: string };
}

export interface ConnectionAccountsResponse {
  externalAccounts: ExternalAccount[];
  existingAutoAccounts: { id: string; name: string }[];
}

/** Elenca gli istituti bancari GoCardless disponibili in un paese. */
export function useInstitutionsQuery(country: string) {
  return useQuery({
    queryKey: ["gocardless", "institutions", country],
    queryFn: async (): Promise<Institution[]> => {
      const response = await fetch(`/api/gocardless/institutions?country=${country}`);
      if (!response.ok) throw new Error("Impossibile caricare gli istituti");
      return response.json();
    },
    enabled: country.length > 0,
  });
}

/** Stato delle connessioni bancarie dell'utente, per i badge "Riconnetti". */
export function useBankConnectionsStatusQuery() {
  return useQuery({
    queryKey: ["gocardless", "connections", "status"],
    queryFn: async (): Promise<BankConnectionStatus[]> => {
      const response = await fetch("/api/gocardless/connections");
      if (!response.ok) throw new Error("Impossibile caricare lo stato delle connessioni");
      return response.json();
    },
  });
}

/** Crea una connessione GoCardless e restituisce il link di consenso a cui reindirizzare. */
export function useCreateConnectionMutation() {
  return useMutation({
    mutationFn: async (input: CreateConnectionInput): Promise<{ link: string }> => {
      const response = await fetch("/api/gocardless/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error ?? "Impossibile avviare il collegamento");
      }
      return response.json();
    },
  });
}

/** Conti esterni trovati dopo il consenso, per la pagina di selezione. */
export function useConnectionAccountsQuery(connectionId: string) {
  return useQuery({
    queryKey: ["gocardless", "connections", connectionId, "accounts"],
    queryFn: async (): Promise<ConnectionAccountsResponse> => {
      const response = await fetch(`/api/gocardless/connections/${connectionId}/accounts`);
      if (!response.ok) throw new Error("Impossibile caricare i conti trovati");
      return response.json();
    },
  });
}

/** Finalizza la selezione dei conti da importare/ricollegare. */
export function useFinalizeConnectionMutation(connectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: FinalizeSelectionInput) => {
      const response = await fetch(`/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error ?? "Impossibile completare il collegamento");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["gocardless", "connections", "status"] });
    },
  });
}
```

- [ ] **Step 2: Verificare il type-check**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/queries/gocardless.ts
git commit -m "feat: add TanStack Query hooks for GoCardless connection flow"
```

---

### Task 13: UI — "Collega banca" nel form Aggiungi conto

**Files:**
- Create: `components/domain/accounts/connect-bank-flow.tsx`
- Modify: `components/domain/accounts/add-account-form.tsx`

**Interfaces:**
- Consumes: `useInstitutionsQuery`, `useCreateConnectionMutation` (Task 12).
- Produces: `<ConnectBankFlow />`; `AddAccountForm` guadagna la prop opzionale `mode` (usata da Task 15 per forzare l'apertura sul tab "Collega banca" dal bottone "Riconnetti").

- [ ] **Step 1: Creare `components/domain/accounts/connect-bank-flow.tsx`**

```tsx
"use client";

/** Flusso "Collega banca": selezione paese, ricerca istituto, redirect al consenso GoCardless. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateConnectionMutation, useInstitutionsQuery } from "@/lib/queries/gocardless";

const COUNTRY_OPTIONS = [
  { code: "IT", label: "Italia" },
  { code: "DE", label: "Germania" },
  { code: "FR", label: "Francia" },
  { code: "ES", label: "Spagna" },
  { code: "GB", label: "Regno Unito" },
] as const;

export function ConnectBankFlow() {
  const [country, setCountry] = React.useState<string>(COUNTRY_OPTIONS[0].code);
  const [search, setSearch] = React.useState("");
  const { data: institutions, isLoading } = useInstitutionsQuery(country);
  const createConnection = useCreateConnectionMutation();
  const [error, setError] = React.useState<string | null>(null);

  const filtered = (institutions ?? []).filter((institution) =>
    institution.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleSelect(institutionId: string, institutionName: string, transactionTotalDays: string) {
    setError(null);
    createConnection.mutate(
      { institutionId, institutionName, transactionTotalDays: Number(transactionTotalDays) },
      {
        onSuccess: (data) => {
          window.location.href = data.link;
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Paese</label>
          <Select value={country} onValueChange={(value) => setCountry(value as string)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca la tua banca…"
          className="w-56"
          aria-label="Cerca istituto"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento istituti…</p>
      ) : (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {filtered.map((institution) => (
            <Button
              key={institution.id}
              type="button"
              variant="outline"
              className="justify-start"
              disabled={createConnection.isPending}
              onClick={() => handleSelect(institution.id, institution.name, institution.transaction_total_days)}
            >
              {institution.name}
            </Button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Aggiungere lo switch "Manuale"/"Collega banca" in `add-account-form.tsx`**

Aggiungi l'import in cima al file, sotto gli altri import da `./`:

```ts
import { ConnectBankFlow } from "./connect-bank-flow";
```

Aggiorna l'interfaccia e la firma del componente:

```ts
export interface AddAccountFormProps {
  /** Valuta dell'utente (ISO 4217), usata per CurrencyInput. */
  currency: string;
  /** Forza il tab iniziale (usato dal bottone "Riconnetti" in AccountRow); di default "manuale". */
  mode?: "manuale" | "collega-banca";
}

export function AddAccountForm({ currency, mode: modeProp }: AddAccountFormProps) {
  const [mode, setMode] = React.useState<"manuale" | "collega-banca">(modeProp ?? "manuale");
  React.useEffect(() => {
    if (modeProp) setMode(modeProp);
  }, [modeProp]);

  const createMutation = useCreateAccountMutation();
```

Subito prima del `return (` finale del form manuale, avvolgi tutto in un frammento con lo switch dei tab. Sostituisci l'attuale:

```tsx
  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
```

con:

```tsx
  return (
    <div className="flex flex-col">
      <div className="flex gap-2 px-4 pt-3">
        <Button type="button" size="sm" variant={mode === "manuale" ? "default" : "outline"} onClick={() => setMode("manuale")}>
          Manuale
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "collega-banca" ? "default" : "outline"}
          onClick={() => setMode("collega-banca")}
        >
          Collega banca
        </Button>
      </div>

      {mode === "collega-banca" ? (
        <ConnectBankFlow />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
```

E alla fine del file, chiudi i tag aggiunti — sostituisci l'ultimo:

```tsx
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
```

con:

```tsx
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </form>
      )}
    </div>
  );
}
```

(nota: il contenuto del form manuale resta identico, solo indentato di un livello in più dentro il nuovo `<form>`/`{mode === "manuale" && (...)}`).

- [ ] **Step 3: Verificare il type-check**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 4: Aggiornare il barrel**

`components/domain/accounts/index.ts` non cambia — `ConnectBankFlow` resta interno, usato solo da `add-account-form.tsx` nella stessa cartella (vedi Global Constraints).

- [ ] **Step 5: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add components/domain/accounts/connect-bank-flow.tsx components/domain/accounts/add-account-form.tsx
git commit -m "feat: add bank connection flow to the add account form"
```

---

### Task 14: UI — pagina di selezione conti esterni post-consenso

**Files:**
- Create: `app/(app)/conti/collega/[connectionId]/page.tsx`
- Create: `components/ui/checkbox.tsx` (via shadcn)

**Interfaces:**
- Consumes: `useConnectionAccountsQuery`, `useFinalizeConnectionMutation` (Task 12), `FinalizeSelectionInput` (Task 8).
- Produces: pagina `/conti/collega/[connectionId]`, raggiunta dal redirect di Task 10.

- [ ] **Step 1: Aggiungere il componente shadcn Checkbox**

Run: `pnpm dlx shadcn@latest add checkbox`
Expected: crea `components/ui/checkbox.tsx`, nessun errore.

- [ ] **Step 2: Creare `app/(app)/conti/collega/[connectionId]/page.tsx`**

```tsx
"use client";

/** Pagina di selezione dei conti trovati dopo il consenso GoCardless: crea nuovi conti o ricollega uno esistente. */

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnectionAccountsQuery, useFinalizeConnectionMutation } from "@/lib/queries/gocardless";
import type { FinalizeSelectionInput } from "@/lib/validation/gocardless";

const NEW_ACCOUNT_VALUE = "__new__";

export default function CollegaBancaPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useConnectionAccountsQuery(connectionId);
  const finalize = useFinalizeConnectionMutation(connectionId);

  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [targets, setTargets] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    const selections: FinalizeSelectionInput["selections"] = (data?.externalAccounts ?? [])
      .filter((account) => selected[account.externalAccountId])
      .map((account) => {
        const target = targets[account.externalAccountId] ?? NEW_ACCOUNT_VALUE;
        return target === NEW_ACCOUNT_VALUE
          ? {
              externalAccountId: account.externalAccountId,
              name: account.details.name ?? account.details.iban ?? "Conto collegato",
              type: "Conto corrente",
              mode: "new" as const,
            }
          : {
              externalAccountId: account.externalAccountId,
              name: account.details.name ?? "Conto collegato",
              type: "Conto corrente",
              mode: "existing" as const,
              existingAccountId: target,
            };
      });

    if (selections.length === 0) {
      setError("Seleziona almeno un conto da importare");
      return;
    }

    finalize.mutate(
      { selections },
      {
        onSuccess: () => router.push("/conti"),
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Caricamento conti trovati…</p>;
  if (isError || !data) {
    return <p className="p-6 text-sm text-destructive">Impossibile caricare i conti trovati.</p>;
  }
  if (data.externalAccounts.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        La banca non ha condiviso nessun conto. Riprova il collegamento se pensi sia un errore.
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="font-heading text-2xl font-medium text-foreground">Conti trovati</h1>
      <p className="text-sm text-muted-foreground">
        Seleziona quali conti importare. Puoi crearne di nuovi o ricollegarli a un conto già esistente.
      </p>

      <div className="flex flex-col gap-3">
        {data.externalAccounts.map((account) => (
          <div key={account.externalAccountId} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Checkbox
              checked={selected[account.externalAccountId] ?? false}
              onCheckedChange={(checked) =>
                setSelected((prev) => ({ ...prev, [account.externalAccountId]: checked === true }))
              }
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {account.details.name ?? account.details.iban ?? account.externalAccountId}
              </p>
              {account.details.iban && <p className="text-xs text-muted-foreground">{account.details.iban}</p>}
            </div>
            <Select
              value={targets[account.externalAccountId] ?? NEW_ACCOUNT_VALUE}
              onValueChange={(value) =>
                setTargets((prev) => ({ ...prev, [account.externalAccountId]: value as string }))
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_ACCOUNT_VALUE}>Crea nuovo conto</SelectItem>
                {data.existingAutoAccounts.map((existing) => (
                  <SelectItem key={existing.id} value={existing.id}>
                    Ricollega a &quot;{existing.name}&quot;
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <Button onClick={handleConfirm} disabled={finalize.isPending}>
        Conferma
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Verificare il type-check**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 4: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add "components/ui/checkbox.tsx" "app/(app)/conti/collega"
git commit -m "feat: add bank account selection page after GoCardless consent"
```

---

### Task 15: UI — badge "Riconnetti" e wiring nella pagina Conti

**Files:**
- Modify: `components/domain/accounts/account-row.tsx`
- Modify: `app/(app)/conti/page.tsx`

**Interfaces:**
- Consumes: `useBankConnectionsStatusQuery` (Task 12), `AddAccountForm` con prop `mode` (Task 13).
- Produces: `AccountRowProps` guadagna `needsReconnect`/`onReconnect`.

- [ ] **Step 1: Aggiungere le prop a `AccountRowProps` in `account-row.tsx`**

```ts
export interface AccountRowProps {
  account: Account;
  /** Valuta dell'utente (ISO 4217), usata per formattare il saldo. */
  currency: string;
  /** True se il consenso bancario collegato a questo conto è scaduto/in errore. */
  needsReconnect?: boolean;
  /** Chiamato quando l'utente clicca "Riconnetti". */
  onReconnect?: () => void;
}

export function AccountRow({ account, currency, needsReconnect, onReconnect }: AccountRowProps) {
```

- [ ] **Step 2: Aggiungere il bottone "Riconnetti" accanto al Badge**

Nel JSX, subito dopo la riga del `<Badge>`:

```tsx
      <Badge variant={isAuto ? "secondary" : "outline"}>{isAuto ? "Auto" : "Manuale"}</Badge>

      {needsReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className="shrink-0 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
        >
          Riconnetti
        </button>
      )}
```

- [ ] **Step 3: Verificare il type-check**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 4: Wiring in `app/(app)/conti/page.tsx`**

Sostituisci il contenuto del file con:

```tsx
"use client";

/** Pagina Conti: orchestra fetch, KPI, lista conti e form di creazione. Nessuna logica di business qui. */

import * as React from "react";
import { AccountsKpi, AccountRow, AddAccountForm } from "@/components/domain/accounts";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useBankConnectionsStatusQuery } from "@/lib/queries/gocardless";

export default function ContiPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: accounts, isLoading, isError, refetch } = useAccountsQuery();
  const { data: connectionStatuses } = useBankConnectionsStatusQuery();
  const [reconnectTrigger, setReconnectTrigger] = React.useState(0);

  const reconnectAccountIds = new Set(
    (connectionStatuses ?? [])
      .filter((status) => status.status === "expired" || status.status === "error")
      .map((status) => status.accountId)
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-medium text-foreground">Conti</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare i conti.{" "}
          <button onClick={() => refetch()} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : (
        <AccountsKpi accounts={accounts ?? []} currency={currency} />
      )}

      <Card className="p-0">
        {!isLoading && !isError && (accounts ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nessun conto ancora. Aggiungine uno dal form qui sotto.
          </p>
        ) : (
          !isLoading &&
          !isError &&
          (accounts ?? []).map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              currency={currency}
              needsReconnect={reconnectAccountIds.has(account.id)}
              onReconnect={() => setReconnectTrigger((n) => n + 1)}
            />
          ))
        )}
        <AddAccountForm
          key={reconnectTrigger}
          currency={currency}
          mode={reconnectTrigger > 0 ? "collega-banca" : undefined}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Verificare il type-check completo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add components/domain/accounts/account-row.tsx "app/(app)/conti/page.tsx"
git commit -m "feat: surface reconnect badge for expired bank connections"
```

---

### Task 16: Verifica end-to-end manuale (sandbox GoCardless)

**Files:** nessuno (solo verifica).

**Interfaces:**
- Consumes: l'intera feature (Task 1-15).

- [ ] **Step 1: Preparare l'ambiente**

Assicurati che in `.env.local` siano valorizzate `GOCARDLESS_SECRET_ID`/`GOCARDLESS_SECRET_KEY` (credenziali sandbox create su bankaccountdata.gocardless.com) e `REDIS_URL` (es. `docker run -p 6379:6379 redis` in locale).

Run: `pnpm dev`

- [ ] **Step 2: Collegare un conto sandbox**

Nel browser: Conti → "+ Aggiungi conto" → "Collega banca" → paese "Regno Unito" (o quello dove è disponibile l'istituto sandbox) → cerca e seleziona l'istituto di test **"Sandbox Finance"** → completa il consenso finto → verifica di atterrare sulla pagina "Conti trovati" con almeno un conto elencato.

- [ ] **Step 3: Finalizzare e verificare l'import**

Seleziona il conto, "Crea nuovo conto" → Conferma → verifica il redirect a `/conti`, il nuovo conto con badge "Auto", saldo popolato e transazioni di esempio nella lista.

- [ ] **Step 4: Verificare il sync manuale**

In una shell separata con le stesse env var caricate, esegui `pnpm exec tsx -e "import('./lib/gocardless/scheduler').then(m => m.runDueSyncs())"` — non dovrebbe fare nulla (il conto appena sincronizzato non è ancora "dovuto", `nextSyncEligibleAt` è tra 12h). Verifica manualmente in DB che la riga `bank_account_links` abbia `last_synced_at` valorizzato.

- [ ] **Step 5: Verificare la scadenza del consenso**

In DB, aggiorna manualmente `bank_connections.status` a `'expired'` per la connessione appena creata. Ricarica `/conti`: verifica che compaia il badge "Riconnetti" sul conto e che cliccandolo si apra il tab "Collega banca" del form.

Nessun commit per questo task (solo verifica).
