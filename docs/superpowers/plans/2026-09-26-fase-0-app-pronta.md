# Phase 0 — App ready for the migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app deployable as a portable container (image on GHCR, health check, cron as endpoints, versioned Drizzle migrations, validated env, green CI) while staying in production on Vercel + Neon.

**Architecture:** No hosting change in this phase. We remove what ties the app to a single process (`node-cron` in `instrumentation.ts`) or to the Vercel build (inlined `NEXT_PUBLIC_APP_URL`), we add standard HTTP endpoints (`/api/health`, `/api/health/ready`, `/api/cron/*`) that Vercel Cron calls today and k8s CronJobs/probes will call tomorrow, and we rebuild a single Drizzle baseline marked as already applied on the existing DBs. GitHub Actions checks every PR against ephemeral Postgres/Redis and publishes two images (app and migrator) to GHCR on every push to `main`.

**Tech Stack:** Next.js 16 (App Router, `output: "standalone"`), Drizzle ORM/drizzle-kit, postgres.js, ioredis, Zod 4, Vitest 4, Docker multi-stage (Node 24 alpine), GitHub Actions, GHCR, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` (section "Modifiche all'applicazione (Fase 0)" (Changes to the application (Phase 0)) and row 0 of the "Fasi" (Phases) table).

## Guided runbook format

This plan mixes code and actions that **only the user** can do (Vercel dashboard, starting Docker Desktop, Neon credentials). Steps marked **👤 UTENTE** (user) must be run by the user: whoever executes the plan explains what the command does and why, waits for the user to paste the output, checks it and only then proceeds. All terminal commands in 👤 steps are for **Git Bash** (not PowerShell: `>` redirections and inline variables `VAR=x cmd` only work there), opened in the repo root.

Work happens on a dedicated branch `fase-0-app-pronta` created from `main`, brought into `main` via a Pull Request (so the first CI run happens precisely on that PR).

## Global Constraints

- No hosting change: production stays on Vercel + Neon for the whole phase; every task must leave `main` deployable on Vercel.
- Node 24 (local, CI, Docker image); pnpm `11.5.0` pinned via the `packageManager` field.
- The application code knows nothing about Kubernetes: cron and health are normal HTTP routes; config only from environment variables.
- No secrets in the Docker image or in the repo; the dummy build values exist only in the `builder` stage.
- Cron secret: `Authorization: Bearer <CRON_SECRET>` header, `CRON_SECRET` at least 32 characters long, constant-time comparison.
- Env validation error messages: only the **names** of the variables, never the values.
- From this phase on the DB schema changes only with `pnpm db:generate` + committed migration + `pnpm db:migrate`; `db:push` is removed.
- Visible text, comments and JSDoc in Italian (CLAUDE.md rule); minimal JSDoc on every public function/route.
- App container: non-root user, `HOSTNAME=0.0.0.0`, port 3000.

## Review Focus

1. **Variable missing in production after the merge** — the startup validation makes every cold start on Vercel crash if `APP_URL`/`CRON_SECRET` is missing or if `BETTER_AUTH_SECRET` is shorter than 32 characters: the whole site goes down. Covered by the pre-merge checklist of Task 8 (steps 1-3), not only by the `parseServerEnv` tests.
2. **Production `DATABASE_URL` without `sslmode=require`** — by removing the explicit `ssl` from `lib/db/client.ts` encryption depends on the URL; without the parameter Neon refuses the connection. Covered by the explicit check in Task 5 step 1 and in the Task 8 checklist.
3. **Baseline marked on a DB that does not match the schema** — future migrations would fail or silently diverge. Covered by the `pg_dump` comparison in Task 5 with a stop rule on every difference not listed.
4. **Cron invoked twice or in parallel** (Vercel Cron may retry, a human may press "Run") — the net worth snapshot uses `onConflictDoUpdate`, the GoCardless sync uses a per-account lock + eligibility budget: no duplicates. Covered by existing scheduler/snapshot tests; the new route tests only check that the route delegates.
5. **Readiness stuck with Redis unreachable** — ioredis queues commands and retries for a long time: without a timeout the probe would hang and k8s would count it as failed only after its own timeout. Covered by the "probe that does not respond → error within the timeout" test in Task 3.

---

### Task 1: Green lint (CI prerequisite)

`pnpm lint` today exits with 4 errors: 2 in the generated files of a worktree in `.claude/worktrees/` (they must not be linted) and 2 pre-existing `react-hooks/set-state-in-effect` already known in the decision log. The CI would fail from day one.

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `components/theme-toggle.tsx:36-49`
- Modify: `components/domain/expenses/category-breakdown-donut.tsx:325-329`

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm lint` with 0 errors (warnings allowed) — the CI in Task 7 relies on it.

- [ ] **Step 0: Create the working branch**

```bash
git switch main && git pull --ff-only && git switch -c fase-0-app-pronta
```

- [ ] **Step 1: Check the starting state**

Run: `pnpm lint 2>&1 | grep -c " error "`
Expected: `4`

- [ ] **Step 2: Exclude the worktrees from lint**

In `eslint.config.mjs` add `.claude/**` to the `globalIgnores` array:

```js
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local Claude Code worktrees: they contain generated .next builds, not source code.
    ".claude/**",
  ]),
```

- [ ] **Step 3: `ThemeToggle` without setState in the effect**

In `components/theme-toggle.tsx` replace the `mounted` state + `useEffect` with `useSyncExternalStore` (it is `false` during SSR/hydration, `true` on the client, without cascading renders):

```tsx
/** Empty store: only used to tell the server render (false) from the client one (true). */
const subscribeNoop = () => () => {};

export function ThemeToggle({ compact = false, surface = "app", className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  // The resolved theme is known only client-side (next-themes reads localStorage/OS preferences):
  // until we are on the client a placeholder is shown, to avoid hydration mismatches.
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false);

  if (!mounted) {
```

(`subscribeNoop` must be defined at module level, above the component; the rest of the component stays unchanged.)

- [ ] **Step 4: `CategoryLegendRow` with a state update during render**

In `components/domain/expenses/category-breakdown-donut.tsx` replace:

```tsx
  const [budgetInput, setBudgetInput] = React.useState(String(budgetAmount));

  React.useEffect(() => {
    setBudgetInput(String(budgetAmount));
  }, [budgetAmount]);
```

with the React "adjust state when a prop changes" pattern (same behavior: when the saved budget changes from outside, the input realigns):

```tsx
  const [budgetInput, setBudgetInput] = React.useState(String(budgetAmount));
  const [syncedBudget, setSyncedBudget] = React.useState(budgetAmount);

  // The saved budget changed from outside (successful save, period change): realign the input.
  if (budgetAmount !== syncedBudget) {
    setSyncedBudget(budgetAmount);
    setBudgetInput(String(budgetAmount));
  }
```

- [ ] **Step 5: Check**

Run: `pnpm lint 2>&1 | grep -c " error "` → Expected: `0`
Run: `pnpm exec tsc --noEmit` → Expected: no output.

- [ ] **Step 6: 👤 UTENTE — quick visual check**

