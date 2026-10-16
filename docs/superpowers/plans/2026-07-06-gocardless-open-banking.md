# Open Banking via GoCardless Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link real bank accounts via the GoCardless Bank Account Data API (PSD2 consent, balance/transaction import, automatic sync every 12h), integrated into the existing Conti (Accounts) screen.

**Architecture:** New `bank_connections`/`bank_account_links`/`gocardless_token` tables next to the existing data model (`accounts`/`transactions` unchanged except for an `externalId` column for idempotency). A thin HTTP client for the GoCardless API, a sync engine that updates balance/transactions while respecting rate limits (counted in Redis), an in-process `node-cron` scheduler started from `instrumentation.ts`. The user flow reuses the existing "+ Aggiungi conto" ("Add account") form with a new "Collega banca" ("Connect bank") option.

**Tech Stack:** Next.js Route Handlers, Drizzle ORM/Postgres, `ioredis`, `node-cron`, TanStack Query, Zod, Vitest (integration tests on a real DB, mocks on `fetch`/GoCardless modules — no jsdom/component test environment in the project).

## Global Constraints

- Package manager: **pnpm**.
- **The agent NEVER runs git commands in this repo.** Every commit step must be presented as the exact command the user runs themselves, asking for confirmation before moving on to the next task.
- Reference spec: `docs/superpowers/specs/2026-07-06-gocardless-open-banking-design.md` — every deviation from this spec must be flagged explicitly in the task where it happens (e.g. Task 2: `requisitionId` nullable, not `NOT NULL` as implied in the spec, to handle the `pending` state before the requisition exists).
- **Versioned** migrations (`pnpm db:generate` + `pnpm db:migrate`), never `db:push`, consistent with the rest of the project.
- Barrel file (`index.ts`) only for components used from outside the folder — `ConnectBankFlow` stays internal to `components/domain/accounts/` (used only by `add-account-form.tsx` in the same folder), no barrel entry for it.
- No hardcoded colors/radii in components — only Tailwind classes on the tokens already defined in `app/globals.css`.
- Minimal JSDoc (one `/** ... */` line) on every new public function/component, in Italian, per project convention.
- User-visible strings in Italian.
- Tests: existing pattern in `lib/db/integration.test.ts` and `app/api/accounts/route.test.ts` — real Postgres DB (never mocked), `vi.mock("@/lib/auth", ...)` for the session, GoCardless/Redis modules mocked with `vi.mock(..., async (importOriginal) => ...)` to preserve the real types/classes (e.g. `GoCardlessError`). No React component tests (no jsdom infrastructure in the project) — UI tasks are verified with `pnpm exec tsc --noEmit` + a final manual check (Task 16).
- GoCardless rate limit: sync interval **12 hours**, initial history **everything available** (the institution's `transaction_total_days`), country scope **all those supported by GoCardless**.

---

## File Structure

- `lib/db/schema/bank-connections.ts` (new) — `bank_connections`, `bank_account_links`, `gocardless_token` tables.
- `lib/db/schema/transactions.ts` (modify) — `externalId` column + unique constraint `(accountId, externalId)`.
- `lib/db/schema/categories.ts` (modify) — adds `"Da categorizzare"` ("To categorise") to `DEFAULT_CATEGORIES`.
- `lib/db/schema/index.ts` (modify) — exports the new schema file.
- `lib/redis/client.ts` (new) — shared `ioredis` client.
- `lib/gocardless/rate-limit.ts` (new) — pure rate limit logic, injectable store (testable without a real Redis).
- `lib/gocardless/redis-rate-limit-store.ts` (new) — Redis adapter of the `RateLimitStore` interface.
- `lib/gocardless/client.ts` (new) — GoCardless HTTP client (token cache, institutions, agreement/requisition, account details/balances/transactions).
- `lib/gocardless/categorize.ts` (new) — category matching + fallback category.
- `lib/gocardless/sync.ts` (new) — `syncAccountLink`, the sync engine for a single linked account.
- `lib/gocardless/scheduler.ts` (new) — `findDueLinks`/`runDueSyncs`/`startGoCardlessScheduler` (cron every 12h).
- `instrumentation.ts` (new, root) — Next.js boot hook that starts the scheduler.
- `lib/validation/gocardless.ts` (new) — Zod schemas for connection creation and selection finalization.
- `lib/queries/gocardless.ts` (new) — client-side TanStack Query hooks.
- `app/api/gocardless/institutions/route.ts` (new) — GET list of institutions per country.
- `app/api/gocardless/connections/route.ts` (new) — POST creates connection+requisition, GET connection status for the "Riconnetti" ("Reconnect") badge.
- `app/api/gocardless/callback/route.ts` (new) — return redirect from the bank consent.
- `app/api/gocardless/connections/[id]/accounts/route.ts` (new) — GET external accounts found after consent.
- `app/api/gocardless/connections/[id]/finalize/route.ts` (new) — POST creates/relinks the selected accounts and launches the initial sync.
- `components/domain/accounts/connect-bank-flow.tsx` (new) — country/institution selection UI + consent redirect.
- `components/domain/accounts/add-account-form.tsx` (modify) — adds the "Manuale"/"Collega banca" ("Manual"/"Connect bank") switch.
- `components/domain/accounts/account-row.tsx` (modify) — "Riconnetti" badge/button.
- `app/(app)/conti/collega/[connectionId]/page.tsx` (new) — post-consent external account selection page.
- `app/(app)/conti/page.tsx` (modify) — fetches connection status, passes `needsReconnect`/`onReconnect` to the rows.
- `.env.local.example` (modify) — new GoCardless/Redis variables.
- `package.json` (modify) — `ioredis`, `node-cron`, `@types/node-cron` dependencies.

---

### Task 1: Dependencies and environment variables

**Files:**
- Modify: `package.json`
- Modify: `.env.local.example`

**Interfaces:**
- Produces: `ioredis`, `node-cron` available to all later tasks; `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`, `REDIS_URL` as variables expected by `lib/gocardless/client.ts` (Task 4) and `lib/redis/client.ts` (Task 3).

- [ ] **Step 1: Install the dependencies**

Run: `pnpm add ioredis node-cron`
Run: `pnpm add -D @types/node-cron`

Expected: both commands finish without errors; `package.json` shows `ioredis` and `node-cron` in `dependencies`, `@types/node-cron` in `devDependencies`.

- [ ] **Step 2: Add the environment variables to `.env.local.example`**

Add at the end of the file:

```
# GoCardless Bank Account Data (Open Banking) — https://bankaccountdata.gocardless.com
# Sandbox credentials to create at https://bankaccountdata.gocardless.com/
GOCARDLESS_SECRET_ID=<secret-id-sandbox>
GOCARDLESS_SECRET_KEY=<secret-key-sandbox>

# Redis — rate limiting of the GoCardless sync (e.g. `docker run -p 6379:6379 redis`)
REDIS_URL=redis://localhost:6379
```

- [ ] **Step 3: Copy into the local `.env.local` and verify the type-check**

Copy the new lines into your `.env.local` too (not committed) with real values or placeholders for now.

Run: `pnpm exec tsc --noEmit`
Expected: no errors (no application code yet, only config).

- [ ] **Step 4: Commit (manual — the agent does not run git in this repo)**

```bash
git add package.json pnpm-lock.yaml .env.local.example
git commit -m "chore: add ioredis and node-cron dependencies for GoCardless sync"
```

---

### Task 2: DB schema — bank connections, account links, token cache, fallback category

**Files:**
- Create: `lib/db/schema/bank-connections.ts`
- Modify: `lib/db/schema/transactions.ts`
- Modify: `lib/db/schema/categories.ts`
- Modify: `lib/db/schema/index.ts`
- Create: `lib/db/bank-connections.integration.test.ts`

**Interfaces:**
- Consumes: `authUser` (`lib/db/schema/auth.ts`), `accounts` (`lib/db/schema/accounts.ts`).
- Produces: `bankConnections`, `bankAccountLinks`, `gocardlessToken` tables and their types (`BankConnection`, `BankAccountLink`, `GoCardlessToken`), used by Task 4 (client), Task 6 (sync), Task 7 (scheduler), Tasks 9-11 (API routes). `transactions.externalId` used by Task 6. `FALLBACK_CATEGORY_NAME = "Da categorizzare"` defined in Task 5, seeded here only in `DEFAULT_CATEGORIES` for new users (existing users get it lazily via `getFallbackCategoryId`, Task 5).

- [ ] **Step 1: Create `lib/db/schema/bank-connections.ts`**

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
  // Nullable: starts null when the connection is "pending" (created before
  // GoCardless has even been called), filled in right after by the same request.
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

/** Single row: cache of the GoCardless application access token (not per user). */
export const gocardlessToken = pgTable("gocardless_token", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type GoCardlessToken = typeof gocardlessToken.$inferSelect;
```

- [ ] **Step 2: Add `externalId` to `lib/db/schema/transactions.ts`**

Change the import at the top of the file:

```ts
import { date, index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
```

In the body of `pgTable`, after `source`, add:

```ts
    // Transaction id on the GoCardless side — nullable (manual transactions do not have one),
    // used for idempotency of periodic syncs (no duplicates on every cron run).
    externalId: text("external_id"),
```

And update the array in the third argument:

```ts
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.date),
    unique("transactions_account_external_id_unique").on(table.accountId, table.externalId),
  ]
```

- [ ] **Step 3: Add the fallback category to `lib/db/schema/categories.ts`**

In the `DEFAULT_CATEGORIES` array, add as the last element:

```ts
  { name: "Da categorizzare", type: "variabile" },
```

- [ ] **Step 4: Export the new schema from the barrel**

In `lib/db/schema/index.ts`, add:

```ts
export * from "./bank-connections";
```

- [ ] **Step 5: Generate and apply the migration**

Run: `pnpm db:generate`
Expected: new SQL file under `lib/db/migrations/` with `CREATE TYPE bank_connection_status`, `CREATE TABLE bank_connections`, `CREATE TABLE bank_account_links`, `CREATE TABLE gocardless_token`, `ALTER TABLE transactions ADD COLUMN external_id` + the unique constraint.

Run: `pnpm db:migrate`
Expected: confirmation of the applied tables, no errors.

- [ ] **Step 6: Write the integration test**

Create `lib/db/bank-connections.integration.test.ts`:

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

- [ ] **Step 7: Run the tests**

Run: `pnpm test lib/db/bank-connections.integration.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 8: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/db/schema lib/db/migrations lib/db/bank-connections.integration.test.ts
git commit -m "feat: add bank_connections/bank_account_links schema and fallback category"
```

---

### Task 3: Redis client and rate limit logic

**Files:**
- Create: `lib/redis/client.ts`
- Create: `lib/gocardless/rate-limit.ts`
- Create: `lib/gocardless/redis-rate-limit-store.ts`
- Test: `lib/gocardless/rate-limit.test.ts`

**Interfaces:**
- Produces: `RateLimitStore` interface, `recordRateLimit()`, `isRateLimited()` (used by Task 6), `redisRateLimitStore` (Task 7 scheduler, Task 11 finalize route).

- [ ] **Step 1: Write the test (with a fake in-memory store, no real Redis)**

Create `lib/gocardless/rate-limit.test.ts`:

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

- [ ] **Step 2: Run the test and verify that it fails**

Run: `pnpm test lib/gocardless/rate-limit.test.ts`
Expected: FAIL, `Cannot find module './rate-limit'`.

- [ ] **Step 3: Implement `lib/gocardless/rate-limit.ts`**

```ts
/** Minimal store the rate limit logic runs on — Redis in production, a Map in tests. */
export interface RateLimitStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

function rateLimitKey(externalAccountId: string, endpoint: string): string {
  return `gocardless:ratelimit:${endpoint}:${externalAccountId}`;
}

/** Saves the remaining calls for an account/endpoint, read from the GoCardless response headers. */
export async function recordRateLimit(
  store: RateLimitStore,
  externalAccountId: string,
  endpoint: string,
  remaining: number,
  resetSeconds: number
): Promise<void> {
  await store.set(rateLimitKey(externalAccountId, endpoint), String(remaining), Math.max(1, resetSeconds));
}

/** True if no calls remain for that account/endpoint; no recorded entry = go ahead. */
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

- [ ] **Step 4: Run the test again**

Run: `pnpm test lib/gocardless/rate-limit.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Create the Redis client and the adapter**

Create `lib/redis/client.ts`:

```ts
import "server-only";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL non è definita. Copia .env.local.example in .env.local.");
}

