# Fase 0 — App pronta per la migrazione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere l'app deployabile come container portabile (immagine su GHCR, health check, cron come endpoint, migration Drizzle versionate, env validate, CI verde) restando in produzione su Vercel + Neon.

**Architecture:** Nessun cambio di hosting in questa fase. Si rimuove ciò che lega l'app al processo singolo (`node-cron` in `instrumentation.ts`) o al build Vercel (`NEXT_PUBLIC_APP_URL` inlined), si aggiungono endpoint HTTP standard (`/api/health`, `/api/health/ready`, `/api/cron/*`) che oggi chiama Vercel Cron e domani i CronJob/probe di k8s, e si ricostruisce una baseline Drizzle unica marcata come già applicata sui DB esistenti. GitHub Actions verifica ogni PR contro un Postgres/Redis effimeri e pubblica due immagini (app e migrator) su GHCR a ogni push su `main`.

**Tech Stack:** Next.js 16 (App Router, `output: "standalone"`), Drizzle ORM/drizzle-kit, postgres.js, ioredis, Zod 4, Vitest 4, Docker multi-stage (Node 24 alpine), GitHub Actions, GHCR, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` (sezione "Modifiche all'applicazione (Fase 0)" e riga 0 della tabella "Fasi").

## Formato runbook guidato

Questo piano mescola codice e azioni che **solo l'utente** può fare (pannello Vercel, avviare Docker Desktop, credenziali Neon). Gli step marcati **👤 UTENTE** vanno eseguiti dall'utente: chi esegue il piano spiega cosa fa il comando e perché, attende che l'utente incolli l'output, lo verifica e solo allora prosegue. Tutti i comandi da terminale degli step 👤 sono per **Git Bash** (non PowerShell: redirezioni `>` e variabili inline `VAR=x cmd` funzionano solo lì), aperto nella root del repo.

Si lavora su un branch dedicato `fase-0-app-pronta` creato da `main`, portato su `main` via Pull Request (così il primo giro della CI gira proprio su quella PR).

## Global Constraints

- Nessun cambio di hosting: produzione resta Vercel + Neon per tutta la fase; ogni task deve lasciare `main` deployabile su Vercel.
- Node 24 (locale, CI, immagine Docker); pnpm `11.5.0` fissato via campo `packageManager`.
- Il codice applicativo non conosce Kubernetes: cron e health sono normali route HTTP; config solo da variabili d'ambiente.
- Nessun segreto nell'immagine Docker né nel repo; i valori fittizi di build esistono solo nello stage `builder`.
- Segreto cron: header `Authorization: Bearer <CRON_SECRET>`, `CRON_SECRET` lungo almeno 32 caratteri, confronto a tempo costante.
- Messaggi d'errore di validazione env: solo **nomi** delle variabili, mai valori.
- Da questa fase in poi lo schema DB cambia solo con `pnpm db:generate` + migration committata + `pnpm db:migrate`; `db:push` viene rimosso.
- Testi visibili, commenti e JSDoc in italiano (regola CLAUDE.md); JSDoc minimo su ogni funzione/route pubblica.
- Container dell'app: utente non-root, `HOSTNAME=0.0.0.0`, porta 3000.

## Review Focus

1. **Variabile mancante in produzione dopo il merge** — la validazione all'avvio fa crashare ogni cold start su Vercel se manca `APP_URL`/`CRON_SECRET` o se `BETTER_AUTH_SECRET` è più corto di 32 caratteri: il sito intero va giù. Coperto dalla checklist pre-merge del Task 8 (step 1-3), non solo dai test di `parseServerEnv`.
2. **`DATABASE_URL` di produzione senza `sslmode=require`** — togliendo `ssl` esplicito da `lib/db/client.ts` la cifratura dipende dall'URL; senza parametro Neon rifiuta la connessione. Coperto dalla verifica esplicita nel Task 5 step 1 e nella checklist del Task 8.
3. **Baseline marcata su un DB che non coincide con lo schema** — le migration future fallirebbero o divergerebbero in silenzio. Coperto dal confronto `pg_dump` del Task 5 con regola di stop su ogni differenza non elencata.
4. **Cron invocato due volte o in parallelo** (Vercel Cron può ripetere, un umano può premere "Run") — lo snapshot patrimonio usa `onConflictDoUpdate`, il sync GoCardless usa lock per conto + budget di eleggibilità: nessun doppione. Coperto da test esistenti di scheduler/snapshots; i nuovi test route verificano solo che la route deleghi.
5. **Readiness bloccata con Redis irraggiungibile** — ioredis mette in coda i comandi e ritenta a lungo: senza timeout la probe resterebbe appesa e k8s la conterebbe come fallita solo dopo il suo timeout. Coperto dal test "probe che non risponde → error entro il timeout" nel Task 3.

---

### Task 1: Lint verde (prerequisito della CI)

`pnpm lint` oggi esce con 4 errori: 2 nei file generati di un worktree in `.claude/worktrees/` (non devono essere lintati) e 2 `react-hooks/set-state-in-effect` pre-esistenti già noti nel log decisioni. La CI fallirebbe dal primo giorno.

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `components/theme-toggle.tsx:36-49`
- Modify: `components/domain/expenses/category-breakdown-donut.tsx:325-329`

**Interfaces:**
- Consumes: nulla.
- Produces: `pnpm lint` con 0 errori (warning ammessi) — la CI del Task 7 ci fa affidamento.

- [ ] **Step 0: Crea il branch di lavoro**

```bash
git switch main && git pull --ff-only && git switch -c fase-0-app-pronta
```

- [ ] **Step 1: Verifica lo stato di partenza**

Run: `pnpm lint 2>&1 | grep -c " error "`
Expected: `4`

- [ ] **Step 2: Escludi i worktree dal lint**

In `eslint.config.mjs` aggiungi `.claude/**` all'array di `globalIgnores`:

```js
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktree locali di Claude Code: contengono build .next generate, non codice sorgente.
    ".claude/**",
  ]),
```

- [ ] **Step 3: `ThemeToggle` senza setState nell'effetto**

In `components/theme-toggle.tsx` sostituisci lo stato `mounted` + `useEffect` con `useSyncExternalStore` (vale `false` durante SSR/idratazione, `true` sul client, senza render a cascata):

```tsx
/** Store vuoto: serve solo a distinguere il render server (false) da quello client (true). */
const subscribeNoop = () => () => {};

