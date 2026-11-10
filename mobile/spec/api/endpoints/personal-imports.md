# Personal imports (AI-read CSV / statement files)

Feature area(s): Imports (`/importazioni`: "import any file" upload, status list, review of unrecognized rows, receipt, correction of a completed import, deletion of an import); global import "island" (progress pill); Investments > broker import "AI fallback" (`components/domain/investments/import/ai-fallback.ts`) and import management (delete)
Source: `app/api/personal-imports/route.ts`, `app/api/personal-imports/[id]/route.ts`, `lib/personal-import/*` (contract, jobs, worker, confirm, correction, delete, analysis, island), `lib/db/schema/personal-imports.ts`, web client `lib/queries/personal-imports.ts`, `components/domain/personal-import/*`

## How it works (job model — NOT the Redis sync-jobs)
- Upload = the whole file as a JSON string. The server encrypts it (`PERSONAL_CSV_ENCRYPTION_KEY`) into a `personal_import_jobs` row with `status: "queued"` and returns `202 { id }`.
- A separate long-running worker process (`scripts/personal-csv-worker.ts`, loop every 5 s) claims jobs, asks an LLM (OpenRouter, consent `openrouter-raw-zdr-v3`) to generate a parser for this "format" (or reuses a saved parser of the same format), runs it in a sandbox, resolves FX rates, and stores an encrypted preview.
- Jobs without unrecognized rows go to `ready` and are then **imported automatically** by the worker (`maintainJobs` → `confirmImport`), ending in `imported`. Jobs with unrecognized rows go to `review_failed` and wait for the user. Corrections go to `correction_ready` and wait for the user.
- The worker also emails the user (Resend) when a job reaches `imported` / `review_failed` / `failed` / `correction_ready`, with link `{APP_URL}/importazioni?job={id}`.
- Progress is observed by polling `GET /api/personal-imports` (web: every `3000` ms while any job is in a running state). There is no jobId/sync-jobs integration.

### Job status enum (free text column; values used in code)
| status | meaning | web label (`personalImportLabels`) | island state |
|---|---|---|---|
| `queued` | waiting for the worker (also retry after a failure, with `availableAt` backoff) | "In attesa di analisi" | running |
| `processing` | worker has the lease (5 min) | "Stiamo analizzando il CSV" | running |
| `ready` | analysis OK, auto-import pending | "Salvataggio in corso" | running |
| `imported` | data written | "Importato" | done |
| `review_failed` | some rows unrecognized (or financial validation failed at save) → user action | "Righe da controllare" | failed |
| `failed` | analysis failed after 3 attempts or model rejected input | "Analisi non riuscita" | failed |
| `correction_ready` | a correction analysis is ready to compare/confirm | "Correzione da confermare" | review |
| `expired` | 7 days passed (`expiresAt`), file and preview deleted | "File scaduto" | hidden |

Limits: file ≤ 25 MB (`MAX_BYTES`, UTF-8 bytes) and ≤ 50 000 lines (`MAX_ROWS`); per user max 2 jobs `queued|processing` and max 10 uploads per rolling 24 h; job `estimatedAt` = created + 1 h; `expiresAt` = created + 7 days.

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/personal-imports` | List formats ("sources") and jobs | session | `Cache-Control: no-store`; poll target |
| POST | `/api/personal-imports` | Upload a file (new import, reuse format, correction, broker AI fallback) | session + **Origin check** | `202 { id }` (DB job, worker) |
| GET | `/api/personal-imports/{id}` | Preview of the analysed rows | session | `no-store` |
| GET | `/api/personal-imports/{id}?correction=1` | Before/after comparison of a correction | session | `no-store` |
| GET | `/api/personal-imports/{id}?deletion=1` | Deletion summary + confirmation token | session | `no-store` |
| POST | `/api/personal-imports/{id}` | Confirm / import skipping errors / reanalyze / replace with correction / discard correction | session + **Origin check** | `reanalyze` → `202 { id }` |
| DELETE | `/api/personal-imports/{id}` | Delete an import (and its transactions/trades) with token | session + **Origin check** | — |

No demo guard, no country gate.

### IMPORTANT: Origin header check (POST and DELETE)
```ts
if (request.headers.get("origin") !== new URL(process.env.APP_URL ?? request.url).origin) return 403 (empty body)
```
**Update (branch `feat/mobile-api-foundations`, auth.md R8):** the check is now `isTrustedWriteOrigin(request)` (`lib/http/same-origin.ts`): a request with `Authorization: Bearer …` and **no `Cookie` header** passes without `Origin`; cookie requests (the web, or a bearer request that also sends cookies) still need `Origin` == APP_URL origin, else **403 empty**. Native clients that send no cookies need nothing extra. Until the branch is deployed, send `Origin: <scheme://host[:port] of APP_URL>` (e.g. `Origin: https://app.buddybudget.io`) on POST/DELETE as a workaround. (The proxy's gate 403s now carry a JSON `code`, so an empty 403 here means the Origin check.)