export const redis = new Redis(redisUrl);
```

Create `lib/gocardless/redis-rate-limit-store.ts`:

```ts
import "server-only";
import { redis } from "@/lib/redis/client";
import type { RateLimitStore } from "./rate-limit";

/** Redis adapter of `RateLimitStore`, used by the scheduler and by the initial post-linking sync. */
export const redisRateLimitStore: RateLimitStore = {
  async get(key) {
    return redis.get(key);
  },
  async set(key, value, ttlSeconds) {
    await redis.set(key, value, "EX", Math.max(1, Math.floor(ttlSeconds)));
  },
};
```

- [ ] **Step 6: Verify the type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/redis lib/gocardless/rate-limit.ts lib/gocardless/rate-limit.test.ts lib/gocardless/redis-rate-limit-store.ts
git commit -m "feat: add Redis-backed rate limit tracking for GoCardless sync"
```

---

### Task 4: GoCardless HTTP client

**Files:**
- Create: `lib/gocardless/client.ts`
- Test: `lib/gocardless/client.test.ts`

**Interfaces:**
- Consumes: `gocardlessToken` (Task 2), `GOCARDLESS_SECRET_ID`/`GOCARDLESS_SECRET_KEY` (Task 1).
- Produces: `GoCardlessError`, `getAccessToken()`, `listInstitutions()`, `createRequisition()`, `getRequisition()`, `getAccountDetails()`, `getAccountBalances()`, `getAccountTransactions()`, types `Institution`/`Requisition`/`AccountDetails`/`Balance`/`BankTransaction`/`RateLimitInfo` — used by Task 6 (sync), Tasks 9-11 (API routes).

