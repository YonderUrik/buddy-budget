# Start (first-steps checklist & sample data)

Feature area(s): Overview (Panoramica) "first steps" checklist card; "Explore with sample data" (demo mode) start/clear banner
Source: `app/api/start/route.ts`, `app/api/start/demo/route.ts`, `lib/start/{steps,status,demo,demo-data}.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | `/api/start` | Checklist status + whether demo data is active | session | — |
| PATCH | `/api/start` | Dismiss / reopen the checklist | session | — |
| POST | `/api/start/demo` | Create sample data (2 accounts + transactions + liquidity history) | session | only for users with no accounts |
| DELETE | `/api/start/demo` | Remove all sample data | session | idempotent |

## GET /api/start
Route name: `start.get` · Auth: session cookie required

**Response** `200`
```ts
type StartStepId = "conto" | "import" | "investimento" | "debito" | "pensione" | "obiettivo";
type StartFocusId = "spese" | "investimenti" | "debiti" | "pensione";
interface StartStatus {
  steps: Record<StartStepId, boolean>;
  stepIds: StartStepId[];       // the steps asked to this user, in order (`startStepsFor(focus)`, web #444)
  focus: StartFocusId[] | null; // «Cosa vuoi tenere sotto controllo?»; null = never chosen (default four steps)
  skipped: StartStepId[];       // «Non mi serve» (web #452); `conto` can never be skipped
  dismissed: boolean;     // user closed the checklist
  completed: boolean;     // every asked step done or skipped
  demoActive: boolean;    // sample (isDemo) accounts exist
  justCompleted?: true;   // present only on the first call that sees the checklist complete
}
```
Step rules (computed from real data; demo accounts excluded):
- `conto`: at least one non-demo account.
- `import`: at least one real transaction on a non-demo account (bank sync **or** a personal CSV/Excel import, web #452).
- `investimento`: at least one investment transaction.
- `debito` / `pensione`: at least one debt / pension fund.
- `obiettivo`: at least one budget OR non-empty `analytics_assumptions.data`.

Asked steps follow the focus: always `conto`, then one per focus answer (`spese`→`import`, `investimenti`→`investimento`,
`debiti`→`debito`, `pensione`→`pensione`, only where the pension section exists), then `obiettivo`; no focus = the
original four. An older server without `stepIds` means the default four (apps: `StartStatus.askedSteps`).
The apps re-read this every 15 s while the checklist is incomplete and in the foreground (OV-038), and after any
import, sync or edit; a step that becomes done is announced once per device (SHELL-060, key `bb:start-seen-done`).

Web visibility rule (`shouldShowChecklist`): show when `!dismissed && !completed && !demoActive`.
Step definitions (title/description/CTA/target/done text, Italian, web paths) live in `START_STEPS` in `lib/start/steps.ts`
and are mirrored by `StartChecklist` in both apps.

```json
{ "steps": { "conto": true, "import": false, "investimento": false, "debito": false, "pensione": false, "obiettivo": false },
  "stepIds": ["conto", "import", "investimento", "obiettivo"], "focus": null, "skipped": [],
  "dismissed": false, "completed": false, "demoActive": false }
```

**Side effects**: on first completion writes `startChecklistCompletedAt` on the user (GET has a write side effect) and records metric/log `onboarding.start.completed`.

## PATCH /api/start
Route name: `start.update` · Auth: session cookie required

**Request body** — exactly one of:
- `{ "dismissed": boolean }` — close or reopen the checklist (OV-036);
- `{ "focus": StartFocusId[] }` — new focus, the asked steps change right away (OV-047);
- `{ "step": StartStepId, "skipped": boolean }` — «Non mi serve» / «Rimetti» (OV-046); `400 { error: "Questo passo non si può saltare" }` for `conto`.

**Response** `204`.

**Errors**: `401` empty; `400 { error: "Dati non validi" }` (fixed message).

**Side effects**: sets/clears `startChecklistDismissedAt`; metric `checklist_dismissed` / `checklist_reopened`.

## POST /api/start/demo
Route name: `start.demo.start` · Auth: session cookie required · `maxDuration = 30`

**Request body**: none.

**Response** `201 { "accounts": number, "transactions": number }` — counts created (accounts = 2: "Conto corrente · demo", "Risparmi · demo").

**Errors**
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 409 | `{ error: "I dati d'esempio sono già attivi." }` | demo already active |
| 409 | `{ error: "Hai già dei conti: i dati d'esempio sono per chi parte da zero." }` | user has any account |
| 409 | `{ error: "Completa prima la configurazione iniziale." }` | user has no categories (onboarding not done) |

No `code` field on these 409s (unlike the `demo_active` guard).

**Side effects**: inserts 2 accounts with `isDemo: true` (source `manuale`), transactions on the checking account mapped to the user's categories by name, and `net_worth_snapshots` (`assetClass: "liquidita"`, `source: "derivato"`). While demo is active, write routes guarded by `rejectIfDemoActive` return `409 { error: "Stai esplorando i dati d'esempio: azzerali per aggiungere i tuoi.", code: "demo_active" }` (e.g. `POST /api/gocardless/connections`, `POST /api/accounts`).

## DELETE /api/start/demo
Route name: `start.demo.clear` · Auth: session cookie required

**Response** `204` (also when there was nothing to remove).

**Side effects**: deletes demo accounts, their transactions, and ALL `liquidita` net-worth snapshots of the user.

**Mobile notes**: after start/clear, invalidate accounts, transactions, net worth, overview and `/api/start`.