---

## GET /api/personal-imports
Route name: `personal_import.list` · Auth: session cookie required

**Response** `200` (`Cache-Control: no-store`)
```ts
interface PersonalImportListing {
  formats: Array<{ id: string; name: string }>;     // user's sources, newest first
  jobs: Array<{                                     // ALL jobs of the user, newest first (no pagination)
    id: string;                 // uuid
    formatId: string;           // uuid
    status: string;             // see status table
    correctionOf: string | null;// uuid of the imported job this corrects
    estimatedAt: string;        // ISO
    expiresAt: string;          // ISO
    createdAt: string;          // ISO
    error: string | null;       // Italian user-facing message (e.g. "3 righe su 120 non sono state riconosciute. Puoi importare le altre 117, …")
    notifiedAt: string | null;  // ISO; email sent
    results: {                  // only after import
      cash: number; investments: number; skipped: number;
      bankCategorized?: number; // rows that took the bank's own category from the file (web #456, CAT-098)
      rows?: number;            // financial rows in the file
      alreadyPresent?: number;  // rows already imported before (web #461): rows == alreadyPresent → «Niente di nuovo»
    } | null;                   // older jobs lack the three optional counts
  }>;
}
```
```json
{ "formats": [{ "id": "f1…", "name": "Revolut" }],
  "jobs": [{ "id": "j1…", "formatId": "f1…", "status": "imported", "correctionOf": null,
             "estimatedAt": "2026-10-18T10:30:00.000Z", "expiresAt": "2026-10-25T09:30:00.000Z",
             "createdAt": "2026-10-18T09:30:00.000Z", "error": null, "notifiedAt": "2026-10-18T09:32:10.000Z",
             "results": { "cash": 118, "investments": 0, "skipped": 0 } }] }
```

## POST /api/personal-imports
Route name: `personal_import.enqueue` · Auth: session; `Origin` == APP_URL origin unless bearer-only (no `Cookie`)

**Request body** (`application/json`; raw body size cap `MAX_BYTES*2 + 65536` ≈ 50 MB + 64 KB → 413)
```ts
interface EnqueueBody {
  csv: string;                 // the WHOLE file as text, 1..26_214_400 chars; ≤ 25 MB UTF-8 and ≤ 50 000 lines
  name: string;                // trimmed 1..80 — the source/format name (e.g. bank name); for reuse send the format's name
  formatId?: string;           // uuid — reuse an existing format (its saved parser; no new AI call if it still works)
  regenerate?: boolean;        // force a new AI analysis even if a parser exists
  brokerFallback?: boolean;    // broker statement the deterministic importer failed to read (investments flow)
  correctionOf?: string;       // uuid of an IMPORTED job to correct (requires feedback)
  feedback?: string;           // trimmed 1..2000 — what was wrong (required with correctionOf)
  consent: true;               // explicit consent to send the raw file to the AI provider
  consentVersion: "openrouter-raw-zdr-v3";
}
```
Web reads `.csv`/`.txt` as text; `.xlsx` (≤ 5 MB) is converted to CSV client-side; `.xls` is rejected client-side.

**Response** `202` — `{ "id": "<job uuid>" }`. For `brokerFallback` with an identical file already uploaded (same fingerprint, job not failed/expired) and `regenerate` not set, the EXISTING job id is returned (idempotent).