export function ThemeToggle({ compact = false, surface = "app", className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  // Il tema risolto è noto solo lato client (next-themes legge localStorage/preferenze OS):
  // finché non siamo sul client si mostra un placeholder, per evitare mismatch di idratazione.
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false);

  if (!mounted) {
```

(`subscribeNoop` va definita a livello di modulo, sopra il componente; il resto del componente resta invariato.)

- [ ] **Step 4: `CategoryLegendRow` con aggiornamento di stato durante il render**

In `components/domain/expenses/category-breakdown-donut.tsx` sostituisci:

```tsx
  const [budgetInput, setBudgetInput] = React.useState(String(budgetAmount));

  React.useEffect(() => {
    setBudgetInput(String(budgetAmount));
  }, [budgetAmount]);
```

con il pattern React "aggiusta lo stato quando cambia una prop" (stesso comportamento: quando il budget salvato cambia dall'esterno, l'input si riallinea):

```tsx
  const [budgetInput, setBudgetInput] = React.useState(String(budgetAmount));
  const [syncedBudget, setSyncedBudget] = React.useState(budgetAmount);

  // Il budget salvato è cambiato dall'esterno (salvataggio riuscito, cambio periodo): riallinea l'input.
  if (budgetAmount !== syncedBudget) {
    setSyncedBudget(budgetAmount);
    setBudgetInput(String(budgetAmount));
  }
```

- [ ] **Step 5: Verifica**

Run: `pnpm lint 2>&1 | grep -c " error "` → Expected: `0`
Run: `pnpm exec tsc --noEmit` → Expected: nessun output.

- [ ] **Step 6: 👤 UTENTE — verifica visiva rapida**

Con `pnpm dev` avviato: il toggle tema in sidebar funziona e non "salta" al caricamento; in Transazioni → Analisi, modificare un budget nella legenda "Per categoria" e premere Invio/uscire dal campo salva e mostra il nuovo valore; un valore non valido (es. `abc`) ripristina il precedente.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.mjs components/theme-toggle.tsx components/domain/expenses/category-breakdown-donut.tsx
git commit -m "fix: lint verde (ignora worktree, niente setState negli effetti)"
```

---

### Task 2: Validazione env all'avvio + `APP_URL` a runtime

`NEXT_PUBLIC_APP_URL` viene incollata nel bundle **al momento della build**: un'immagine Docker costruita in CI resterebbe legata a un solo dominio. La si sostituisce con `APP_URL` letta a runtime lato server; il client better-auth non ne ha bisogno (stessa origine). Si aggiunge una validazione unica di tutte le variabili, eseguita all'avvio del server.

**Files:**
- Create: `lib/env.ts`
- Test: `lib/env.test.ts`
- Modify: `instrumentation.ts`
- Modify: `lib/auth/client.ts:6-8`
- Modify: `app/api/gocardless/callback/route.ts:8`
- Modify: `app/api/gocardless/connections/route.ts:64`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: nulla.
- Produces:
  - `CRON_SECRET_MIN_LENGTH: number` (= 32)
  - `serverEnvSchema` (Zod object)
  - `type ServerEnv`
  - `parseServerEnv(source: Record<string, string | undefined>): ServerEnv` — lancia `Error("Variabili d'ambiente mancanti o non valide: A, B")` con i soli nomi, ordinati.
  - `getAppUrl(): string` — `APP_URL` senza slash finali; lancia se mancante.

- [ ] **Step 1: Scrivi i test che falliscono**

Crea `lib/env.test.ts`:

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

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm exec vitest run lib/env.test.ts`
Expected: FAIL — `Failed to resolve import "./env"`.

- [ ] **Step 3: Implementa `lib/env.ts`**

```ts
import { z } from "zod";

/** Lunghezza minima del segreto condiviso con chi chiama gli endpoint cron. */
export const CRON_SECRET_MIN_LENGTH = 32;

/**
 * Variabili d'ambiente richieste dal server. OLLAMA_* sono opzionali: se assenti il livello
 * assistente della categorizzazione è semplicemente spento (stato normale, non un guasto).
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
 * Valida l'env del server. In caso di errore lancia elencando solo i NOMI delle variabili
 * mancanti o non valide (mai i valori, che possono essere segreti e finire nei log).
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))].sort();
  throw new Error(`Variabili d'ambiente mancanti o non valide: ${names.join(", ")}`);
}

/** URL pubblico dell'app letto a runtime (non inlined in build), senza slash finali. */
export function getAppUrl(): string {
  const value = process.env.APP_URL;
  if (!value) {
    throw new Error("APP_URL non è definita.");
  }
  return value.replace(/\/+$/, "");
}
```

- [ ] **Step 4: Verifica che passino**

Run: `pnpm exec vitest run lib/env.test.ts`
Expected: PASS (8 test).

- [ ] **Step 5: Valida l'env all'avvio**

Sostituisci `instrumentation.ts` con (gli scheduler restano fino al Task 4):

```ts
/** Hook di boot Next.js: valida l'env (fallisce subito se manca una variabile) e avvia gli scheduler nel runtime Node.js. */
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

- [ ] **Step 6: Sostituisci `NEXT_PUBLIC_APP_URL`**

`lib/auth/client.ts` — togli `baseURL` (il client better-auth usa l'origine corrente della pagina):

```ts
/** Client better-auth per componenti React (stessa origine dell'app, nessun baseURL). Non importare in file server-only. */
export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});
```

`app/api/gocardless/callback/route.ts` — aggiungi `import { getAppUrl } from "@/lib/env";` e sostituisci la riga 8:

```ts
  const appUrl = getAppUrl();
```

`app/api/gocardless/connections/route.ts` — aggiungi `import { getAppUrl } from "@/lib/env";` e sostituisci la riga 64:

```ts
  const redirectUrl = `${getAppUrl()}/api/gocardless/callback`;
```

Verifica: `grep -rn "NEXT_PUBLIC_APP_URL" --include=*.ts --include=*.tsx app lib components` → nessun risultato.

- [ ] **Step 7: Aggiorna `.env.local.example`**

Sostituisci la riga `NEXT_PUBLIC_APP_URL=http://localhost:3000` con:

```
# URL pubblico dell'app, letto a runtime (callback GoCardless). In produzione: https://<dominio>
APP_URL=http://localhost:3000
```

e aggiungi in fondo:

```
# Segreto condiviso con chi chiama /api/cron/* (Vercel Cron oggi, CronJob k8s dopo la migrazione).
# Almeno 32 caratteri. Genera con: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
CRON_SECRET=<stringa-random-almeno-32-caratteri>
```

- [ ] **Step 8: 👤 UTENTE — aggiorna il tuo `.env.local`**

1. Genera il segreto: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
2. In `.env.local`: rinomina `NEXT_PUBLIC_APP_URL` in `APP_URL` (stesso valore) e aggiungi `CRON_SECRET=<valore generato>`.
3. Verifica che `BETTER_AUTH_SECRET` abbia almeno 32 caratteri: `node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.BETTER_AUTH_SECRET.length)"`. Se è più corto, generane uno nuovo con lo stesso comando del punto 1 (invalida le sessioni locali, nessun altro effetto).
4. `pnpm dev`: il server parte senza errori `Variabili d'ambiente mancanti`; il login con magic link funziona ancora.

Incolla l'output del punto 3 e le prime righe di `pnpm dev`.

- [ ] **Step 9: Verifica e commit**

Run: `pnpm exec tsc --noEmit && pnpm lint 2>&1 | grep -c " error "` → Expected: `0`

```bash
git add lib/env.ts lib/env.test.ts instrumentation.ts lib/auth/client.ts app/api/gocardless/callback/route.ts app/api/gocardless/connections/route.ts .env.local.example
git commit -m "feat: validazione env all'avvio e APP_URL letta a runtime"
```

---

### Task 3: Health check (liveness + readiness)

Liveness (`/api/health`) dice "il processo risponde" e non tocca dipendenze esterne: se il DB cade, k8s non deve riavviare i pod dell'app (non servirebbe). Readiness (`/api/health/ready`) dice "posso servire traffico": pinga Postgres e Redis con timeout. Entrambe pubbliche (fuori dall'auth di `proxy.ts`) e senza dati sensibili nella risposta.

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
- Consumes: nulla dai task precedenti.
- Produces:
  - `type CheckStatus = "ok" | "error"`
  - `interface ReadinessResult { ready: boolean; checks: Record<string, CheckStatus> }`
  - `type ReadinessProbe = () => Promise<unknown>`
  - `READINESS_TIMEOUT_MS = 2000`
  - `checkReadiness(probes: Record<string, ReadinessProbe>, timeoutMs?: number): Promise<ReadinessResult>`
  - `isPublicPath(pathname: string): boolean` esportata da `proxy.ts` (il Task 4 conta su `/api/cron` pubblica).

- [ ] **Step 1: Test di `checkReadiness`**

Crea `lib/health/readiness.test.ts`:

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

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm exec vitest run lib/health/readiness.test.ts` → Expected: FAIL (`./readiness` non esiste).

- [ ] **Step 3: Implementa `lib/health/readiness.ts`**

```ts
export type CheckStatus = "ok" | "error";

export interface ReadinessResult {
  ready: boolean;
  checks: Record<string, CheckStatus>;
}

/** Una probe risolve se la dipendenza risponde, rigetta (o non risolve) altrimenti. */
export type ReadinessProbe = () => Promise<unknown>;

/** Oltre questo tempo una dipendenza è considerata giù (ioredis altrimenti ritenta a lungo in silenzio). */
export const READINESS_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Esegue le probe in parallelo, ciascuna col suo timeout; pronto solo se tutte rispondono. */
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

(`Promise.resolve().then(probe)` trasforma anche un `throw` sincrono in un rigetto.)

- [ ] **Step 4: Verifica che passi**

Run: `pnpm exec vitest run lib/health/readiness.test.ts` → Expected: PASS (4 test).

- [ ] **Step 5: Redis con connessione pigra**

In `lib/redis/client.ts` sostituisci l'ultima riga con:

```ts
// lazyConnect: la connessione parte al primo comando, non all'import del modulo. Serve alla build
// dell'immagine Docker (che importa i moduli con un REDIS_URL fittizio) e non cambia nulla a runtime.
export const redis = new Redis(redisUrl, { lazyConnect: true });
```

- [ ] **Step 6: Test della route readiness**

Crea `app/api/health/ready/route.test.ts`:

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

- [ ] **Step 7: Verifica che fallisca**

Run: `pnpm exec vitest run app/api/health/ready/route.test.ts` → Expected: FAIL (`./route` non esiste).

- [ ] **Step 8: Implementa le due route**

`app/api/health/route.ts`:

```ts
export const dynamic = "force-dynamic";

/**
 * Liveness: 200 finché il processo Node risponde. Non tocca DB/Redis di proposito:
 * se cade una dipendenza, riavviare l'app non servirebbe (ci pensa la readiness).
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

/** Readiness: 200 se Postgres e Redis rispondono entro il timeout, altrimenti 503 (il pod esce dal bilanciamento). */
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

Run: `pnpm exec vitest run app/api/health/ready/route.test.ts` → Expected: PASS (2 test).

- [ ] **Step 9: Test dei percorsi pubblici in `proxy.ts`**

Crea `proxy.test.ts` (root del repo, accanto a `proxy.ts`):

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

Run: `pnpm exec vitest run proxy.test.ts` → Expected: FAIL (`isPublicPath` non esportata).

- [ ] **Step 10: Aggiorna `proxy.ts`**

Sostituisci le righe 6-10 con (confronto per segmento di percorso, così `/api/healthz` non diventa pubblico per caso):

```ts
// /api/health* sono le probe di liveness/readiness; /api/cron/* è protetto dal segreto CRON_SECRET, non dalla sessione.
const PUBLIC_PATH_PREFIXES = ["/login", "/api/auth", "/api/health", "/api/cron", "/_next", "/favicon.ico"];

/** True se il percorso è accessibile senza sessione (confronto per segmento: `/api/health` sì, `/api/healthz` no). */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
```

Run: `pnpm exec vitest run proxy.test.ts` → Expected: PASS (10 test).

- [ ] **Step 11: 👤 UTENTE — prova dal vivo**

Con `pnpm dev` avviato e Postgres/Redis locali accesi:

```bash
curl -s http://localhost:3000/api/health; echo
curl -s -w " %{http_code}\n" http://localhost:3000/api/health/ready
```

Expected: `{"status":"ok"}` e `{"ready":true,...} 200`. Poi ferma Redis locale e ripeti la seconda: `{"ready":false,"checks":{"database":"ok","redis":"error"}} 503` in circa 2 secondi. Riaccendi Redis. Incolla gli output.

- [ ] **Step 12: Commit**

```bash
git add lib/health app/api/health lib/redis/client.ts proxy.ts proxy.test.ts
git commit -m "feat: endpoint di liveness e readiness pubblici"
```

---

### Task 4: Cron come endpoint HTTP + Vercel Cron

`node-cron` dentro il processo Next non gira su Vercel (serverless) e su k8s con 2 repliche partirebbe due volte. I due job diventano route protette da `CRON_SECRET`; oggi le chiama Vercel Cron (che invia da solo `Authorization: Bearer $CRON_SECRET` se la variabile esiste nel progetto), dopo la migrazione un CronJob k8s con `curl`.

Nota di design: i sync girano dentro la richiesta (`maxDuration = 300`), non in `after()` + job su Redis. Lo standard "Operazioni lunghe" di CLAUDE.md riguarda operazioni avviate dall'utente che aspetta un feedback; qui nessuno guarda la risposta.

**Files:**
- Create: `lib/cron/auth.ts`
- Test: `lib/cron/auth.test.ts`
- Create: `app/api/cron/gocardless-sync/route.ts`
- Test: `app/api/cron/gocardless-sync/route.test.ts`
- Create: `app/api/cron/net-worth-snapshot/route.ts`
- Test: `app/api/cron/net-worth-snapshot/route.test.ts`
- Modify: `lib/gocardless/scheduler.ts` (rimuovi `node-cron` e `startGoCardlessScheduler`)
- Modify: `lib/net-worth/scheduler.ts` (rimuovi `node-cron`, `NET_WORTH_SNAPSHOT_CRON`, `startNetWorthScheduler`)
- Modify: `instrumentation.ts`
- Modify: `package.json` (via `pnpm remove`)
- Create: `vercel.json`

**Interfaces:**
- Consumes: `CRON_SECRET_MIN_LENGTH` da `lib/env.ts` (Task 2); `/api/cron` pubblico in `proxy.ts` (Task 3); `runDueSyncs(): Promise<void>` da `lib/gocardless/scheduler.ts`; `runDailySnapshots(today?: Date): Promise<void>` da `lib/net-worth/scheduler.ts`.
- Produces: `isAuthorizedCronRequest(authorizationHeader: string | null, secret: string | undefined): boolean`; `GET /api/cron/gocardless-sync` e `GET /api/cron/net-worth-snapshot` → 401 senza segreto valido, 200 `{ ok: true, durationMs }`, 500 `{ ok: false }` se il job lancia.

- [ ] **Step 1: Test di `isAuthorizedCronRequest`**

Crea `lib/cron/auth.test.ts`:

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

Run: `pnpm exec vitest run lib/cron/auth.test.ts` → Expected: FAIL (`./auth` non esiste).

- [ ] **Step 2: Implementa `lib/cron/auth.ts`**

```ts
import { timingSafeEqual } from "node:crypto";
import { CRON_SECRET_MIN_LENGTH } from "@/lib/env";

/**
 * Verifica `Authorization: Bearer <CRON_SECRET>` (inviato da Vercel Cron o dai CronJob k8s).
 * Confronto a tempo costante; senza segreto configurato, o se troppo corto, rifiuta sempre.
 */
export function isAuthorizedCronRequest(authorizationHeader: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < CRON_SECRET_MIN_LENGTH || !authorizationHeader) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorizationHeader);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
```

Run: `pnpm exec vitest run lib/cron/auth.test.ts` → Expected: PASS (3 test).

- [ ] **Step 3: Test della route di sync GoCardless**

Crea `app/api/cron/gocardless-sync/route.test.ts`:

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

- [ ] **Step 4: Test della route di snapshot patrimonio**

Crea `app/api/cron/net-worth-snapshot/route.test.ts`:

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

Run: `pnpm exec vitest run app/api/cron` → Expected: FAIL (le route non esistono).

- [ ] **Step 5: Implementa le due route**

`app/api/cron/gocardless-sync/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runDueSyncs } from "@/lib/gocardless/scheduler";