- [ ] **Step 1: Write the test (global fetch mocked, real DB for the token cache)**

Create `lib/gocardless/client.test.ts`:

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

- [ ] **Step 2: Run the test and verify that it fails**

Run: `pnpm test lib/gocardless/client.test.ts`
Expected: FAIL, `Cannot find module './client'`.

- [ ] **Step 3: Implement `lib/gocardless/client.ts`**

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

/** Returns a valid access token, reusing the DB cache or regenerating it if expired/missing. */
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

/** Lists the GoCardless bank institutions available in a country (ISO 3166-1 alpha-2 code). */
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

/** Creates an End User Agreement (history = everything available) + a Requisition; returns the consent link. */
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

/** Updated status of a requisition (`accounts` is populated only after the user's consent). */
export async function getRequisition(requisitionId: string): Promise<Requisition> {
  const { data } = await request<Requisition>(`/requisitions/${requisitionId}/`);
  return data;
}

export interface AccountDetails {
  iban?: string;
  name?: string;
  product?: string;
}

/** Identifying details of an external account (name/IBAN), used in the selection UI. */
export async function getAccountDetails(externalAccountId: string): Promise<AccountDetails> {
  const { data } = await request<{ account: AccountDetails }>(`/accounts/${externalAccountId}/details/`);
  return data.account;
}