**Errors**
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 403 | empty | `Origin` missing/mismatch on a cookie request |
| 503 | `{ error: "Importazione personalizzata non ancora configurata" }` | server lacks `PERSONAL_CSV_ENCRYPTION_KEY` |
| 400 | empty | no request body stream |
| 413 | `{ error: "File troppo grande" }` | body over the cap |
| 400 | `{ error: "Richiesta non valida" }` | invalid JSON |
| 400 | `{ error: "Nome, CSV e consenso sono obbligatori" }` | any schema failure (fixed message) |
| 400 | `{ error: <ImportError message> }` | business rule, e.g. "Il file supera 25 MB", "Il file è vuoto", "Il file supera 50000 righe", "Limite raggiunto: massimo 2 analisi in corso e 10 caricamenti al giorno", "Formato non disponibile", "Descrivi il problema di un’importazione completata", "C’è già una correzione da controllare per questa importazione", "Il file è leggibile: completa la procedura del broker e verifica gli eventuali errori indicati." |
| 409 | `{ error: "Questo file è già stato importato: i suoi movimenti ci sono già tutti.", code: "already_imported" }` | the same file was already imported (web #461, IMP-062): the apps show it as a notice, not an error |
| 400 | `{ error: "Impossibile caricare il CSV" }` | any other server error (note: 400, not 500) |

**Side effects**: inserts `personal_import_jobs` (+ `personal_formats` when new). Raw file stored encrypted until analysis ends. Later (worker): OpenRouter LLM call, FX rate download, `transactions` (source `"manuale"`, `externalId: "personal:{formatId}:{rowKey}"`), possibly a new account `"<format name> · CSV"` (type `"conto"`) and investment portfolio, instruments, balance update, receipts, automatic categorization, email. Web client tracks `personal_csv_requested { reuse }`.

## GET /api/personal-imports/{id}
Route name: `personal_import.preview` · Auth: session cookie required

**Path params**: `id` uuid (invalid → `404` empty).

### Without query → preview
**Response** `200` (`no-store`) — available while the job has an encrypted preview and is not expired (statuses `ready`, `review_failed`, `correction_ready`; cleared after import).
```ts
interface Preview {
  headers: string[];            // ["Riga originale"] (raw line layout)
  currency: string;             // user's currency at analysis time
  records: Array<{
    key: string;                // "<sha>:<occurrence>"
    source: string[];           // original line(s), usually exactly 1
    line?: number;              // 1-based line number in the file
    rate: number | null;        // FX rate to the user's currency
    outcome:
      | { row: number; kind: "cash"; date: string /*YYYY-MM-DD*/; currency: string; description: string; amount: number; transfer: boolean }
      | { row: number; kind: "investment"; date: string; currency: string; description: string;
          type: "acquisto" | "vendita" | "dividendo" | "cedola"; name: string; isin: string | null;
          instrumentType: "azione" | "etf" | "fondo" | "crypto" | "etc" | "obbligazione";
          quantity: number; price: number; grossAmount: number | null; fees: number; taxes: number }
      | { row: number; kind: "ignore" | "error"; reason: string };
  }>;
}
```
Amounts here are JSON **numbers** in the ORIGINAL currency (multiply by `rate` for user currency).
**Errors**: `404 { error: "Anteprima non disponibile" }`.

### `?correction=1` → correction comparison
Only for a job with `correctionOf` in status `correction_ready`.
```ts
interface CorrectionComparison {
  currency: string;
  before: Array<{ date: string; description: string; amount: number }>;          // current cash rows of the original import
  tradesBefore: Array<{ date: string; description: string; currency: string; grossAmount: number | null;
                        type: string; quantity: number; price: number; fees: number; taxes: number }>;
  after: Array<{ date: string; description: string; amount: number /* user currency, 2 decimals */;
                 investment: null | { type: string; quantity: number; price: number; fees: number; taxes: number; currency: string; grossAmount: number | null } }>;
  investmentsBefore: number;
  investmentsAfter: number;
}
```
**Errors**: `422 { error }` e.g. "Correzione non disponibile o scaduta", "L’importazione originale è cambiata. Scarta questa analisi e avvia una nuova correzione.", fallback "Confronto non disponibile".

### `?deletion=1` → deletion summary
```ts
interface DeletionSummary {
  token: string;            // 64 hex chars; must be sent back to DELETE (optimistic concurrency)
  name: string;             // format name
  cashCount: number;        // transactions that will be deleted
  investmentCount: number;  // investment operations that will be deleted
  uploads: Array<{ id: string; createdAt: string }>;
}
```
**Errors**: `422 { error }` ("Importazione non disponibile", "Formato non disponibile", …; fallback "Impossibile verificare l’importazione").

## POST /api/personal-imports/{id}
Route name: `personal_import.confirm` · Auth: session cookie + `Origin` check · `maxDuration = 60`

**Request body** (optional JSON). Empty body = plain confirm. Otherwise:
```ts
type ImportAction =
  | { action: "import_skipping_errors" }   // job in ready/review_failed: unrecognized rows become "ignore" ("Saltata: …")
  | { action: "reanalyze"; consent: true; consentVersion: "openrouter-raw-zdr-v3" }  // job in review_failed, not a correction
  | { action: "replace_import" }           // job is a correction in correction_ready: delete original + import this
  | { action: "discard_correction" };      // drop a not-yet-confirmed correction
```

**Responses**
| Case | Status | Body |
|---|---|---|
| confirm / `import_skipping_errors` | 200 | `{ inserted: number, duplicates: number, skipped: number }` or `{ inserted: 0, alreadyImported: true }` |
| `replace_import` | 200 | same as confirm, or `{ inserted: 0, alreadyImported: true, skipped: 0 }` |
| `reanalyze` | 202 | `{ id: "<new job uuid>" }` (old job is deleted) |
| `discard_correction` | 200 | `DeletionSummary` (see above) of what was discarded |

**Errors**
| Status | Body | When |
|---|---|---|
| 401 / 403 | empty | no session / Origin mismatch |
| 404 | empty | invalid uuid |
| 400 | `{ error: "Azione non valida" }` | invalid JSON or unknown action |
| 422 | `{ error: <ImportError message> }` | e.g. "Anteprima non disponibile o scaduta", "Ci sono righe non riconosciute", "La valuta del profilo è cambiata: carica nuovamente il CSV", "Una riga già importata ha una nuova interpretazione…", "Lo storico vende più quote di quelle possedute…", "Rianalisi non disponibile: carica di nuovo il file", "Limite raggiunto: …"; fallback "Importazione non riuscita: nessuna modifica salvata" |

**Side effects**: inserts transactions / investment transactions / receipts, may create account + portfolio + instruments, updates account balance (numeric string), marks job `imported` (raw data wiped); after success runs `categorizeNewMovementsSafely(userId)` in `after()`. Web tracks `personal_csv_imported`, `personal_csv_review_action`.

## DELETE /api/personal-imports/{id}
Route name: `personal_import.delete` · Auth: session cookie + `Origin` check

**Request body**: `{ "token": "<64 hex from GET ?deletion=1>" }`

**Response** `200` — `DeletionSummary` of what was deleted.

**Errors**: `401`/`403` empty; `404` empty (bad uuid); `400 { error: "Conferma non valida" }`; `422 { error }` e.g. "L’importazione è cambiata. Chiudi e riapri la conferma per verificare i dati aggiornati.", "Altre operazioni vendono quote acquistate con questo import. …"; fallback "Eliminazione non riuscita: nessuna modifica salvata".

**Side effects**: deletes the import's transactions and investment operations (by ledger ids, including later manual edits), reverses the account balance by the current amounts, deletes receipts and the job row(s). Serializable transaction.

## Mobile notes
- Send `Origin` header on POST/DELETE (see above).
- Upload is a single JSON request with the file content as a string (not multipart). For large files expect a long upload; the server reads the stream fully before parsing.
- Poll `GET /api/personal-imports` every ~3 s while any job is `queued|processing|ready`; stop otherwise. Users also get an email with a web link `/importazioni?job={id}` — consider a universal/app link for that path.
- `reanalyze` and new uploads require re-showing the AI consent (raw file sent to OpenRouter with zero-data-retention).
- Preview amounts are numbers (not strings) and in source currency — different from the rest of the API (numeric strings).

## Cross-cutting observations
- Distinct job model: DB rows + external worker, response `{ id }` (not `{ jobId }`), polled via the list endpoint.
- Origin check makes these routes unusable from native clients unless they spoof `Origin`.
- Error codes: 400 for upload failures (even unexpected), 422 for business-rule failures on `{id}` routes; no `code` fields.
- `Cache-Control: no-store` explicitly set on GETs.