export const dynamic = "force-dynamic";
// I conti dovuti si sincronizzano dentro la richiesta: nessun utente aspetta la risposta, quindi
// niente job/after() (lo standard "Operazioni lunghe" riguarda le operazioni avviate dall'utente).
export const maxDuration = 300;

/** Cron di sync GoCardless dei conti dovuti (Vercel Cron oggi, CronJob k8s dopo la migrazione). Idempotente. */
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

/** Cron giornaliero degli snapshot patrimonio di tutti gli utenti con conti. Idempotente (upsert per giorno). */
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

Run: `pnpm exec vitest run app/api/cron` → Expected: PASS (6 test).

- [ ] **Step 6: Rimuovi gli scheduler in-process**

`lib/gocardless/scheduler.ts`: elimina `import cron from "node-cron";` (riga 1) e tutto il blocco finale da `let started = false;` alla fine del file (`startGoCardlessScheduler`).

`lib/net-worth/scheduler.ts`: elimina `import cron from "node-cron";`, la costante `NET_WORTH_SNAPSHOT_CRON` col suo commento, e il blocco finale da `let started = false;` alla fine (`startNetWorthScheduler`).

`instrumentation.ts` diventa:

```ts
/** Hook di boot Next.js: valida le variabili d'ambiente all'avvio del server (fallisce subito se ne manca una). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("@/lib/env");
    parseServerEnv(process.env);
  }
}
```

