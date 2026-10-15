# Conti screen (v1)

**Date**: 2026-07-04
**Status**: approved

## Context

Design system, layout shell and authentication are complete (see the decision log in `CLAUDE.md`). This is the first real domain screen of the app. `docs/functional-spec.md` (section 2, "Conti" — Accounts) already defines what the mockup does and the decisions for the real product; this spec turns them into an implementable technical design.

## What this spec covers

- API (Route Handlers) for account CRUD, scoped per user
- Client data fetching/mutation layer (TanStack Query, new dependency)
- Input validation (Zod, new dependency)
- UI components in `components/domain/accounts/` and the page `app/(app)/conti/page.tsx`
- Handling of "Auto" accounts (read-only + "Scollega" — "Disconnect" — action) next to manual accounts
- Empty/loading/error states, confirmation on destructive actions
- Testing strategy

## What it does NOT cover (out of scope)

- **Real banking integration** (Open Banking/PSD2): stays entirely out of scope. In v1 "Auto" accounts have no way to be created automatically — the UI to manage them (badge, read-only, "Scollega") is built ahead of time, ready for when a real integration exists, but in the meantime an "Auto" account can only exist if inserted manually into the DB (e.g. for tests).
- **"Patrimonio netto" (net worth) KPI**: deferred until the Investimenti, Debiti and Immobile entities exist. v1 shows "Patrimonio netto (solo liquidità)" (net worth, cash only) as an explicitly labelled substitute, so as not to promise a figure that is not real yet.
- Search/pagination/filters on the account list: not needed at the expected volume (few accounts per user).
- Editing the bank/type of Auto accounts: they stay derived from the source, not editable (only "Scollega").

---

## 1. Data model

No schema changes. `lib/db/schema/accounts.ts` already covers all the needed fields:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | text, FK → `auth_user.id`, cascade | |
| `name` | text, not null | |
| `institution` | text, nullable | used for the initials shown in the UI |
| `type` | text, not null | free text; the UI offers a select with common options + free input |
| `balance` | numeric(12,2), not null, default 0 | |
| `source` | enum `manuale` / `auto`, default `manuale` | |
| `created_at` / `updated_at` | timestamp | |

The initials shown in the UI (e.g. "BN" for "Banca Nazionale") are derived client-side from `institution` (or from `name` if `institution` is empty) — no dedicated column is needed.

## 2. API — Route Handlers

Pattern followed: `app/api/user/onboarding/route.ts` (session via `auth.api.getSession`, scoping by `userId`, no trust in body data beyond the session id).

**`app/api/accounts/route.ts`**
- `GET`: list of the authenticated user's accounts, sorted by `createdAt` ascending. 401 if not authenticated.
- `POST`: creates a manual account (`source` always `manuale`, not settable by the client). Validates the body with Zod (`createAccountSchema`). 400 on failed validation, 401 on missing session.

**`app/api/accounts/[id]/route.ts`**
- `PATCH`: updates `name`/`institution`/`type`/`balance`. If the account is `source: auto`, rejects with 403 (no editable field on an Auto account — only deletion/disconnect is allowed). Checks that the account belongs to the user (404 otherwise, not 403, so as not to reveal the existence of other people's accounts).
- `DELETE`: deletes the account (used both for "delete manual account" and "disconnect auto account" — the same operation on the data side, different wording only in the UI). Checks ownership.

Shared validation in `lib/validation/accounts.ts` (Zod), used both in the Route Handlers and (same schemas) for client validation before sending.

## 3. Client data layer — TanStack Query

New dependency (`@tanstack/react-query`), to be added: it was already planned in the architecture of `2026-07-03-tech-stack-architecture-design.md` but not yet installed.

- `QueryClientProvider` mounted in `app/layout.tsx` (root, above `ThemeProvider`).
- `lib/queries/accounts.ts`:
  - `useAccountsQuery()` → `GET /api/accounts`
  - `useCreateAccountMutation()` → `POST /api/accounts`, invalidates the list query on success
  - `useUpdateAccountMutation()` → `PATCH /api/accounts/:id`, invalidates the list query
  - `useDeleteAccountMutation()` → `DELETE /api/accounts/:id`, invalidates the list query

No optimistic updates in v1: the list is small, a refetch after a mutation is instantaneous (YAGNI — optimistic updates will be introduced only if perceived latency becomes a real problem).

## 4. UI components

`domain` layer (domain logic, composes `ui` primitives), page in `app/(app)/conti/`.

- **`components/domain/accounts/accounts-kpi.tsx`** — 2 KPI cards: "Liquidità totale" (total cash, sum of balances), "Patrimonio netto (solo liquidità)" (same value, explicit label), computed client-side with `useMemo` from the list already in cache. "Conti collegati" (connected accounts) count as a third value (number of rows).
- **`components/domain/accounts/account-row.tsx`** — single row: institution initials, name, "bank · type", Auto/Manuale badge (`components/ui/badge.tsx`, already existing), balance formatted according to `authUser.currency` (`Intl.NumberFormat`). Manual account → name/institution/type/balance editable inline (saved `onBlur` if the value changed and is valid). Auto account → read-only fields, "Scollega" button instead of inline saving.
- **`components/domain/accounts/add-account-form.tsx`** — "+ Aggiungi conto" (add account) form: name, institution (optional), type (select + free), initial balance. Submit → `useCreateAccountMutation`.
- **`components/ui/alert-dialog.tsx`** — new, to be added via `pnpm dlx shadcn@latest add alert-dialog`. Reused for confirmation on "delete manual account" and "disconnect auto account".
- **`app/(app)/conti/page.tsx`** — orchestrates: `useAccountsQuery`, rendering of KPIs + list + form, loading/error/empty states. No business logic here (composition only), consistent with the `CLAUDE.md` rule on route files.

## 5. States and validation

- **Loading**: skeletons for the account rows (no full-page spinner).
- **Empty** (no accounts): an explanatory message above the "+ Aggiungi conto" form, which stays visible and usable anyway.
- **Error** (failed fetch or mutation): inline banner with the error text + "Riprova" (retry) action. No global toast system (not in the stack; to be evaluated if a cross-cutting need emerges in several screens).
- **Validation**: balance/amounts accept both comma and dot as decimal separator, converted before sending; name not empty; type not empty (from select or free). The same Zod validation on the client (immediate feedback, before the network call) and on the server (source of truth, not bypassable).
- **Mandatory confirmation** (via `alert-dialog`) before: deleting a manual account, disconnecting an Auto account. Same component, different text.

## 6. Testing

- **Unit**: Zod schemas of `lib/validation/accounts.ts` (valid/invalid cases: negative balance allowed or not, empty name, empty type); KPI calculation function (`accounts-kpi`).
- **Integration**: Route Handlers with a real DB, a pattern already used in `lib/db/integration.test.ts` — covers: 401 without session, per-user scoping (a user does not see/edit another user's accounts), full CRUD on a manual account, rejection of `PATCH` on an Auto account (403), `DELETE` working on both manual and auto.
- **E2E**: not planned for this phase (no E2E framework in the current stack).

## Implications for later phases

- When Investimenti/Debiti/Immobile exist, the real "Patrimonio netto" calculation will replace the current "(solo liquidità)" one — probably in a shared calculation engine (see `docs/functional-spec.md`, section "Implicazioni per il modello dati reale"), not recomputed locally in this screen.
- When a real banking integration arrives, the creation flow of "Auto" accounts (absent today) will have to be defined: this spec only guarantees that the consuming UI (badge, read-only, disconnect) is already ready.