With `pnpm dev` running: the theme toggle in the sidebar works and does not "jump" on load; in Transazioni → Analisi (Transactions → Analysis), editing a budget in the "Per categoria" (By category) legend and pressing Enter/leaving the field saves and shows the new value; an invalid value (e.g. `abc`) restores the previous one.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.mjs components/theme-toggle.tsx components/domain/expenses/category-breakdown-donut.tsx
git commit -m "fix: lint verde (ignora worktree, niente setState negli effetti)"
```

---

### Task 2: Env validation at startup + `APP_URL` at runtime

`NEXT_PUBLIC_APP_URL` is pasted into the bundle **at build time**: a Docker image built in CI would stay tied to a single domain. It is replaced by `APP_URL` read at runtime server-side; the better-auth client doesn't need it (same origin). A single validation of all variables is added, run at server startup.

**Files:**
- Create: `lib/env.ts`
- Test: `lib/env.test.ts`
- Modify: `instrumentation.ts`
- Modify: `lib/auth/client.ts:6-8`
- Modify: `app/api/gocardless/callback/route.ts:8`
- Modify: `app/api/gocardless/connections/route.ts:64`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CRON_SECRET_MIN_LENGTH: number` (= 32)
  - `serverEnvSchema` (Zod object)
  - `type ServerEnv`
  - `parseServerEnv(source: Record<string, string | undefined>): ServerEnv` — throws `Error("Variabili d'ambiente mancanti o non valide: A, B")` with only the names, sorted.
  - `getAppUrl(): string` — `APP_URL` without trailing slashes; throws if missing.

- [ ] **Step 1: Write the failing tests**

Create `lib/env.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppUrl, parseServerEnv } from "./env";

const VALID_ENV = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  RESEND_API_KEY: "re_key",
  RESEND_FROM: "noreply@example.com",
  GOCARDLESS_SECRET_ID: "gc-id",
  GOCARDLESS_SECRET_KEY: "gc-key",
  CRON_SECRET: "c".repeat(32),
};

describe("parseServerEnv", () => {
  it("accetta un env completo e ignora le variabili estranee", () => {
    const env = parseServerEnv({ ...VALID_ENV, PATH: "/usr/bin" });
    expect(env.APP_URL).toBe("http://localhost:3000");
  });

  it("accetta le variabili OLLAMA assenti o vuote (livello assistente spento)", () => {
    expect(() => parseServerEnv(VALID_ENV)).not.toThrow();
    expect(() => parseServerEnv({ ...VALID_ENV, OLLAMA_BASE_URL: "" })).not.toThrow();
  });

  it("elenca in ordine alfabetico tutte le variabili mancanti", () => {
    const { APP_URL: _a, REDIS_URL: _r, ...rest } = VALID_ENV;
    expect(() => parseServerEnv(rest)).toThrow("Variabili d'ambiente mancanti o non valide: APP_URL, REDIS_URL");
  });

  it("rifiuta CRON_SECRET e BETTER_AUTH_SECRET più corti di 32 caratteri", () => {
    expect(() => parseServerEnv({ ...VALID_ENV, CRON_SECRET: "corto" })).toThrow("CRON_SECRET");
    expect(() => parseServerEnv({ ...VALID_ENV, BETTER_AUTH_SECRET: "corto" })).toThrow("BETTER_AUTH_SECRET");
  });

  it("rifiuta APP_URL che non è un URL", () => {
    expect(() => parseServerEnv({ ...VALID_ENV, APP_URL: "buddybudget" })).toThrow("APP_URL");
  });

  it("non espone mai i valori nel messaggio d'errore", () => {
    const leaked = "segreto-che-non-deve-comparire";
    try {
      parseServerEnv({ ...VALID_ENV, CRON_SECRET: leaked });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(leaked);
    }
  });
});

describe("getAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("restituisce APP_URL senza slash finali", () => {
    vi.stubEnv("APP_URL", "https://buddybudget.example//");
    expect(getAppUrl()).toBe("https://buddybudget.example");
  });

  it("lancia se APP_URL manca", () => {
    vi.stubEnv("APP_URL", "");
    expect(() => getAppUrl()).toThrow("APP_URL");
  });
});
```

- [ ] **Step 2: Check that they fail**

Run: `pnpm exec vitest run lib/env.test.ts`
Expected: FAIL — `Failed to resolve import "./env"`.

- [ ] **Step 3: Implement `lib/env.ts`**

```ts
import { z } from "zod";

/** Minimum length of the secret shared with whoever calls the cron endpoints. */
export const CRON_SECRET_MIN_LENGTH = 32;

/**
 * Environment variables required by the server. OLLAMA_* are optional: if absent the assistant
 * level of categorisation is simply off (normal state, not a fault).
 */
export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  APP_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM: z.string().min(1),
  GOCARDLESS_SECRET_ID: z.string().min(1),
  GOCARDLESS_SECRET_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(CRON_SECRET_MIN_LENGTH),
  OLLAMA_BASE_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates the server env. On error it throws listing only the NAMES of the missing or invalid
 * variables (never the values, which can be secrets and end up in logs).
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))].sort();
  throw new Error(`Variabili d'ambiente mancanti o non valide: ${names.join(", ")}`);
}

/** Public URL of the app read at runtime (not inlined at build), without trailing slashes. */
export function getAppUrl(): string {
  const value = process.env.APP_URL;
  if (!value) {
    throw new Error("APP_URL non è definita.");
  }
  return value.replace(/\/+$/, "");
}
```

- [ ] **Step 4: Check that they pass**

Run: `pnpm exec vitest run lib/env.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Validate the env at startup**

Replace `instrumentation.ts` with (the schedulers stay until Task 4):

```ts
/** Next.js boot hook: validates the env (fails immediately if a variable is missing) and starts the schedulers in the Node.js runtime. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("@/lib/env");
    parseServerEnv(process.env);
    const { startGoCardlessScheduler } = await import("@/lib/gocardless/scheduler");
    startGoCardlessScheduler();
    const { startNetWorthScheduler } = await import("@/lib/net-worth/scheduler");
    startNetWorthScheduler();
  }
}
```

- [ ] **Step 6: Replace `NEXT_PUBLIC_APP_URL`**

`lib/auth/client.ts` — remove `baseURL` (the better-auth client uses the current origin of the page):

```ts
/** better-auth client for React components (same origin as the app, no baseURL). Do not import in server-only files. */
export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});
```

`app/api/gocardless/callback/route.ts` — add `import { getAppUrl } from "@/lib/env";` and replace line 8:

```ts
  const appUrl = getAppUrl();
```

`app/api/gocardless/connections/route.ts` — add `import { getAppUrl } from "@/lib/env";` and replace line 64:

```ts
  const redirectUrl = `${getAppUrl()}/api/gocardless/callback`;
```

Check: `grep -rn "NEXT_PUBLIC_APP_URL" --include=*.ts --include=*.tsx app lib components` → no results.

- [ ] **Step 7: Update `.env.local.example`**

Replace the line `NEXT_PUBLIC_APP_URL=http://localhost:3000` with:

```
# Public URL of the app, read at runtime (GoCardless callback). In production: https://<domain>
APP_URL=http://localhost:3000
```

and add at the end:

```
# Secret shared with whoever calls /api/cron/* (Vercel Cron today, k8s CronJob after the migration).
# At least 32 characters. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
CRON_SECRET=<stringa-random-almeno-32-caratteri>
```