Poi:

```bash
pnpm remove node-cron @types/node-cron
grep -rn "node-cron\|startGoCardlessScheduler\|startNetWorthScheduler\|NET_WORTH_SNAPSHOT_CRON" --include=*.ts --include=*.tsx app lib components instrumentation.ts
```

Expected: nessun risultato.

- [ ] **Step 7: Aggiungi `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/gocardless-sync", "schedule": "0 5 * * *" },
    { "path": "/api/cron/net-worth-snapshot", "schedule": "50 21 * * *" }
  ]
}
```

Orari in UTC (Vercel Cron non supporta fusi orari): `21:50 UTC` = 23:50 in Italia d'estate, 22:50 d'inverno, e la data UTC coincide sempre con la data italiana del giorno che si chiude. Il sync è **giornaliero** perché il piano Hobby di Vercel rifiuta cron più frequenti di una volta al giorno (il deploy fallirebbe); su piano Pro il Task 8 lo porta a `0 5,17 * * *` (ogni 12h, come prima). `runDueSyncs` rispetta comunque il budget di 4 sync/giorno per conto.

- [ ] **Step 8: 👤 UTENTE — prova dal vivo**

Con `pnpm dev` avviato (sostituisci `<CRON_SECRET>` col valore nel tuo `.env.local`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/net-worth-snapshot
curl -s -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/net-worth-snapshot; echo
```

Expected: `401`, poi `{"ok":true,"durationMs":...}`. Poi apri `/panoramica`: il punto di oggi c'è. Non chiamare in locale `/api/cron/gocardless-sync` se non serve: consuma il budget giornaliero GoCardless dei conti collegati. Incolla gli output.

- [ ] **Step 9: Verifica e commit**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run lib/cron app/api/cron lib/env.test.ts` → Expected: PASS.

```bash
git add lib/cron app/api/cron lib/gocardless/scheduler.ts lib/net-worth/scheduler.ts instrumentation.ts package.json pnpm-lock.yaml vercel.json
git commit -m "feat: cron come endpoint protetti da CRON_SECRET, via node-cron"
```

---

### Task 5: Baseline Drizzle unica e marcata sui DB esistenti

Oggi `lib/db/migrations/` contiene solo `0000_silly_flatman.sql` di luglio: tutto ciò che è venuto dopo è stato applicato con `db:push` o SQL diretto, quindi le migration non descrivono più lo schema. Si genera **una nuova baseline** dallo schema TypeScript attuale, si verifica con `pg_dump` che i DB reali (sviluppo locale e Neon di produzione) coincidano con essa, e la si **marca come già applicata** su quei DB (una riga in `drizzle.__drizzle_migrations`), così `pnpm db:migrate` d'ora in poi applicherà solo le migration successive. Su un DB vuoto (CI, CNPG in Fase 4) `pnpm db:migrate` applica la baseline e basta.

Come ragiona il migrator di Drizzle (verificato in `node_modules/drizzle-orm/pg-core/dialect.js`): legge la riga di `drizzle.__drizzle_migrations` con `created_at` più alto e applica solo le migration il cui `when` nel journal è maggiore. L'hash non viene confrontato.

**Files:**
- Modify: `lib/db/client.ts:11`
- Delete: `lib/db/migrations/0000_silly_flatman.sql`, `lib/db/migrations/meta/0000_snapshot.json`, `lib/db/migrations/meta/_journal.json` (rigenerati)
- Create: `lib/db/migrations/0000_baseline.sql` (+ `meta/`), generati da drizzle-kit
- Create: `lib/db/baseline.ts`
- Test: `lib/db/baseline.test.ts`
- Create: `lib/db/mark-baseline.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: nulla dai task precedenti.
- Produces: `planBaselineMark(existingCreatedAts: number[], baselineWhen: number): "insert" | "already-marked"`; script `pnpm db:mark-baseline`; `pnpm db:migrate` funzionante anche senza `.env.local` (serve alla CI del Task 7 e all'immagine migrator del Task 6).

- [ ] **Step 1: 👤 UTENTE — prerequisiti**

1. Avvia **Docker Desktop** e verifica: `docker ps` (nessun errore).
2. Avvia il Postgres locale di sviluppo (quello di `DATABASE_URL` in `.env.local`) e verifica con `curl -s http://localhost:3000/api/health/ready` a `pnpm dev` avviato: `"database":"ok"`.
3. Dalla dashboard Neon (Connection details, **senza pooler**) copia la connection string di produzione non-pooled e verifica che contenga `sslmode=require`. Tienila a portata di mano: serve agli step 8 e 11, **non va incollata in chat né in file del repo**.

Incolla l'output dei punti 1-2 e scrivi solo "sslmode presente: sì/no" per il punto 3.

- [ ] **Step 2: SSL deciso dall'URL, non da `NODE_ENV`**

In `lib/db/client.ts` sostituisci la riga del client con:

```ts
// La cifratura della connessione la decide l'URL (`?sslmode=require` per Neon/CNPG, assente per il Postgres
// locale): un `ssl` esplicito qui vincerebbe sull'URL e impedirebbe di usare un Postgres locale senza TLS
// anche con NODE_ENV=production (es. il container Docker in prova).
export const client = postgres(connectionString);
```

- [ ] **Step 3: Test di `planBaselineMark`**

Crea `lib/db/baseline.test.ts`:

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

Run: `pnpm exec vitest run lib/db/baseline.test.ts` → Expected: FAIL (`./baseline` non esiste).

- [ ] **Step 4: Implementa `lib/db/baseline.ts`**

```ts
/** Cartella delle migration Drizzle (stesso valore di `out` in drizzle.config.ts). */
export const MIGRATIONS_FOLDER = "./lib/db/migrations";

/**
 * Decide se registrare la baseline come già applicata. Il migrator Drizzle applica solo le migration
 * con `when` maggiore del `created_at` più alto registrato, quindi basta una riga col `when` della baseline.
 */
export function planBaselineMark(existingCreatedAts: number[], baselineWhen: number): "insert" | "already-marked" {
  return existingCreatedAts.includes(baselineWhen) ? "already-marked" : "insert";
}
```

Run: `pnpm exec vitest run lib/db/baseline.test.ts` → Expected: PASS (3 test).

- [ ] **Step 5: Script `lib/db/mark-baseline.ts`**

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
 * Registra la baseline (prima migration del journal) come già applicata su un DB esistente,
 * il cui schema è stato verificato uguale alla baseline. Rilanciabile. Su un DB vuoto si rifiuta:
 * lì va usato `pnpm db:migrate`.
 */
async function main() {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")) as Journal;
  const baseline = journal.entries[0];
  const migrationSql = readFileSync(path.join(MIGRATIONS_FOLDER, `${baseline.tag}.sql`)).toString();
  // Stesso hash che calcola il migrator Drizzle (sha256 del file), per coerenza della tabella.
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

- [ ] **Step 6: Script in `package.json`**

Nella sezione `scripts`:
- sostituisci `db:migrate` con `"db:migrate": "tsx --env-file-if-exists=.env.local lib/db/migrate.ts"` (funziona anche in CI e nel container, dove `.env.local` non c'è; una variabile già presente nell'ambiente vince sul file);
- aggiungi `"db:mark-baseline": "tsx --env-file-if-exists=.env.local lib/db/mark-baseline.ts"`;
- **rimuovi** `db:push` (da ora lo schema cambia solo con migration versionate).

Aggiungi anche, a livello radice di `package.json`: `"packageManager": "pnpm@11.5.0",` (serve a CI e Docker per usare la stessa versione di pnpm).

- [ ] **Step 7: Rigenera la baseline**

```bash
git rm -q lib/db/migrations/0000_silly_flatman.sql lib/db/migrations/meta/0000_snapshot.json lib/db/migrations/meta/_journal.json
pnpm db:generate --name baseline
ls lib/db/migrations lib/db/migrations/meta
```

Expected: `0000_baseline.sql`, `meta/0000_snapshot.json`, `meta/_journal.json` con una sola entry. Leggi l'SQL generato: deve contenere tutte le tabelle di `lib/db/schema/` (incluse `net_worth_snapshots` e `categorization_rules`), l'enum `category_type` coi valori di `lib/categories/groups.ts` e il vincolo `transactions_account_external_id_unique`.

- [ ] **Step 8: 👤 UTENTE — confronto schema: baseline vs DB reali**

In Git Bash, nella root del repo. Crea un Postgres usa-e-getta, applicagli la baseline e confrontane lo schema con quello del DB di sviluppo e di Neon:

```bash
docker run -d --name bb-baseline -e POSTGRES_PASSWORD=baseline -p 55432:5432 postgres:17
sleep 5
DATABASE_URL=postgresql://postgres:baseline@localhost:55432/postgres pnpm db:migrate

mkdir -p /tmp/bb-schema
DUMP="pg_dump --schema-only --no-owner --no-privileges --schema=public"
# Toglie commenti, righe vuote e intestazioni che cambiano a ogni dump (versione, \restrict casuale).
clean() { grep -v -E '^(--|SET |SELECT pg_catalog)' | grep -v -E '^.(un)?restrict ' | grep -v '^$'; }

docker exec bb-baseline $DUMP -U postgres postgres | clean > /tmp/bb-schema/baseline.sql
docker run --rm postgres:17 $DUMP "<DATABASE_URL del DB locale, con host.docker.internal al posto di localhost>" | clean > /tmp/bb-schema/local.sql
docker run --rm postgres:17 $DUMP "<connection string Neon non-pooled>" | clean > /tmp/bb-schema/neon.sql

git diff --no-index --stat /tmp/bb-schema/baseline.sql /tmp/bb-schema/local.sql
git diff --no-index --stat /tmp/bb-schema/baseline.sql /tmp/bb-schema/neon.sql
```

Incolla l'output dei due `git diff --stat`. Se non sono vuoti, incolla anche `git diff --no-index /tmp/bb-schema/baseline.sql /tmp/bb-schema/neon.sql` (e/o `local.sql`): contiene solo nomi di tabelle/colonne/vincoli, nessun dato.

- [ ] **Step 9: Analisi delle differenze (regola di stop)**

Differenze **ammesse** senza intervento:
- l'**ordine delle colonne** in una tabella (colonne aggiunte a mano con `ALTER TABLE ADD COLUMN` finiscono in coda; Drizzle usa i nomi, non le posizioni);
- solo l'**ordine dei valori** dell'enum `category_type` (effetto della migrazione `db:migrate-category-groups`: rinomina e aggiunge valori in coda). Non influisce sui dati né sulle migration future, generate dallo snapshot TypeScript e non dal DB.

**Qualunque altra differenza** (tabella/colonna/indice/vincolo mancante o in più, tipo o default diverso, `NOT NULL` diverso): **stop**, non marcare la baseline su quel DB. Si analizza insieme all'utente e si decide caso per caso tra (a) correggere lo schema TypeScript perché il DB ha ragione, rigenerando la baseline (torna allo step 7), oppure (b) correggere il DB con SQL mirato approvato esplicitamente dall'utente (per Neon: backup/branch Neon prima). Il vincolo `transactions_account_external_id_unique`, che bloccava `db:push`, è il primo sospettato: va confrontato con attenzione.

- [ ] **Step 10: Verifica la baseline sul DB usa-e-getta e poi eliminalo**

La suite di test contro il DB appena creato dalla baseline dimostra che basta a far girare l'app (è esattamente ciò che farà la CI):

```bash
DATABASE_URL=postgresql://postgres:baseline@localhost:55432/postgres pnpm test 2>&1 | tail -8
```

Expected: stesso esito della suite contro il DB di sviluppo. Se ci sono test falliti, confronta con un'esecuzione di `pnpm test` sul DB di sviluppo: un test che fallisce **solo** sul DB vuoto dipende da dati preesistenti e va corretto nel Task 7 (step 1); uno che fallisce ovunque è un problema preesistente da portare all'utente prima di andare avanti.

Poi `docker rm -f bb-baseline`.

- [ ] **Step 11: 👤 UTENTE — marca la baseline sui DB esistenti**

Solo per i DB che hanno superato lo step 9:

```bash
pnpm db:mark-baseline
DATABASE_URL="<connection string Neon non-pooled>" pnpm db:mark-baseline
```

Expected: `Baseline 0000_baseline registrata come già applicata.` per entrambi. Poi la prova che il migrator non vuole riapplicare nulla:

```bash
pnpm db:migrate
DATABASE_URL="<connection string Neon non-pooled>" pnpm db:migrate
```

Expected: `Tabelle presenti: [...]` e `Migration completate.`, senza errori `already exists`. Incolla gli output.

- [ ] **Step 12: Commit**

```bash
git add lib/db/client.ts lib/db/baseline.ts lib/db/baseline.test.ts lib/db/mark-baseline.ts lib/db/migrations package.json
git commit -m "feat: baseline Drizzle unica, marcata sui DB esistenti; via db:push"
```

---

### Task 6: Immagine Docker (app + migrator)

**Files:**
- Modify: `next.config.ts`
- Create: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `/api/health` e `/api/health/ready` (Task 3); `pnpm db:migrate` senza `.env.local` e `packageManager` (Task 5); `lazyConnect` di Redis (Task 3).
- Produces: target Docker `runner` (app, `node server.js`, porta 3000, utente non-root) e `migrator` (`pnpm db:migrate`), usati dalla CI del Task 7 e dai manifest k8s di Fase 6.

- [ ] **Step 1: Output standalone**

In `next.config.ts` aggiungi come prima proprietà di `nextConfig`:

```ts
  // Build autosufficiente in .next/standalone (server.js + sole dipendenze usate): base dell'immagine Docker.
  // Vercel la ignora, quindi il deploy attuale non cambia.
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

# ---- base: Node + pnpm alla versione fissata in package.json ----
FROM node:24-alpine AS base
RUN npm install -g pnpm@11.5.0
WORKDIR /app

# ---- deps: dipendenze complete (servono a build e migrator) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: next build ----
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Valori FITTIZI solo per la build: alcuni moduli leggono l'env all'import (client DB/Redis, Resend,
# better-auth) e next build li importa. Non arrivano nell'immagine finale: lo stage runner parte da zero
# e l'env vero arriva a runtime (validato in instrumentation.ts).
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    REDIS_URL=redis://localhost:6379 \
    BETTER_AUTH_SECRET=build-only-placeholder-secret-0000000000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    RESEND_API_KEY=re_build_placeholder
RUN pnpm build

# ---- migrator: esegue le migration Drizzle (Job PreSync in k8s) ----
FROM deps AS migrator
COPY tsconfig.json drizzle.config.ts ./
COPY lib ./lib
USER node
CMD ["pnpm", "db:migrate"]

# ---- runner: immagine dell'app ----
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

Nota: `runner` è l'ultimo stage, quindi è il target di default di `docker build`.

- [ ] **Step 4: 👤 UTENTE — build delle due immagini**

```bash
docker build -t buddy-budget:local .
docker build --target migrator -t buddy-budget-migrate:local .
docker images | grep buddy-budget
```

Expected: entrambe le build finiscono senza errori. Incolla le ultime 15 righe della prima build e l'output di `docker images`. Se la build fallisce con un errore di variabile d'ambiente mancante letta all'import di un modulo, si aggiunge **solo** quella variabile, con valore fittizio, al blocco `ENV` dello stage `builder` e si rilancia: mai valori veri nel Dockerfile.

- [ ] **Step 5: 👤 UTENTE — prova il migrator e l'app contro un DB usa-e-getta**

```bash
docker network create bb-test
docker run -d --name bb-pg --network bb-test -e POSTGRES_PASSWORD=test postgres:17
docker run -d --name bb-redis --network bb-test redis:7
sleep 5
docker run --rm --network bb-test -e DATABASE_URL=postgresql://postgres:test@bb-pg:5432/postgres buddy-budget-migrate:local
```

Expected: `Migration completate.`

Crea `.env.docker` (gitignored grazie a `.env*`) copiando `.env.local` e cambiando: `DATABASE_URL=postgresql://postgres:test@bb-pg:5432/postgres?sslmode=disable` (opt-out esplicito: in produzione il client esige TLS salvo `sslmode` nell'URL), `REDIS_URL=redis://bb-redis:6379`. **Togli le virgolette** attorno ai valori: `docker --env-file` non le rimuove.

```bash
docker run -d --name bb-app --network bb-test -p 3000:3000 --env-file .env.docker buddy-budget:local
sleep 3
docker logs bb-app
curl -s http://localhost:3000/api/health; echo
curl -s http://localhost:3000/api/health/ready; echo
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
docker exec bb-app id
```

Expected: log senza `Variabili d'ambiente mancanti`; `{"status":"ok"}`; `{"ready":true,...}`; `200`; `uid=1001(nextjs)`. Apri anche `http://localhost:3000/login` nel browser: pagina con stili e logo. Incolla gli output.

Pulizia: `docker rm -f bb-app bb-pg bb-redis && docker network rm bb-test`.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts Dockerfile .dockerignore
git commit -m "feat: Dockerfile multi-stage (app standalone non-root + migrator)"
```

---

### Task 7: CI GitHub Actions + immagini su GHCR

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify (solo se emersi al Task 5 step 10): i test che dipendono da dati preesistenti del DB di sviluppo

**Interfaces:**
- Consumes: lint verde (Task 1); `pnpm db:migrate` senza `.env.local` (Task 5); target Docker `runner`/`migrator` (Task 6); `packageManager` (Task 5).
- Produces: check `check` obbligatorio su ogni PR; immagini `ghcr.io/yonderurik/buddy-budget:{main,sha-<sha>}` e `ghcr.io/yonderurik/buddy-budget-migrate:{main,sha-<sha>}` a ogni push su `main` (consumate in Fase 6 da ArgoCD).

- [ ] **Step 1: Test indipendenti dal DB di sviluppo**

Se il Task 5 step 10 ha trovato test che falliscono solo su un DB vuoto, correggili perché creino da soli i dati che usano (stesso pattern degli altri test di integrazione: utente con id `test-<nome>-${crypto.randomUUID()}` in `beforeEach`, cancellato in `afterEach`). Verifica rilanciando la suite contro un DB vuoto come al Task 5 step 10. Se non ne sono emersi, salta questo step.

- [ ] **Step 2: Workflow**

Crea `.github/workflows/ci.yml`:

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
    # Valori fittizi usati solo dai test: nessun servizio esterno viene contattato con queste credenziali.
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

(`docker/metadata-action` converte il nome del proprietario in minuscolo, come richiede GHCR.)

- [ ] **Step 3: Commit e push del branch**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, tipi, test su Postgres/Redis effimeri e immagini su GHCR"
git push -u origin fase-0-app-pronta
gh pr create --title "Fase 0: app pronta per la migrazione a VPS" --body "Piano: docs/superpowers/plans/2026-09-26-fase-0-app-pronta.md"
```

(Se `gh` non è autenticato, la PR la apre l'utente dalla pagina GitHub proposta dal push.)

- [ ] **Step 4: 👤 UTENTE — primo giro della CI**

Sulla PR, apri il tab **Checks**: il job "Lint, tipi e test" deve essere verde. Se è rosso, incolla il link al job o le righe di errore. Si corregge, si committa e si ripusha finché è verde. Il job `image` **non** parte sulla PR (solo su `main`): lo si verifica al Task 8.

- [ ] **Step 5: 👤 UTENTE — rendi la CI obbligatoria**

GitHub → repo → Settings → Rules → Rulesets (o Branches → Branch protection) su `main`: "Require status checks to pass" con il check **Lint, tipi e test**. Così nessun merge rompe `main`.

---

### Task 8: Rollout su Vercel e chiusura della fase

**Files:**
- Modify: `vercel.json` (solo se il piano Vercel è Pro)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: tutto quanto sopra.
- Produces: produzione Vercel con env validata, cron funzionanti, health raggiungibili; immagini su GHCR; CLAUDE.md aggiornato.

- [ ] **Step 1: 👤 UTENTE — piano Vercel**

Vercel → Settings → Billing: il progetto è su **Hobby** o **Pro**? Se Pro, in `vercel.json` porta il sync a ogni 12 ore (`"schedule": "0 5,17 * * *"`) e committa sulla PR (`chore: sync GoCardless ogni 12h su Vercel Pro`).

- [ ] **Step 2: 👤 UTENTE — variabili d'ambiente su Vercel (prima del merge)**

Vercel → progetto → Settings → Environment Variables, per gli ambienti **Production e Preview**:
1. aggiungi `APP_URL` = URL pubblico di produzione (es. `https://<dominio>`, senza slash finale);
2. aggiungi `CRON_SECRET` = un valore **nuovo** generato con `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` (non riusare quello locale);
3. verifica che `BETTER_AUTH_SECRET` abbia almeno 32 caratteri (se no: generane uno nuovo; effetto: tutti gli utenti dovranno rifare login);
4. verifica che `DATABASE_URL` contenga `sslmode=require` (se no: aggiungilo in coda con `?` o `&`);
5. verifica che esistano `REDIS_URL`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`.

**Non** rimuovere ancora `NEXT_PUBLIC_APP_URL`. Scrivi "fatto" con l'esito dei punti 3-5 (solo sì/no, mai i valori).

- [ ] **Step 3: 👤 UTENTE — deploy di preview della PR**

Vercel crea un deploy di preview per la PR: aprilo, controlla che il login si carichi e, nei Runtime Logs del deploy, che non ci sia `Variabili d'ambiente mancanti`. Poi `curl -s <url-preview>/api/health` → `{"status":"ok"}` (se la preview è protetta da Vercel Authentication, aprila nel browser da loggato invece di usare curl).

- [ ] **Step 4: Merge**

Con CI verde e preview ok: merge della PR su `main` (squash o merge commit, a scelta dell'utente), poi `git switch main && git pull --ff-only`.

- [ ] **Step 5: 👤 UTENTE — verifica in produzione**

```bash
curl -s https://<dominio>/api/health; echo
curl -s -w " %{http_code}\n" https://<dominio>/api/health/ready
curl -s -o /dev/null -w "%{http_code}\n" https://<dominio>/api/cron/net-worth-snapshot
```

Expected: `{"status":"ok"}`, `{"ready":true,...} 200`, `401`.

Poi Vercel → progetto → Settings → **Cron Jobs**: compaiono i due job; premi **Run** su `net-worth-snapshot` e controlla nei log la risposta 200 (idempotente: riscrive lo snapshot di oggi). Il sync GoCardless lascialo partire da solo alle 05:00 UTC; domani controlla nei log l'esito 200 e in Conti la data "Ultimo sync".

Infine GitHub → Actions: il workflow su `main` ha completato anche i due job **Immagine**, e in GitHub → profilo → Packages compaiono `buddy-budget` e `buddy-budget-migrate`.

- [ ] **Step 6: 👤 UTENTE — pulizia env**

Rimuovi `NEXT_PUBLIC_APP_URL` da Vercel (non è più letta da nessuna parte).

- [ ] **Step 7: Aggiorna CLAUDE.md**

1. Sezione **Comandi**: aggiungi
   ```
   pnpm test              # vitest (usa DATABASE_URL: DB di sviluppo, o un DB vuoto migrato)
   pnpm db:generate       # genera una migration dallo schema TypeScript (dopo ogni modifica a lib/db/schema)
   pnpm db:migrate        # applica le migration pendenti (DATABASE_URL da env o .env.local)
   pnpm db:mark-baseline  # una tantum: registra la baseline su un DB esistente già allineato
   docker build -t buddy-budget:local .   # immagine dell'app (target migrator: --target migrator)
   ```
2. Aggiungi una regola sotto "Regole per Claude": **Schema DB solo via migration versionate** — `db:push` non esiste più; ogni modifica allo schema = `pnpm db:generate` + migration committata + `pnpm db:migrate` sul DB di sviluppo, poi (finché si è su Neon) sul DB di produzione **prima** del merge che la usa.
3. Sostituisci la "Nota tecnica GoCardless" in Stato del progetto: il sync automatico non gira più da `instrumentation.ts` ma da `GET /api/cron/gocardless-sync` (Vercel Cron, orario in `vercel.json`); per un test manuale si chiama l'endpoint con `Authorization: Bearer $CRON_SECRET`. Rimuovi il "Debito noto" sul cron che non gira su Vercel (risolto).
4. In "Stato del progetto": Fase 0 completata; prossimo passo il piano della Fase 1 (account e fondamenta).
5. Log delle decisioni: voce 2026-09-26/data di completamento con le scelte di questa fase (APP_URL runtime, cron giornaliero su Hobby, baseline marcata, SSL deciso dall'URL, differenze di schema trovate e come sono state risolte).

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md aggiornato a fine Fase 0"
git push
```