export interface Balance {
  balanceAmount: { amount: string; currency: string };
  balanceType: string;
}

/** Balance of an external account: prefers "interimAvailable", otherwise the first available. */
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

/** "Booked" transactions of an external account ("pending" ones are not imported, to avoid duplicates at booking). */
export async function getAccountTransactions(
  externalAccountId: string
): Promise<{ transactions: BankTransaction[]; rateLimit: RateLimitInfo | null }> {
  const { data, rateLimit } = await request<{
    transactions: { booked: BankTransaction[]; pending: BankTransaction[] };
  }>(`/accounts/${externalAccountId}/transactions/`);
  return { transactions: data.transactions.booked, rateLimit };
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm test lib/gocardless/client.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/gocardless/client.ts lib/gocardless/client.test.ts
git commit -m "feat: add GoCardless Bank Account Data HTTP client"
```

---

### Task 5: Best-effort categorization of imported transactions

**Files:**
- Create: `lib/gocardless/categorize.ts`
- Test: `lib/gocardless/categorize.test.ts`

**Interfaces:**
- Consumes: `categories`, `transactions` (Task 2).
- Produces: `FALLBACK_CATEGORY_NAME`, `getFallbackCategoryId()`, `resolveCategoryId()` — used by Task 6 (sync).

- [ ] **Step 1: Write the test**

Create `lib/gocardless/categorize.test.ts`:

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

- [ ] **Step 2: Run the test and verify that it fails**

Run: `pnpm test lib/gocardless/categorize.test.ts`
Expected: FAIL, `Cannot find module './categorize'`.

- [ ] **Step 3: Implement `lib/gocardless/categorize.ts`**

```ts
import { and, desc, eq, ilike, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";

export const FALLBACK_CATEGORY_NAME = "Da categorizzare";

/** Id of the user's fallback category, created on the fly if it does not exist yet. */
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

/** Category of the latest transaction with the same description (case-insensitive), if already categorized. */
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

/** Category to assign to an imported transaction: match on an existing description, otherwise fallback. */
export async function resolveCategoryId(userId: string, description: string): Promise<string> {
  const fallbackId = await getFallbackCategoryId(userId);
  const matched = await matchCategoryId(userId, description, fallbackId);
  return matched ?? fallbackId;
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm test lib/gocardless/categorize.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/gocardless/categorize.ts lib/gocardless/categorize.test.ts
git commit -m "feat: add best-effort category matching for imported transactions"
```

---

### Task 6: Sync engine for a linked account

**Files:**
- Create: `lib/gocardless/sync.ts`
- Test: `lib/gocardless/sync.test.ts`

**Interfaces:**
- Consumes: `getAccountBalances`/`getAccountTransactions`/`GoCardlessError` (Task 4), `isRateLimited`/`recordRateLimit`/`RateLimitStore` (Task 3), `resolveCategoryId` (Task 5), `bankAccountLinks`/`bankConnections` (Task 2).
- Produces: `syncAccountLink(link, rateLimitStore)`, type `SyncableLink` — used by Task 7 (scheduler), Task 11 (finalize).

- [ ] **Step 1: Write the test (partial mock of the GoCardless client, in-memory rate limit store, real DB)**

Create `lib/gocardless/sync.test.ts`:

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

- [ ] **Step 2: Run the test and verify that it fails**

Run: `pnpm test lib/gocardless/sync.test.ts`
Expected: FAIL, `Cannot find module './sync'`.

- [ ] **Step 3: Implement `lib/gocardless/sync.ts`**

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

/** Syncs balance and transactions of a linked account; updates the timestamps or marks the connection as expired. */
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

- [ ] **Step 4: Run the test again**

Run: `pnpm test lib/gocardless/sync.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/gocardless/sync.ts lib/gocardless/sync.test.ts
git commit -m "feat: add GoCardless sync engine with idempotent transaction import"
```

---

### Task 7: Cron scheduler (every 12h) and Next.js boot

**Files:**
- Create: `lib/gocardless/scheduler.ts`
- Create: `instrumentation.ts`
- Test: `lib/gocardless/scheduler.test.ts`

**Interfaces:**
- Consumes: `syncAccountLink`/`SyncableLink` (Task 6), `redisRateLimitStore` (Task 3).
- Produces: `findDueLinks()`, `runDueSyncs()`, `startGoCardlessScheduler()`.

- [ ] **Step 1: Write the test (real DB for `findDueLinks`, `syncAccountLink` mocked for `runDueSyncs`)**

Create `lib/gocardless/scheduler.test.ts`:

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

- [ ] **Step 2: Run the test and verify that it fails**

Run: `pnpm test lib/gocardless/scheduler.test.ts`
Expected: FAIL, `Cannot find module './scheduler'`.

- [ ] **Step 3: Implement `lib/gocardless/scheduler.ts`**

```ts
import cron from "node-cron";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "./redis-rate-limit-store";
import { syncAccountLink, type SyncableLink } from "./sync";

/** Linked accounts whose sync is due and whose connection is still valid (not expired/error). */
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
 * Syncs all due accounts. An error on one account (network, GoCardless 5xx)
 * is logged and must not block the sync of the other accounts in the same tick.
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

/** Starts the cron scheduler (every 12h); no-op if already started in the current process. */
export function startGoCardlessScheduler(): void {
  if (started) return;
  started = true;
  cron.schedule("0 */12 * * *", () => {
    runDueSyncs().catch((error) => console.error("Sync GoCardless fallito", error));
  });
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm test lib/gocardless/scheduler.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Create `instrumentation.ts` (Next.js boot)**

Create `instrumentation.ts` in the project root (same level as `package.json`):

```ts
/** Next.js boot hook: starts the GoCardless sync scheduler in the Node.js runtime. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startGoCardlessScheduler } = await import("@/lib/gocardless/scheduler");
    startGoCardlessScheduler();
  }
}
```

- [ ] **Step 6: Verify the type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/gocardless/scheduler.ts lib/gocardless/scheduler.test.ts instrumentation.ts
git commit -m "feat: schedule GoCardless sync every 12 hours via instrumentation hook"
```

---

### Task 8: Zod validation schemas

**Files:**
- Create: `lib/validation/gocardless.ts`

**Interfaces:**
- Produces: `createConnectionSchema`/`CreateConnectionInput`, `finalizeSelectionSchema`/`FinalizeSelectionInput` — used by Tasks 9 and 11 (API routes) and Task 12 (query hooks).

- [ ] **Step 1: Implement `lib/validation/gocardless.ts`**

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

- [ ] **Step 2: Verify the type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/validation/gocardless.ts
git commit -m "feat: add validation schemas for GoCardless connection flow"
```

---

### Task 9: API routes — institutions and connections

**Files:**
- Create: `app/api/gocardless/institutions/route.ts`
- Create: `app/api/gocardless/connections/route.ts`
- Test: `app/api/gocardless/connections/route.test.ts`

**Interfaces:**
- Consumes: `listInstitutions`/`createRequisition` (Task 4), `createConnectionSchema` (Task 8), `bankConnections`/`bankAccountLinks` (Task 2).
- Produces: `GET /api/gocardless/institutions?country=`, `POST /api/gocardless/connections` (`{ link: string }`), `GET /api/gocardless/connections` (`{ accountId, status }[]`) — used by Task 12 (query hooks).

- [ ] **Step 1: Implement `app/api/gocardless/institutions/route.ts`**

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

- [ ] **Step 2: Write the test for `connections/route.ts`**

Create `app/api/gocardless/connections/route.test.ts`:

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

- [ ] **Step 3: Run the test and verify that it fails**

Run: `pnpm test app/api/gocardless/connections/route.test.ts`
Expected: FAIL, `Cannot find module './route'`.

- [ ] **Step 4: Implement `app/api/gocardless/connections/route.ts`**

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

- [ ] **Step 5: Run the test again**

Run: `pnpm test app/api/gocardless/connections/route.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 6: Verify the full type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit (manual — the agent does not run git in this repo)**

```bash
git add app/api/gocardless/institutions app/api/gocardless/connections/route.ts app/api/gocardless/connections/route.test.ts
git commit -m "feat: add institutions listing and connection creation API routes"
```

---

### Task 10: API route — return callback from consent

**Files:**
- Create: `app/api/gocardless/callback/route.ts`
- Test: `app/api/gocardless/callback/route.test.ts`

**Interfaces:**
- Consumes: `getRequisition` (Task 4), `bankConnections` (Task 2).
- Produces: `GET /api/gocardless/callback?ref=` → 302 redirect to `/conti/collega/{id}` (success) or `/conti?bankError=...` (error).

- [ ] **Step 1: Write the test**

Create `app/api/gocardless/callback/route.test.ts`:

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

- [ ] **Step 2: Run the test and verify that it fails**

Run: `pnpm test app/api/gocardless/callback/route.test.ts`
Expected: FAIL, `Cannot find module './route'`.

- [ ] **Step 3: Implement `app/api/gocardless/callback/route.ts`**

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

- [ ] **Step 4: Run the test again**

Run: `pnpm test app/api/gocardless/callback/route.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit (manual — the agent does not run git in this repo)**

```bash
git add app/api/gocardless/callback
git commit -m "feat: add GoCardless consent callback route"
```

---

### Task 11: API routes — external accounts found and selection finalization

**Files:**
- Create: `app/api/gocardless/connections/[id]/accounts/route.ts`
- Create: `app/api/gocardless/connections/[id]/finalize/route.ts`
- Test: `app/api/gocardless/connections/[id]/finalize/route.test.ts`

**Interfaces:**
- Consumes: `getRequisition`/`getAccountDetails` (Task 4), `finalizeSelectionSchema` (Task 8), `syncAccountLink` (Task 6), `redisRateLimitStore` (Task 3), `accounts`/`bankAccountLinks`/`bankConnections` (Task 2).
- Produces: `GET .../accounts` → `{ externalAccounts, existingAutoAccounts }`, `POST .../finalize` → `201` — used by Task 12 (query hooks), Task 14 (selection page).

- [ ] **Step 1: Implement `app/api/gocardless/connections/[id]/accounts/route.ts`**

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

- [ ] **Step 2: Write the test for finalization**

Create `app/api/gocardless/connections/[id]/finalize/route.test.ts`:

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

- [ ] **Step 3: Run the test and verify that it fails**

Run: `pnpm test app/api/gocardless/connections/[id]/finalize/route.test.ts`
Expected: FAIL, `Cannot find module './route'`.

- [ ] **Step 4: Implement `app/api/gocardless/connections/[id]/finalize/route.ts`**

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

- [ ] **Step 5: Run the test again**

Run: `pnpm test app/api/gocardless/connections/[id]/finalize/route.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 6: Verify the full type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit (manual — the agent does not run git in this repo)**

```bash
git add "app/api/gocardless/connections/[id]"
git commit -m "feat: add external accounts listing and finalize connection routes"
```

---

### Task 12: Client-side TanStack Query hooks

**Files:**
- Create: `lib/queries/gocardless.ts`

**Interfaces:**
- Consumes: `CreateConnectionInput`/`FinalizeSelectionInput` (Task 8), the routes from Tasks 9-11.
- Produces: `useInstitutionsQuery`, `useBankConnectionsStatusQuery`, `useCreateConnectionMutation`, `useConnectionAccountsQuery`, `useFinalizeConnectionMutation`, types `Institution`/`BankConnectionStatus`/`ExternalAccount`/`ConnectionAccountsResponse` — used by Tasks 13 and 14.

- [ ] **Step 1: Implement `lib/queries/gocardless.ts`**

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

/** Lists the GoCardless bank institutions available in a country. */
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

/** Status of the user's bank connections, for the "Riconnetti" badges. */
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

/** Creates a GoCardless connection and returns the consent link to redirect to. */
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

/** External accounts found after consent, for the selection page. */
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

/** Finalizes the selection of accounts to import/relink. */
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

- [ ] **Step 2: Verify the type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/queries/gocardless.ts
git commit -m "feat: add TanStack Query hooks for GoCardless connection flow"
```

---

### Task 13: UI — "Collega banca" in the Aggiungi conto form

**Files:**
- Create: `components/domain/accounts/connect-bank-flow.tsx`
- Modify: `components/domain/accounts/add-account-form.tsx`

**Interfaces:**
- Consumes: `useInstitutionsQuery`, `useCreateConnectionMutation` (Task 12).
- Produces: `<ConnectBankFlow />`; `AddAccountForm` gains the optional `mode` prop (used by Task 15 to force opening on the "Collega banca" tab from the "Riconnetti" button).

- [ ] **Step 1: Create `components/domain/accounts/connect-bank-flow.tsx`**

```tsx
"use client";

/** "Collega banca" flow: country selection, institution search, redirect to the GoCardless consent. */

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

- [ ] **Step 2: Add the "Manuale"/"Collega banca" switch in `add-account-form.tsx`**

Add the import at the top of the file, below the other imports from `./`:

```ts
import { ConnectBankFlow } from "./connect-bank-flow";
```

Update the interface and the component signature:

```ts
export interface AddAccountFormProps {
  /** User's currency (ISO 4217), used for CurrencyInput. */
  currency: string;
  /** Forces the initial tab (used by the "Riconnetti" button in AccountRow); defaults to "manuale". */
  mode?: "manuale" | "collega-banca";
}

export function AddAccountForm({ currency, mode: modeProp }: AddAccountFormProps) {
  const [mode, setMode] = React.useState<"manuale" | "collega-banca">(modeProp ?? "manuale");
  React.useEffect(() => {
    if (modeProp) setMode(modeProp);
  }, [modeProp]);

  const createMutation = useCreateAccountMutation();
```

Right before the final `return (` of the manual form, wrap everything in a fragment with the tab switch. Replace the current:

```tsx
  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
```

with:

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

And at the end of the file, close the added tags — replace the last:

```tsx
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
```

with:

```tsx
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </form>
      )}
    </div>
  );
}
```

(note: the content of the manual form stays identical, only indented one more level inside the new `<form>`/`{mode === "manuale" && (...)}`).

- [ ] **Step 3: Verify the type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Update the barrel**

`components/domain/accounts/index.ts` does not change — `ConnectBankFlow` stays internal, used only by `add-account-form.tsx` in the same folder (see Global Constraints).

- [ ] **Step 5: Commit (manual — the agent does not run git in this repo)**

```bash
git add components/domain/accounts/connect-bank-flow.tsx components/domain/accounts/add-account-form.tsx
git commit -m "feat: add bank connection flow to the add account form"
```

---

### Task 14: UI — post-consent external account selection page

**Files:**
- Create: `components/ui/checkbox.tsx` (via shadcn)
- Create: `components/ui/checkbox.tsx` (via shadcn)

**Interfaces:**
- Consumes: `useConnectionAccountsQuery`, `useFinalizeConnectionMutation` (Task 12), `FinalizeSelectionInput` (Task 8).
- Produces: page `/conti/collega/[connectionId]`, reached from the Task 10 redirect.

- [ ] **Step 1: Add the shadcn Checkbox component**

Run: `pnpm dlx shadcn@latest add checkbox`
Expected: creates `components/ui/checkbox.tsx`, no errors.

- [ ] **Step 2: Create `app/(app)/conti/collega/[connectionId]/page.tsx`**

```tsx
"use client";

/** Selection page for the accounts found after the GoCardless consent: creates new accounts or relinks an existing one. */

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

- [ ] **Step 3: Verify the type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit (manual — the agent does not run git in this repo)**

```bash
git add "components/ui/checkbox.tsx" "app/(app)/conti/collega"
git commit -m "feat: add bank account selection page after GoCardless consent"
```

---

### Task 15: UI — "Riconnetti" badge and wiring in the Conti page

**Files:**
- Modify: `components/domain/accounts/account-row.tsx`
- Modify: `app/(app)/conti/page.tsx`

**Interfaces:**
- Consumes: `useBankConnectionsStatusQuery` (Task 12), `AddAccountForm` with the `mode` prop (Task 13).
- Produces: `AccountRowProps` gains `needsReconnect`/`onReconnect`.

- [ ] **Step 1: Add the props to `AccountRowProps` in `account-row.tsx`**

```ts
export interface AccountRowProps {
  account: Account;
  /** User's currency (ISO 4217), used to format the balance. */
  currency: string;
  /** True if the bank consent linked to this account has expired/errored. */
  needsReconnect?: boolean;
  /** Called when the user clicks "Riconnetti". */
  onReconnect?: () => void;
}

export function AccountRow({ account, currency, needsReconnect, onReconnect }: AccountRowProps) {
```

- [ ] **Step 2: Add the "Riconnetti" button next to the Badge**

In the JSX, right after the `<Badge>` line:

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

- [ ] **Step 3: Verify the type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Wiring in `app/(app)/conti/page.tsx`**

Replace the content of the file with:

```tsx
"use client";

/** Conti page: orchestrates fetching, KPIs, account list and creation form. No business logic here. */

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

- [ ] **Step 5: Verify the full type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit (manual — the agent does not run git in this repo)**

```bash
git add components/domain/accounts/account-row.tsx "app/(app)/conti/page.tsx"
git commit -m "feat: surface reconnect badge for expired bank connections"
```

---

### Task 16: Manual end-to-end verification (GoCardless sandbox)

**Files:** none (verification only).

**Interfaces:**
- Consumes: the whole feature (Tasks 1-15).

- [ ] **Step 1: Prepare the environment**

Make sure that `.env.local` has `GOCARDLESS_SECRET_ID`/`GOCARDLESS_SECRET_KEY` set (sandbox credentials created at bankaccountdata.gocardless.com) and `REDIS_URL` (e.g. `docker run -p 6379:6379 redis` locally).

Run: `pnpm dev`

- [ ] **Step 2: Link a sandbox account**

In the browser: Conti → "+ Aggiungi conto" → "Collega banca" → country "Regno Unito" (United Kingdom) (or wherever the sandbox institution is available) → search and select the test institution **"Sandbox Finance"** → complete the fake consent → check that you land on the "Conti trovati" ("Accounts found") page with at least one account listed.

- [ ] **Step 3: Finalize and verify the import**

Select the account, "Crea nuovo conto" ("Create new account") → Conferma (Confirm) → check the redirect to `/conti`, the new account with the "Auto" badge, populated balance and sample transactions in the list.

- [ ] **Step 4: Verify the manual sync**

In a separate shell with the same env vars loaded, run `pnpm exec tsx -e "import('./lib/gocardless/scheduler').then(m => m.runDueSyncs())"` — it should do nothing (the account that was just synced is not "due" yet, `nextSyncEligibleAt` is 12h away). Check manually in the DB that the `bank_account_links` row has `last_synced_at` set.

- [ ] **Step 5: Verify consent expiry**

In the DB, manually update `bank_connections.status` to `'expired'` for the connection just created. Reload `/conti`: check that the "Riconnetti" badge appears on the account and that clicking it opens the "Collega banca" tab of the form.

No commit for this task (verification only).