- [ ] **Step 8: 👤 UTENTE — update your `.env.local`**

1. Generate the secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
2. In `.env.local`: rename `NEXT_PUBLIC_APP_URL` to `APP_URL` (same value) and add `CRON_SECRET=<generated value>`.
3. Check that `BETTER_AUTH_SECRET` has at least 32 characters: `node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.BETTER_AUTH_SECRET.length)"`. If it is shorter, generate a new one with the same command as point 1 (it invalidates local sessions, no other effect).
4. `pnpm dev`: the server starts without `Variabili d'ambiente mancanti` errors; magic link login still works.

Paste the output of point 3 and the first lines of `pnpm dev`.

- [ ] **Step 9: Check and commit**

Run: `pnpm exec tsc --noEmit && pnpm lint 2>&1 | grep -c " error "` → Expected: `0`

```bash
git add lib/env.ts lib/env.test.ts instrumentation.ts lib/auth/client.ts app/api/gocardless/callback/route.ts app/api/gocardless/connections/route.ts .env.local.example
git commit -m "feat: validazione env all'avvio e APP_URL letta a runtime"
```

---

### Task 3: Health check (liveness + readiness)

Liveness (`/api/health`) says "the process responds" and touches no external dependencies: if the DB goes down, k8s must not restart the app pods (it would not help). Readiness (`/api/health/ready`) says "I can serve traffic": it pings Postgres and Redis with a timeout. Both public (outside the `proxy.ts` auth) and with no sensitive data in the response.

**Files:**
- Create: `lib/health/readiness.ts`
- Test: `lib/health/readiness.test.ts`
- Create: `app/api/health/route.ts`
- Create: `app/api/health/ready/route.ts`
- Test: `app/api/health/ready/route.test.ts`
- Modify: `lib/redis/client.ts`
- Modify: `proxy.ts:6-10`
- Test: `proxy.test.ts`

**Interfaces:**
- Consumes: nothing from previous tasks.
- Produces:
  - `type CheckStatus = "ok" | "error"`
  - `interface ReadinessResult { ready: boolean; checks: Record<string, CheckStatus> }`
  - `type ReadinessProbe = () => Promise<unknown>`
  - `READINESS_TIMEOUT_MS = 2000`
  - `checkReadiness(probes: Record<string, ReadinessProbe>, timeoutMs?: number): Promise<ReadinessResult>`
  - `isPublicPath(pathname: string): boolean` exported from `proxy.ts` (Task 4 relies on `/api/cron` being public).

- [ ] **Step 1: Tests for `checkReadiness`**

Create `lib/health/readiness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkReadiness } from "./readiness";

describe("checkReadiness", () => {
  it("è pronto quando tutte le probe rispondono", async () => {
    const result = await checkReadiness({ database: async () => 1, redis: async () => "PONG" });
    expect(result).toEqual({ ready: true, checks: { database: "ok", redis: "ok" } });
  });

  it("non è pronto se una probe fallisce, e segnala quale", async () => {
    const result = await checkReadiness({
      database: async () => 1,
      redis: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(result).toEqual({ ready: false, checks: { database: "ok", redis: "error" } });
  });

  it("considera fallita una probe che non risponde entro il timeout", async () => {
    const hanging = () => new Promise(() => {});
    const startedAt = Date.now();
    const result = await checkReadiness({ redis: hanging }, 20);
    expect(result.checks.redis).toBe("error");
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it("gestisce una probe che lancia in modo sincrono", async () => {
    const result = await checkReadiness({
      database: () => {
        throw new Error("boom");
      },
    });
    expect(result.ready).toBe(false);
  });
});
```

- [ ] **Step 2: Check that it fails**

Run: `pnpm exec vitest run lib/health/readiness.test.ts` → Expected: FAIL (`./readiness` does not exist).

- [ ] **Step 3: Implement `lib/health/readiness.ts`**

```ts
export type CheckStatus = "ok" | "error";

export interface ReadinessResult {
  ready: boolean;
  checks: Record<string, CheckStatus>;
}

/** A probe resolves if the dependency responds, rejects (or never resolves) otherwise. */
export type ReadinessProbe = () => Promise<unknown>;

/** Beyond this time a dependency is considered down (otherwise ioredis silently retries for a long time). */
export const READINESS_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Runs the probes in parallel, each with its own timeout; ready only if all of them respond. */
export async function checkReadiness(
  probes: Record<string, ReadinessProbe>,
  timeoutMs: number = READINESS_TIMEOUT_MS
): Promise<ReadinessResult> {
  const entries = await Promise.all(
    Object.entries(probes).map(async ([name, probe]): Promise<[string, CheckStatus]> => {
      try {
        await withTimeout(Promise.resolve().then(probe), timeoutMs);
        return [name, "ok"];
      } catch {
        return [name, "error"];
      }
    })
  );
  return {
    ready: entries.every(([, status]) => status === "ok"),
    checks: Object.fromEntries(entries),
  };
}
```

(`Promise.resolve().then(probe)` also turns a synchronous `throw` into a rejection.)

- [ ] **Step 4: Check that it passes**

Run: `pnpm exec vitest run lib/health/readiness.test.ts` → Expected: PASS (4 tests).

- [ ] **Step 5: Redis with a lazy connection**

In `lib/redis/client.ts` replace the last line with:

```ts
// lazyConnect: the connection starts at the first command, not at module import. Needed for the build
// of the Docker image (which imports the modules with a dummy REDIS_URL) and changes nothing at runtime.
export const redis = new Redis(redisUrl, { lazyConnect: true });
```

- [ ] **Step 6: Tests for the readiness route**

Create `app/api/health/ready/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ client: vi.fn() }));
vi.mock("@/lib/redis/client", () => ({ redis: { ping: vi.fn() } }));

import { client } from "@/lib/db/client";
import { redis } from "@/lib/redis/client";
import { GET } from "./route";

const mockedClient = vi.mocked(client as unknown as (...args: unknown[]) => Promise<unknown>);
const mockedPing = vi.mocked(redis.ping);

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    mockedClient.mockReset().mockResolvedValue([{ "?column?": 1 }]);
    mockedPing.mockReset().mockResolvedValue("PONG");
  });

  it("risponde 200 quando Postgres e Redis rispondono", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: true, checks: { database: "ok", redis: "ok" } });
  });

  it("risponde 503 senza dettagli d'errore quando Redis è giù", async () => {
    mockedPing.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:6379"));
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ ready: false, checks: { database: "ok", redis: "error" } });
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
```

- [ ] **Step 7: Check that it fails**

Run: `pnpm exec vitest run app/api/health/ready/route.test.ts` → Expected: FAIL (`./route` does not exist).

- [ ] **Step 8: Implement the two routes**

`app/api/health/route.ts`:

```ts
export const dynamic = "force-dynamic";

/**
 * Liveness: 200 as long as the Node process responds. Deliberately does not touch DB/Redis:
 * if a dependency goes down, restarting the app would not help (readiness takes care of it).
 */
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
```

`app/api/health/ready/route.ts`:

```ts
import { client } from "@/lib/db/client";
import { checkReadiness } from "@/lib/health/readiness";
import { redis } from "@/lib/redis/client";

export const dynamic = "force-dynamic";

/** Readiness: 200 if Postgres and Redis respond within the timeout, otherwise 503 (the pod leaves load balancing). */
export async function GET() {
  const result = await checkReadiness({
    database: async () => {
      await client`select 1`;
    },
    redis: () => redis.ping(),
  });
  return Response.json(result, {
    status: result.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
```

Run: `pnpm exec vitest run app/api/health/ready/route.test.ts` → Expected: PASS (2 tests).

- [ ] **Step 9: Tests for the public paths in `proxy.ts`**

Create `proxy.test.ts` (repo root, next to `proxy.ts`):

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { isPublicPath } from "./proxy";

describe("isPublicPath", () => {
  it.each(["/api/health", "/api/health/ready", "/api/cron/gocardless-sync", "/api/auth/callback/google", "/favicon.ico"])(
    "%s è pubblico",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    }
  );

  it.each(["/api/transactions", "/api/healthz", "/api/cronjobs", "/conti", "/"])("%s richiede sessione", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
```

Run: `pnpm exec vitest run proxy.test.ts` → Expected: FAIL (`isPublicPath` not exported).

- [ ] **Step 10: Update `proxy.ts`**

Replace lines 6-10 with (comparison by path segment, so `/api/healthz` does not become public by accident):

```ts
// /api/health* are the liveness/readiness probes; /api/cron/* is protected by the CRON_SECRET secret, not by the session.
const PUBLIC_PATH_PREFIXES = ["/login", "/api/auth", "/api/health", "/api/cron", "/_next", "/favicon.ico"];

/** True if the path is accessible without a session (comparison by segment: `/api/health` yes, `/api/healthz` no). */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
```

Run: `pnpm exec vitest run proxy.test.ts` → Expected: PASS (10 tests).

- [ ] **Step 11: 👤 UTENTE — live test**

With `pnpm dev` running and local Postgres/Redis up:

```bash
curl -s http://localhost:3000/api/health; echo
curl -s -w " %{http_code}\n" http://localhost:3000/api/health/ready
```

Expected: `{"status":"ok"}` and `{"ready":true,...} 200`. Then stop local Redis and repeat the second one: `{"ready":false,"checks":{"database":"ok","redis":"error"}} 503` in about 2 seconds. Start Redis again. Paste the outputs.

- [ ] **Step 12: Commit**

```bash
git add lib/health app/api/health lib/redis/client.ts proxy.ts proxy.test.ts
git commit -m "feat: endpoint di liveness e readiness pubblici"
```

---

### Task 4: Cron as HTTP endpoints + Vercel Cron

`node-cron` inside the Next process does not run on Vercel (serverless) and on k8s with 2 replicas it would fire twice. The two jobs become routes protected by `CRON_SECRET`; today Vercel Cron calls them (it sends `Authorization: Bearer $CRON_SECRET` by itself if the variable exists in the project), after the migration a k8s CronJob with `curl`.

Design note: the syncs run inside the request (`maxDuration = 300`), not in `after()` + a job on Redis. The "Operazioni lunghe" (Long-running operations) standard in CLAUDE.md is about operations started by a user who waits for feedback; here nobody looks at the response.

**Files:**
- Create: `lib/cron/auth.ts`
- Test: `lib/cron/auth.test.ts`
- Create: `app/api/cron/gocardless-sync/route.ts`
- Test: `app/api/cron/gocardless-sync/route.test.ts`
- Create: `app/api/cron/net-worth-snapshot/route.ts`
- Test: `app/api/cron/net-worth-snapshot/route.test.ts`
- Modify: `lib/gocardless/scheduler.ts` (remove `node-cron` and `startGoCardlessScheduler`)
- Modify: `lib/net-worth/scheduler.ts` (remove `node-cron`, `NET_WORTH_SNAPSHOT_CRON`, `startNetWorthScheduler`)
- Modify: `instrumentation.ts`
- Modify: `package.json` (via `pnpm remove`)
- Create: `vercel.json`

**Interfaces:**
- Consumes: `CRON_SECRET_MIN_LENGTH` from `lib/env.ts` (Task 2); public `/api/cron` in `proxy.ts` (Task 3); `runDueSyncs(): Promise<void>` from `lib/gocardless/scheduler.ts`; `runDailySnapshots(today?: Date): Promise<void>` from `lib/net-worth/scheduler.ts`.
- Produces: `isAuthorizedCronRequest(authorizationHeader: string | null, secret: string | undefined): boolean`; `GET /api/cron/gocardless-sync` and `GET /api/cron/net-worth-snapshot` → 401 without a valid secret, 200 `{ ok: true, durationMs }`, 500 `{ ok: false }` if the job throws.

- [ ] **Step 1: Tests for `isAuthorizedCronRequest`**

Create `lib/cron/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./auth";

const SECRET = "s".repeat(40);

describe("isAuthorizedCronRequest", () => {
  it("accetta il Bearer esatto", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rifiuta header assente, segreto sbagliato o schema diverso", () => {
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${"x".repeat(40)}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}extra`, SECRET)).toBe(false);
  });

  it("rifiuta sempre se il segreto non è configurato o è troppo corto", () => {
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer undefined", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer corto", "corto")).toBe(false);
  });
});
```

Run: `pnpm exec vitest run lib/cron/auth.test.ts` → Expected: FAIL (`./auth` does not exist).

- [ ] **Step 2: Implement `lib/cron/auth.ts`**

```ts
import { timingSafeEqual } from "node:crypto";
import { CRON_SECRET_MIN_LENGTH } from "@/lib/env";

/**
 * Checks `Authorization: Bearer <CRON_SECRET>` (sent by Vercel Cron or by k8s CronJobs).
 * Constant-time comparison; without a configured secret, or if it is too short, always rejects.
 */
export function isAuthorizedCronRequest(authorizationHeader: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < CRON_SECRET_MIN_LENGTH || !authorizationHeader) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorizationHeader);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
```

Run: `pnpm exec vitest run lib/cron/auth.test.ts` → Expected: PASS (3 tests).

- [ ] **Step 3: Tests for the GoCardless sync route**

Create `app/api/cron/gocardless-sync/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gocardless/scheduler", () => ({ runDueSyncs: vi.fn() }));

import { runDueSyncs } from "@/lib/gocardless/scheduler";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const mockedRun = vi.mocked(runDueSyncs);

function call(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new NextRequest("http://localhost/api/cron/gocardless-sync", { headers }));
}

describe("GET /api/cron/gocardless-sync", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    mockedRun.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("risponde 401 senza segreto e non avvia il sync", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer sbagliato")).status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("avvia il sync e risponde 200 col segreto giusto", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(mockedRun).toHaveBeenCalledOnce();
  });

  it("risponde 500 se il sync lancia, così il fallimento è visibile al chiamante", async () => {
    mockedRun.mockRejectedValue(new Error("DB giù"));
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false });
  });
});
```

- [ ] **Step 4: Tests for the net worth snapshot route**

Create `app/api/cron/net-worth-snapshot/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net-worth/scheduler", () => ({ runDailySnapshots: vi.fn() }));

import { runDailySnapshots } from "@/lib/net-worth/scheduler";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const mockedRun = vi.mocked(runDailySnapshots);

function call(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new NextRequest("http://localhost/api/cron/net-worth-snapshot", { headers }));
}

describe("GET /api/cron/net-worth-snapshot", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    mockedRun.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("risponde 401 senza segreto e non scrive snapshot", async () => {
    expect((await call()).status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("scrive gli snapshot e risponde 200 col segreto giusto", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(mockedRun).toHaveBeenCalledOnce();
  });

  it("risponde 500 se lo snapshot lancia", async () => {
    mockedRun.mockRejectedValue(new Error("DB giù"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
```

Run: `pnpm exec vitest run app/api/cron` → Expected: FAIL (the routes do not exist).

- [ ] **Step 5: Implement the two routes**

`app/api/cron/gocardless-sync/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runDueSyncs } from "@/lib/gocardless/scheduler";

export const dynamic = "force-dynamic";
// Due accounts are synced inside the request: no user waits for the response, so
// no job/after() (the "Operazioni lunghe" standard is about operations started by the user).
export const maxDuration = 300;

/** GoCardless sync cron for due accounts (Vercel Cron today, k8s CronJob after the migration). Idempotent. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    await runDueSyncs();
  } catch (error) {
    console.error("Cron sync GoCardless fallito", error);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true, durationMs: Date.now() - startedAt });
}
```

`app/api/cron/net-worth-snapshot/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runDailySnapshots } from "@/lib/net-worth/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily cron for the net worth snapshots of all users with accounts. Idempotent (upsert per day). */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    await runDailySnapshots();
  } catch (error) {
    console.error("Cron snapshot patrimonio fallito", error);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true, durationMs: Date.now() - startedAt });
}
```

Run: `pnpm exec vitest run app/api/cron` → Expected: PASS (6 tests).

- [ ] **Step 6: Remove the in-process schedulers**

`lib/gocardless/scheduler.ts`: delete `import cron from "node-cron";` (line 1) and the whole final block from `let started = false;` to the end of the file (`startGoCardlessScheduler`).

`lib/net-worth/scheduler.ts`: delete `import cron from "node-cron";`, the `NET_WORTH_SNAPSHOT_CRON` constant with its comment, and the final block from `let started = false;` to the end (`startNetWorthScheduler`).

`instrumentation.ts` becomes:

```ts
/** Next.js boot hook: validates the environment variables at server startup (fails immediately if one is missing). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("@/lib/env");
    parseServerEnv(process.env);
  }
}
```

Then:

```bash
pnpm remove node-cron @types/node-cron
grep -rn "node-cron\|startGoCardlessScheduler\|startNetWorthScheduler\|NET_WORTH_SNAPSHOT_CRON" --include=*.ts --include=*.tsx app lib components instrumentation.ts
```

Expected: no results.

- [ ] **Step 7: Add `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/gocardless-sync", "schedule": "0 5 * * *" },
    { "path": "/api/cron/net-worth-snapshot", "schedule": "50 21 * * *" }
  ]
}
```

Times in UTC (Vercel Cron does not support time zones): `21:50 UTC` = 23:50 in Italy in summer, 22:50 in winter, and the UTC date always matches the Italian date of the day that is closing. The sync is **daily** because Vercel's Hobby plan rejects crons more frequent than once a day (the deploy would fail); on the Pro plan Task 8 moves it to `0 5,17 * * *` (every 12h, as before). `runDueSyncs` still respects the budget of 4 syncs/day per account.

- [ ] **Step 8: 👤 UTENTE — live test**

With `pnpm dev` running (replace `<CRON_SECRET>` with the value in your `.env.local`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/net-worth-snapshot
curl -s -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/net-worth-snapshot; echo
```

Expected: `401`, then `{"ok":true,"durationMs":...}`. Then open `/panoramica`: today's point is there. Don't call `/api/cron/gocardless-sync` locally unless needed: it consumes the daily GoCardless budget of the linked accounts. Paste the outputs.

- [ ] **Step 9: Check and commit**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run lib/cron app/api/cron lib/env.test.ts` → Expected: PASS.

```bash
git add lib/cron app/api/cron lib/gocardless/scheduler.ts lib/net-worth/scheduler.ts instrumentation.ts package.json pnpm-lock.yaml vercel.json
git commit -m "feat: cron come endpoint protetti da CRON_SECRET, via node-cron"
```

---

### Task 5: Single Drizzle baseline, marked on the existing DBs

Today `lib/db/migrations/` only contains `0000_silly_flatman.sql` from July: everything that came after was applied with `db:push` or direct SQL, so the migrations no longer describe the schema. We generate **a new baseline** from the current TypeScript schema, check with `pg_dump` that the real DBs (local development and production Neon) match it, and **mark it as already applied** on those DBs (one row in `drizzle.__drizzle_migrations`), so that `pnpm db:migrate` from now on will apply only the following migrations. On an empty DB (CI, CNPG in Phase 4) `pnpm db:migrate` applies the baseline and that's it.

How Drizzle's migrator reasons (verified in `node_modules/drizzle-orm/pg-core/dialect.js`): it reads the row of `drizzle.__drizzle_migrations` with the highest `created_at` and applies only the migrations whose `when` in the journal is greater. The hash is not compared.

**Files:**
- Modify: `lib/db/client.ts:11`
- Delete: `lib/db/migrations/0000_silly_flatman.sql`, `lib/db/migrations/meta/0000_snapshot.json`, `lib/db/migrations/meta/_journal.json` (regenerated)
- Create: `lib/db/migrations/0000_baseline.sql` (+ `meta/`), generated by drizzle-kit
- Create: `lib/db/baseline.ts`
- Test: `lib/db/baseline.test.ts`
- Create: `lib/db/mark-baseline.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: nothing from previous tasks.
- Produces: `planBaselineMark(existingCreatedAts: number[], baselineWhen: number): "insert" | "already-marked"`; `pnpm db:mark-baseline` script; `pnpm db:migrate` working even without `.env.local` (needed by the CI in Task 7 and the migrator image in Task 6).

- [ ] **Step 1: 👤 UTENTE — prerequisites**

1. Start **Docker Desktop** and check: `docker ps` (no errors).
2. Start the local development Postgres (the one in `DATABASE_URL` in `.env.local`) and check with `curl -s http://localhost:3000/api/health/ready` with `pnpm dev` running: `"database":"ok"`.
3. From the Neon dashboard (Connection details, **without pooler**) copy the non-pooled production connection string and check that it contains `sslmode=require`. Keep it at hand: it is needed in steps 8 and 11, **it must not be pasted in the chat or in repo files**.

Paste the output of points 1-2 and write only "sslmode present: yes/no" for point 3.

- [ ] **Step 2: SSL decided by the URL, not by `NODE_ENV`**

In `lib/db/client.ts` replace the client line with:

```ts
// Connection encryption is decided by the URL (`?sslmode=require` for Neon/CNPG, absent for the local
// Postgres): an explicit `ssl` here would win over the URL and prevent using a local Postgres without TLS
// even with NODE_ENV=production (e.g. the Docker container under test).
export const client = postgres(connectionString);
```

- [ ] **Step 3: Tests for `planBaselineMark`**

Create `lib/db/baseline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planBaselineMark } from "./baseline";

const BASELINE_WHEN = 1790400000000;

describe("planBaselineMark", () => {
  it("inserisce su un DB che non ha mai usato il migrator", () => {
    expect(planBaselineMark([], BASELINE_WHEN)).toBe("insert");
  });

  it("inserisce anche se c'è la vecchia migration di luglio, così il migrator la considera superata", () => {
    expect(planBaselineMark([1783617840424], BASELINE_WHEN)).toBe("insert");
  });

  it("non fa nulla se la baseline è già registrata (script rilanciabile)", () => {
    expect(planBaselineMark([1783617840424, BASELINE_WHEN], BASELINE_WHEN)).toBe("already-marked");
  });
});
```

Run: `pnpm exec vitest run lib/db/baseline.test.ts` → Expected: FAIL (`./baseline` does not exist).

- [ ] **Step 4: Implement `lib/db/baseline.ts`**

```ts
/** Drizzle migrations folder (same value as `out` in drizzle.config.ts). */
export const MIGRATIONS_FOLDER = "./lib/db/migrations";

/**
 * Decides whether to record the baseline as already applied. Drizzle's migrator applies only migrations
 * with `when` greater than the highest recorded `created_at`, so one row with the baseline's `when` is enough.
 */
export function planBaselineMark(existingCreatedAts: number[], baselineWhen: number): "insert" | "already-marked" {
  return existingCreatedAts.includes(baselineWhen) ? "already-marked" : "insert";
}
```

Run: `pnpm exec vitest run lib/db/baseline.test.ts` → Expected: PASS (3 tests).

- [ ] **Step 5: `lib/db/mark-baseline.ts` script**

```ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { client } from "./client";
import { MIGRATIONS_FOLDER, planBaselineMark } from "./baseline";

interface Journal {
  entries: { idx: number; when: number; tag: string }[];
}

/**
 * Records the baseline (first migration of the journal) as already applied on an existing DB,
 * whose schema has been verified equal to the baseline. Re-runnable. On an empty DB it refuses:
 * there `pnpm db:migrate` must be used.
 */
async function main() {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")) as Journal;
  const baseline = journal.entries[0];
  const migrationSql = readFileSync(path.join(MIGRATIONS_FOLDER, `${baseline.tag}.sql`)).toString();
  // Same hash computed by Drizzle's migrator (sha256 of the file), for consistency of the table.
  const hash = createHash("sha256").update(migrationSql).digest("hex");

  const [{ exists }] = await client<{ exists: boolean }[]>`select to_regclass('public.transactions') is not null as exists`;
  if (!exists) {
    throw new Error("Il DB non contiene lo schema applicativo: usa `pnpm db:migrate`, non la baseline.");
  }

  await client`create schema if not exists drizzle`;
  await client`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
  const rows = await client<{ created_at: string }[]>`select created_at from drizzle.__drizzle_migrations`;

  if (planBaselineMark(rows.map((row) => Number(row.created_at)), baseline.when) === "already-marked") {
    console.log(`Baseline ${baseline.tag} già registrata: nulla da fare.`);
    return;
  }
  await client`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${baseline.when})`;
  console.log(`Baseline ${baseline.tag} registrata come già applicata.`);
}

main()
  .then(() => client.end())
  .catch(async (error) => {
    console.error(error);
    await client.end();
    process.exit(1);
  });
```

- [ ] **Step 6: Scripts in `package.json`**

In the `scripts` section:
- replace `db:migrate` with `"db:migrate": "tsx --env-file-if-exists=.env.local lib/db/migrate.ts"` (it also works in CI and in the container, where there is no `.env.local`; a variable already in the environment wins over the file);
- add `"db:mark-baseline": "tsx --env-file-if-exists=.env.local lib/db/mark-baseline.ts"`;
- **remove** `db:push` (from now on the schema changes only with versioned migrations).

Also add, at the root level of `package.json`: `"packageManager": "pnpm@11.5.0",` (needed by CI and Docker to use the same pnpm version).

- [ ] **Step 7: Regenerate the baseline**

```bash
git rm -q lib/db/migrations/0000_silly_flatman.sql lib/db/migrations/meta/0000_snapshot.json lib/db/migrations/meta/_journal.json
pnpm db:generate --name baseline
ls lib/db/migrations lib/db/migrations/meta
```

Expected: `0000_baseline.sql`, `meta/0000_snapshot.json`, `meta/_journal.json` with a single entry. Read the generated SQL: it must contain all the tables of `lib/db/schema/` (including `net_worth_snapshots` and `categorization_rules`), the `category_type` enum with the values of `lib/categories/groups.ts` and the `transactions_account_external_id_unique` constraint.

- [ ] **Step 8: 👤 UTENTE — schema comparison: baseline vs real DBs**

In Git Bash, in the repo root. Create a throwaway Postgres, apply the baseline to it and compare its schema with that of the development DB and of Neon:

```bash
docker run -d --name bb-baseline -e POSTGRES_PASSWORD=baseline -p 55432:5432 postgres:17
sleep 5
DATABASE_URL=postgresql://postgres:baseline@localhost:55432/postgres pnpm db:migrate

mkdir -p /tmp/bb-schema
DUMP="pg_dump --schema-only --no-owner --no-privileges --schema=public"
# Strips comments, empty lines and headers that change at every dump (version, random \restrict).
clean() { grep -v -E '^(--|SET |SELECT pg_catalog)' | grep -v -E '^.(un)?restrict ' | grep -v '^$'; }

docker exec bb-baseline $DUMP -U postgres postgres | clean > /tmp/bb-schema/baseline.sql
docker run --rm postgres:17 $DUMP "<DATABASE_URL of the local DB, with host.docker.internal instead of localhost>" | clean > /tmp/bb-schema/local.sql
docker run --rm postgres:17 $DUMP "<non-pooled Neon connection string>" | clean > /tmp/bb-schema/neon.sql

git diff --no-index --stat /tmp/bb-schema/baseline.sql /tmp/bb-schema/local.sql
git diff --no-index --stat /tmp/bb-schema/baseline.sql /tmp/bb-schema/neon.sql
```

Paste the output of the two `git diff --stat`. If they are not empty, also paste `git diff --no-index /tmp/bb-schema/baseline.sql /tmp/bb-schema/neon.sql` (and/or `local.sql`): it contains only table/column/constraint names, no data.

- [ ] **Step 9: Analysis of the differences (stop rule)**

Differences **allowed** without intervention:
- the **order of the columns** in a table (columns added by hand with `ALTER TABLE ADD COLUMN` end up at the end; Drizzle uses names, not positions);
- only the **order of the values** of the `category_type` enum (effect of the `db:migrate-category-groups` migration: it renames and appends values). It affects neither the data nor future migrations, generated from the TypeScript snapshot and not from the DB.

**Any other difference** (missing or extra table/column/index/constraint, different type or default, different `NOT NULL`): **stop**, do not mark the baseline on that DB. It is analysed together with the user and decided case by case between (a) fixing the TypeScript schema because the DB is right, regenerating the baseline (back to step 7), or (b) fixing the DB with targeted SQL explicitly approved by the user (for Neon: backup/Neon branch first). The `transactions_account_external_id_unique` constraint, which was blocking `db:push`, is the first suspect: compare it carefully.

- [ ] **Step 10: Check the baseline on the throwaway DB and then delete it**

The test suite against the DB just created from the baseline proves that it is enough to run the app (it is exactly what the CI will do):

```bash
DATABASE_URL=postgresql://postgres:baseline@localhost:55432/postgres pnpm test 2>&1 | tail -8
```

Expected: same outcome as the suite against the development DB. If there are failing tests, compare with a run of `pnpm test` on the development DB: a test that fails **only** on the empty DB depends on pre-existing data and must be fixed in Task 7 (step 1); one that fails everywhere is a pre-existing problem to bring to the user before going on.

Then `docker rm -f bb-baseline`.

- [ ] **Step 11: 👤 UTENTE — mark the baseline on the existing DBs**

Only for the DBs that passed step 9:

```bash
DATABASE_URL="<non-pooled Neon connection string>" pnpm db:mark-baseline
DATABASE_URL="<connection string Neon non-pooled>" pnpm db:mark-baseline
```

Expected: `Baseline 0000_baseline registrata come già applicata.` for both. Then the proof that the migrator does not want to reapply anything:

```bash
pnpm db:migrate
DATABASE_URL="<non-pooled Neon connection string>" pnpm db:migrate
```

Expected: `Tabelle presenti: [...]` and `Migration completate.`, without `already exists` errors. Paste the outputs.

- [ ] **Step 12: Commit**

```bash
git add lib/db/client.ts lib/db/baseline.ts lib/db/baseline.test.ts lib/db/mark-baseline.ts lib/db/migrations package.json
git commit -m "feat: baseline Drizzle unica, marcata sui DB esistenti; via db:push"
```

---

### Task 6: Docker image (app + migrator)

**Files:**
- Modify: `next.config.ts`
- Create: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `/api/health` and `/api/health/ready` (Task 3); `pnpm db:migrate` without `.env.local` and `packageManager` (Task 5); Redis `lazyConnect` (Task 3).
- Produces: Docker targets `runner` (app, `node server.js`, port 3000, non-root user) and `migrator` (`pnpm db:migrate`), used by the CI in Task 7 and by the k8s manifests in Phase 6.

- [ ] **Step 1: Standalone output**

In `next.config.ts` add as the first property of `nextConfig`:

```ts
  // Self-contained build in .next/standalone (server.js + only the dependencies used): base of the Docker image.
  // Vercel ignores it, so the current deploy does not change.
  output: "standalone",
```

- [ ] **Step 2: `.dockerignore`**

```
.git
.github
.next
node_modules
.claude
.vercel
.env*
!.env.local.example
vercelnenon.txt
docs
coverage
test-results
playwright-report
*.tsbuildinfo
```

- [ ] **Step 3: `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# ---- base: Node + pnpm at the version pinned in package.json ----
FROM node:24-alpine AS base
RUN npm install -g pnpm@11.5.0
WORKDIR /app

# ---- deps: full dependencies (needed by build and migrator) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: next build ----
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DUMMY values for the build only: some modules read the env at import (DB/Redis client, Resend,
# better-auth) and next build imports them. They don't reach the final image: the runner stage starts from scratch
# and the real env arrives at runtime (validated in instrumentation.ts).
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    REDIS_URL=redis://localhost:6379 \
    BETTER_AUTH_SECRET=build-only-placeholder-secret-0000000000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    RESEND_API_KEY=re_build_placeholder
RUN pnpm build

# ---- migrator: runs the Drizzle migrations (PreSync Job in k8s) ----
FROM deps AS migrator
COPY tsconfig.json drizzle.config.ts ./
COPY lib ./lib
USER node
CMD ["pnpm", "db:migrate"]

# ---- runner: app image ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

Note: `runner` is the last stage, so it is the default target of `docker build`.

- [ ] **Step 4: 👤 UTENTE — build of the two images**

```bash
docker build -t buddy-budget:local .
docker build --target migrator -t buddy-budget-migrate:local .
docker images | grep buddy-budget
```

Expected: both builds finish without errors. Paste the last 15 lines of the first build and the output of `docker images`. If the build fails with an error about a missing environment variable read at a module's import, add **only** that variable, with a dummy value, to the `ENV` block of the `builder` stage and rerun: never real values in the Dockerfile.

- [ ] **Step 5: 👤 UTENTE — test the migrator and the app against a throwaway DB**

```bash
docker network create bb-test
docker run -d --name bb-pg --network bb-test -e POSTGRES_PASSWORD=test postgres:17
docker run -d --name bb-redis --network bb-test redis:7
sleep 5
docker run --rm --network bb-test -e DATABASE_URL=postgresql://postgres:test@bb-pg:5432/postgres buddy-budget-migrate:local
```

Expected: `Migration completate.`

Create `.env.docker` (gitignored thanks to `.env*`) by copying `.env.local` and changing: `DATABASE_URL=postgresql://postgres:test@bb-pg:5432/postgres?sslmode=disable` (explicit opt-out: in production the client requires TLS unless `sslmode` is in the URL), `REDIS_URL=redis://bb-redis:6379`. **Remove the quotes** around the values: `docker --env-file` does not strip them.

```bash
docker run -d --name bb-app --network bb-test -p 3000:3000 --env-file .env.docker buddy-budget:local
sleep 3
docker logs bb-app
curl -s http://localhost:3000/api/health; echo
curl -s http://localhost:3000/api/health/ready; echo
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
docker exec bb-app id
```

Expected: logs without `Variabili d'ambiente mancanti`; `{"status":"ok"}`; `{"ready":true,...}`; `200`; `uid=1001(nextjs)`. Also open `http://localhost:3000/login` in the browser: page with styles and logo. Paste the outputs.

Cleanup: `docker rm -f bb-app bb-pg bb-redis && docker network rm bb-test`.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts Dockerfile .dockerignore
git commit -m "feat: Dockerfile multi-stage (app standalone non-root + migrator)"
```

---

### Task 7: GitHub Actions CI + images on GHCR

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify (only if they emerged in Task 5 step 10): the tests that depend on pre-existing data in the development DB

**Interfaces:**
- Consumes: green lint (Task 1); `pnpm db:migrate` without `.env.local` (Task 5); Docker targets `runner`/`migrator` (Task 6); `packageManager` (Task 5).
- Produces: mandatory `check` on every PR; images `ghcr.io/yonderurik/buddy-budget:{main,sha-<sha>}` and `ghcr.io/yonderurik/buddy-budget-migrate:{main,sha-<sha>}` on every push to `main` (consumed in Phase 6 by ArgoCD).

- [ ] **Step 1: Tests independent of the development DB**

If Task 5 step 10 found tests that fail only on an empty DB, fix them so they create the data they use by themselves (same pattern as the other integration tests: user with id `test-<nome>-${crypto.randomUUID()}` in `beforeEach`, deleted in `afterEach`). Check by rerunning the suite against an empty DB as in Task 5 step 10. If none emerged, skip this step.

- [ ] **Step 2: Workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  check:
    name: Lint, tipi e test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: buddy_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s --health-timeout 5s --health-retries 10
      redis:
        image: redis:7
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s --health-timeout 5s --health-retries 10
    # Dummy values used only by the tests: no external service is contacted with these credentials.
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/buddy_test
      REDIS_URL: redis://localhost:6379
      BETTER_AUTH_SECRET: ci-only-placeholder-secret-000000000000
      BETTER_AUTH_URL: http://localhost:3000
      APP_URL: http://localhost:3000
      GOOGLE_CLIENT_ID: ci-google-id
      GOOGLE_CLIENT_SECRET: ci-google-secret
      RESEND_API_KEY: re_ci_placeholder
      RESEND_FROM: ci@example.com
      GOCARDLESS_SECRET_ID: ci-gocardless-id
      GOCARDLESS_SECRET_KEY: ci-gocardless-key
      CRON_SECRET: ci-only-placeholder-cron-secret-0000000
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm exec tsc --noEmit
      - run: pnpm db:migrate
      - run: pnpm test

  image:
    name: Immagine ${{ matrix.image }}
    needs: check
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        include:
          - image: buddy-budget
            target: runner
          - image: buddy-budget-migrate
            target: migrator
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/${{ matrix.image }}
          tags: |
            type=sha,prefix=sha-
            type=raw,value=main
      - uses: docker/build-push-action@v6
        with:
          context: .
          target: ${{ matrix.target }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=${{ matrix.image }}
          cache-to: type=gha,mode=max,scope=${{ matrix.image }}
```

(`docker/metadata-action` converts the owner's name to lowercase, as GHCR requires.)

- [ ] **Step 3: Commit and push the branch**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, tipi, test su Postgres/Redis effimeri e immagini su GHCR"
git push -u origin fase-0-app-pronta
gh pr create --title "Fase 0: app pronta per la migrazione a VPS" --body "Piano: docs/superpowers/plans/2026-09-26-fase-0-app-pronta.md"
```

(If `gh` is not authenticated, the user opens the PR from the GitHub page suggested by the push.)

- [ ] **Step 4: 👤 UTENTE — first CI run**

On the PR, open the **Checks** tab: the "Lint, tipi e test" job must be green. If it is red, paste the link to the job or the error lines. Fix, commit and push again until it is green. The `image` job does **not** run on the PR (only on `main`): it is checked in Task 8.

- [ ] **Step 5: 👤 UTENTE — make the CI mandatory**

GitHub → repo → Settings → Rules → Rulesets (or Branches → Branch protection) on `main`: "Require status checks to pass" with the **Lint, tipi e test** check. That way no merge breaks `main`.

---

### Task 8: Rollout on Vercel and closing the phase

**Files:**
- Modify: `vercel.json` (only if the Vercel plan is Pro)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: Vercel production with validated env, working crons, reachable health endpoints; images on GHCR; CLAUDE.md updated.

- [ ] **Step 1: 👤 UTENTE — Vercel plan**

Vercel → Settings → Billing: is the project on **Hobby** or **Pro**? If Pro, in `vercel.json` move the sync to every 12 hours (`"schedule": "0 5,17 * * *"`) and commit on the PR (`chore: sync GoCardless ogni 12h su Vercel Pro`).

- [ ] **Step 2: 👤 UTENTE — environment variables on Vercel (before the merge)**

Vercel → project → Settings → Environment Variables, for the **Production and Preview** environments:
1. add `APP_URL` = public production URL (e.g. `https://<domain>`, without trailing slash);
2. add `CRON_SECRET` = a **new** value generated with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` (don't reuse the local one);
3. check that `BETTER_AUTH_SECRET` has at least 32 characters (if not: generate a new one; effect: all users will have to log in again);
4. check that `DATABASE_URL` contains `sslmode=require` (if not: append it with `?` or `&`);
5. check that `REDIS_URL`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY` exist.

Do **not** remove `NEXT_PUBLIC_APP_URL` yet. Write "done" with the outcome of points 3-5 (only yes/no, never the values).

- [ ] **Step 3: 👤 UTENTE — preview deploy of the PR**

Vercel creates a preview deploy for the PR: open it, check that the login loads and, in the deploy's Runtime Logs, that there is no `Variabili d'ambiente mancanti`. Then `curl -s <url-preview>/api/health` → `{"status":"ok"}` (if the preview is protected by Vercel Authentication, open it in the browser while logged in instead of using curl).

- [ ] **Step 4: Merge**

With green CI and preview OK: merge the PR into `main` (squash or merge commit, the user's choice), then `git switch main && git pull --ff-only`.

- [ ] **Step 5: 👤 UTENTE — check in production**

```bash
curl -s https://<dominio>/api/health; echo
curl -s -w " %{http_code}\n" https://<dominio>/api/health/ready
curl -s -o /dev/null -w "%{http_code}\n" https://<dominio>/api/cron/net-worth-snapshot
```

Expected: `{"status":"ok"}`, `{"ready":true,...} 200`, `401`.

Then Vercel → project → Settings → **Cron Jobs**: the two jobs appear; press **Run** on `net-worth-snapshot` and check the 200 response in the logs (idempotent: it rewrites today's snapshot). Let the GoCardless sync start by itself at 05:00 UTC; tomorrow check the 200 outcome in the logs and the "Ultimo sync" (Last sync) date in Conti (Accounts).

Finally GitHub → Actions: the workflow on `main` has also completed the two **Immagine** (Image) jobs, and in GitHub → profile → Packages `buddy-budget` and `buddy-budget-migrate` appear.

- [ ] **Step 6: 👤 UTENTE — env cleanup**

Remove `NEXT_PUBLIC_APP_URL` from Vercel (it is no longer read anywhere).

- [ ] **Step 7: Update CLAUDE.md**

1. **Comandi** (Commands) section: add
   ```
   pnpm test              # vitest (uses DATABASE_URL: development DB, or an empty migrated DB)
   pnpm db:generate       # generates a migration from the TypeScript schema (after every change to lib/db/schema)
   pnpm db:migrate        # applies pending migrations (DATABASE_URL from env or .env.local)
   pnpm db:mark-baseline  # one-off: records the baseline on an existing, already aligned DB
   docker build -t buddy-budget:local .   # app image (migrator target: --target migrator)
   ```
2. Add a rule under "Regole per Claude" (Rules for Claude): **Schema DB solo via migration versionate** (DB schema only via versioned migrations) — `db:push` no longer exists; every schema change = `pnpm db:generate` + committed migration + `pnpm db:migrate` on the development DB, then (as long as we are on Neon) on the production DB **before** the merge that uses it.
3. Replace the "Nota tecnica GoCardless" (GoCardless technical note) in Stato del progetto (Project status): the automatic sync no longer runs from `instrumentation.ts` but from `GET /api/cron/gocardless-sync` (Vercel Cron, schedule in `vercel.json`); for a manual test call the endpoint with `Authorization: Bearer $CRON_SECRET`. Remove the "Debito noto" (Known debt) about the cron not running on Vercel (resolved).
4. In "Stato del progetto": Phase 0 completed; next step the plan for Phase 1 (accounts and foundations).
5. Decision log: entry 2026-09-26/completion date with the choices of this phase (runtime APP_URL, daily cron on Hobby, marked baseline, SSL decided by the URL, schema differences found and how they were resolved).

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md aggiornato a fine Fase 0"
git push
```
