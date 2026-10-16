# Transaction notes + improved categorisation via additional GoCardless fields

Date: 2026-07-26

## Problem

Transactions imported from GoCardless today store `description` = `remittanceInformationUnstructured`, often full of transaction codes/references that do not match the real name of the shop (e.g. `"PAYPAL *NETFLIX 4471"`, different branches of the same chain with different text). This:

1. Makes it hard for the user to remember afterwards where they spent the money.
2. Worsens the reliability of both automatic categorisation at sync time (`lib/gocardless/categorize.ts`, exact match on description) and the "Categorizza automaticamente" ("Categorise automatically") wizard (`lib/calc/categorize-suggestions.ts`, Jaccard similarity on description tokens).

When the bank provides it, GoCardless also exposes `creditorName`/`debtorName`: the clean name of the counterparty, not affected by the codes that appear in `remittanceInformationUnstructured`. None of these fields is read today by `lib/gocardless/client.ts` (`BankTransaction`, lines 189-195).

## Goal

- Use `creditorName`/`debtorName` (when available) as the `description` shown and used for matching, with a fallback identical to the current behaviour when the bank does not provide them.
- Add a free note field per transaction, editable by the user regardless of the source (auto/manual), to annotate what an expense refers to.
- No change to the existing matching algorithms (exact match in `categorize.ts`, Jaccard in `categorize-suggestions.ts`): they automatically benefit from a cleaner input.

## Out of scope

- Backfill of auto transactions already synced (they keep the raw `description` already saved). Reason: very tight GoCardless sandbox rate limit (~4 calls/day per endpoint/account, see the note in `CLAUDE.md`); only new syncs benefit from the additional fields.
- `remittanceInformationStructured`, `additionalInformation`, `proprietaryBankTransactionCode`: not requested, not added in this plan.
- Changes to the similarity algorithm itself (Jaccard threshold, tokenisation): it stays unchanged, only the input it receives changes.

## Data model

`lib/db/schema/transactions.ts` — two new nullable columns:

- `rawDescription: text` — the original raw `remittanceInformationUnstructured` text as received from GoCardless, when available. `null` for manual transactions and for auto transactions where GoCardless does not even provide this field. It serves **only** to be shown in a tooltip/detail when `description` has been replaced by the clean name — never used in matching.
- `note: text` — the user's free note. `null` by default. Editable on both auto and manual transactions (no ownership constraint different from the one already existing on `PATCH /api/transactions/[id]`).

No backfill migration on existing rows: the columns are nullable, existing rows keep both at `null`.

## GoCardless client (`lib/gocardless/client.ts`)

`BankTransaction` adds two optional fields:

```ts
export interface BankTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  bookingDate: string;
  creditorName?: string;
  debtorName?: string;
}
```

No other change to the client: they are already present in GoCardless's `/accounts/{id}/transactions/` response when the bank exposes them, no new request parameter is needed.

## Sync (`lib/gocardless/sync.ts`)

Replace the current calculation of `description` (line 79) with:

```ts
const rawDescription = bankTransaction.remittanceInformationUnstructured ?? null;
const isExpense = Number(bankTransaction.transactionAmount.amount) < 0;
const merchantName = (isExpense ? bankTransaction.creditorName : bankTransaction.debtorName)?.trim();
const description = merchantName || rawDescription || "Movimento bancario";
```

`description` remains the only field passed to `resolveCategoryId` (exact match) — no third "clean name" column separate from `description` itself. The new insert adds `rawDescription` (the value computed above, not the literal fallback "Movimento bancario" — "Bank transaction"; if there is no raw text, `rawDescription` stays `null`).

Amount sign: negative `transactionAmount.amount` = outflow → the counterparty is the creditor (`creditorName`, who receives the money); positive = income → the counterparty is the debtor (`debtorName`, who sent the money). Consistent with the standard GoCardless semantics.

## Categorisation (no code changes)

- `lib/gocardless/categorize.ts` (`matchCategoryId`, case-insensitive exact match on `description`): it receives cleaner descriptions when the merchant name is available, so more transactions from the same shop match exactly instead of differing by codes/suffixes.
- `lib/calc/categorize-suggestions.ts` (Jaccard on `description` tokens): the same benefit, higher and more reliable similarity scores between transactions of the same merchant.

Both modules stay byte-for-byte unchanged.

## Validation (`lib/validation/transactions.ts`)

`updateTransactionSchema` adds:

```ts
note: z.string().trim().max(500).nullable().optional(),
```

An empty string (after trim) must be normalised to `null` before the UPDATE (in the route handler or with `.transform()` in the schema) — "delete note" and "note never set" are the same state. `createTransactionSchema` does not include `note` (it is added after creation via PATCH, if needed — consistent with manual transactions being created without a note).

## UI (`components/domain/expenses/transaction-row.tsx`)

- When `rawDescription` is present and different from `description`, the main description text shows a tooltip (`title` or an existing tooltip component in the project) with the original raw text — the same pattern already used for truncation (existing `title={transaction.description}`, line 94).
- New note icon (lucide `notebook-pen` or similar, consistent with the icons already in use) next to the Auto/Manuale/Diviso badges, visible only if `note` is not empty. Clicking opens a popover with a `Textarea` to read/edit, saving on blur (the same pattern as the `commitDescription`/`commitAmount` already present in the component). Editable for **both** sources (auto and manual) — the only field that breaks the "auto is read-only" rule, already clarified as an explicit choice.
- If `note` is empty, no icon is shown; a way to add one the first time (e.g. a ghost icon button always present but only on hover/focus, or an icon always visible in an "empty" state) — an implementation detail left to the plan, not blocking for the spec.

## Search (`lib/calc/expenses.ts`, `filterTransactions`)

The existing text filter also matches on `note` (besides `description`), with the same case-insensitive logic already used.

## Tests

- `lib/gocardless/sync.test.ts`: new cases for the calculation of `description`/`rawDescription` — creditorName present on an outflow, debtorName present on income, neither present (fallback to remittanceInformationUnstructured), no text field available (fallback to "Movimento bancario"), check that `rawDescription` is `null` when there is no raw text.
- `lib/validation/transactions.test.ts`: `note` valid up to 500 characters, rejected above the threshold, empty/whitespace string normalised to `null`.
- `lib/calc/expenses.test.ts`: `filterTransactions` matches text inside `note` too.
- No new tests for `categorize.ts`/`categorize-suggestions.ts` (algorithm unchanged).

## Known risks/limits

- `creditorName`/`debtorName` are not guaranteed by all banks (it depends on what the specific bank's PSD2 AISP exposes) — fallback already handled, no crash expected, just less benefit on banks that do not provide them.
- Already synced transactions keep the raw `description` until the next manual edit or a possible future backfill (explicitly out of scope here).
