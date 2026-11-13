# Account balances and their history: audit and proposed design

Status: proposal (2026-11-08), not implemented. Written after the broker cash history work on `claude/ibkr-flex-sync`
(statement-rebuilt IBKR cash, `net_worth_snapshots.statement_amount`), which showed that "what is this account's
balance, today and on a past day" has no single owner in the code.

## 1. Audit: how it works today

### 1.1 Six kinds of cash account, inferred from five tables

`accounts.source` can only be `manuale` or `auto`. Everything else is inferred from link tables.

| Kind | Created by (source) | Balance written by | Movements stored in | Identified through |
|---|---|---|---|---|
| Manual | `POST /api/accounts` (`manuale`) | user edit; `moveAccountBalance` on hand-typed transactions | `transactions` (`manuale`) | nothing (the default) |
| GoCardless bank | finalize route (`auto`) | each sync, bank's figure (`lib/gocardless/sync.ts:89`) | `transactions` (`auto`) | `bank_account_links` |
| Trade Republic, connected | `lib/trade-republic/connections.ts:32` (`auto`) | each sync (`sync.ts:88`) | `transactions` (`auto`) | `trade_republic_connections` |
| Bank file import (CSV/Excel) | `lib/personal-import/confirm.ts:129` (`manuale`) | +delta on confirm, −delta on delete; also `moveAccountBalance` | `transactions` (`manuale`, `personal:` ids) | `personal_formats.account_id` |
| Broker statement (IBKR CSV/Flex, DEGIRO, Trade Republic file) | `execute-statement.ts:203` (`manuale`, type «Liquidità broker») | statement closing converted at its end date; delete/reset; also user edit and `moveAccountBalance` | IBKR, DEGIRO: only the statement JSON ledger; Trade Republic file: also `transactions` (`manuale`) | `broker_import_accounts`, `broker_statements`, `investment_portfolios.statement_cash_account_id` |
| IBKR Flex | same as broker statement | same | same | the above plus `ibkr_flex_connections` by account key |

### 1.2 At least twelve classifiers, with different rules

The question "what kind of account is this" is answered separately in each place below, each with its own rule:
- `moveAccountBalance`;
- the new-transaction guard and the account picker in the add form;
- the account `PATCH` guard;
- `importAccountIds`, plus `followsTransactions` in `GET /api/accounts`;
- `accountFollowsTransactions`;
- `loadLedgerAccounts`;
- `resolveBrokerCash`;
- `LEVERAGE_PROVIDERS`;
- `loadStatementCashHistories`;
- the account-type check in the Liquidità overview;
- `isSyncedAccount`;
- `groupAccounts`;
- `buildAccountExtras` (native app).

Where the same account comes out differently:
- **IBKR Flex cash account:** «Collegato» with a read-only balance in its window, yet listed under «Manuali – Li aggiorni tu». The balance can still be changed by `PATCH` and by hand-typed transactions, and the account shows in the manual-transaction picker.
- **IBKR CSV account with no connection:** editable balance, but the next statement overwrites it, and the history ignores the edit.
- **Trade Republic statement account:**
  - its movements are real transactions, yet it counts as manual: flat line, no history;
  - those movements are editable, which moves a balance that is otherwise set from the statement;
  - the Liquidità overview asks for its statement cash and gets nothing back.
- **DEGIRO account:** counts as broker cash for Investimenti, but as manual for the history.
- **Bank file-import account:** has a balance line on the web, but none in the native app's view.
- **Detecting broker cash:** the browser goes by the account type, the server by the link tables. A user can retype a manual account, so the two can disagree.

### 1.3 Five engines that compute cash on a past day

1. **Stored history:** `planCashHistory` with `refreshDerivedCashHistory`, which keeps the bank/file part, the statement part and the manual part of each day.
2. **Today's row:** `writeDailySnapshot`.
3. **Broker cash from statements:** `buildCashSeries`, used by the history, the leverage card and «Sul tuo capitale».
4. **One account's line from its transactions:** `buildAccountBalanceSeries`, client-side, used by the Liquidità hero, the Conti sparklines and the native view. Each loads a different transaction window.
5. **One broker account's line:** `buildStatementBalanceSeries`.

The demo builds its own history, and the investment reset writes today's cash row by hand.

**Past net worth is read three ways:**
- the chart carries each class forward day by day;
- the sidebar's 30-day change takes the exact latest date on or before 30 days ago, and refreshes cash but not investments;
- search's «patrimonio» takes the latest stored date within 7 days.

If one class has no row on that date, the sidebar and search leave it out, while the chart does not.

**Other disagreements:**
- **Manual accounts:** each account's line is flat, while the stored total keeps the recorded balances, so the per-account lines don't add up to the total.
- **Future-dated transactions:** Conti, the Liquidità hero and the planner each handle them differently.
- **IBKR cash exchange rate:**
  - the account balance uses the rate on the statement's end date;
  - the leverage card uses today's rate;
  - the history uses each day's rate.
- **Margin loan:** Panoramica's composition moves negative broker cash out of Liquidità, while the stored history and the cash total keep it in.

**Bugs found:**
- **Investment reset:** it updates today's cash row without clearing `statement_amount`, so the next rebuild takes the old broker cash as still recorded. (Introduced by the broker cash history work; to fix before merging.)
- **IBKR counted twice:** an older day added after the IBKR account existed (for example a bank file imported later) carried the IBKR balance as «manual» cash. The rebuild only looks for it on days after the account was created, so IBKR is counted twice on those days.
- **Double counting through a file import:** an account that is both a statement account and linked to a file import would be counted in both parts. Unreachable today, but nothing prevents it.

### 1.4 Why every new source repeats the same work

The history stores one total per day, with only partial splits (`ledger_amount`, later `statement_amount`). So every time an account kind becomes rebuildable, the old days have to be split by estimate:
- migration 0043, when bank and file-import accounts became rebuildable;
- the 2026-11-07 change, for broker statements;
- next would be DEGIRO and Trade Republic statements.

A new provider today means touching every classifier above, adding a column and writing another estimate.

## 2. Proposal

Ground rules (decided 2026-11-08):
- **No new questions:** the app asks users nothing it does not ask today. No new prompt, form, setting or confirmation.
- **Same UX and UI:** every screen, group, button, line and label stays exactly as it is, and the cash history keeps its 24-month window.
- **Internal only:** the change is where the rules live, what is stored, and one engine instead of five.
- **Numbers:** they change only where today's answer is a bug:
  - the three bugs in 1.3;
  - past net worth in the sidebar or search on a day with no stored row for a class.

Three ideas, each removing one class of problem.

### 2.1 Every account declares its feed (one classifier)

Add `accounts.feed`, an enum, written once by the code that creates or links the account:

| feed | Meaning | Balance | History |
|---|---|---|---|
| `manual` | typed by the user | editable; hand-typed transactions move it | its balance events (2.2) |
| `transactions` | follows its movements: GoCardless, Trade Republic connected, bank file imports | read-only, from the provider or the import | balance minus later movements |
| `statements` | follows reconciled broker statements: IBKR CSV/Flex, DEGIRO, later Trade Republic files | read-only, from the latest statement | rebuilt from the statements' ledger |

Plus `provider` and `connection_id` (nullable) for what the UI needs: a sync button, «Riconnetti», grouping under the bank or broker.

- **One server module classifies accounts:** `lib/balances/feed.ts`, and `GET /api/accounts` returns `feed` and `provider`. Every UI rule reads it: grouping, editability, sync button, line source. This replaces the dozen classifiers above, and the «Liquidità broker» type check goes.
- **Editing rules follow the feed, matching what the screens allow today:**
  - the API's editing rules (balance `PATCH`, `moveAccountBalance`, the typed-movement picker) are derived from the feed;
  - so what the server accepts finally matches what the UI already offers;
  - no screen changes.
- **Setting it for existing accounts:** a migration fills `feed` from today's link tables. This is the only place the inference survives.

### 2.2 Manual balances become events, so no more estimates

Add `account_balance_events (account_id, at, balance)`, written whenever a manual balance changes:
- an edit;
- `moveAccountBalance`;
- creation.

A manual account's past is then known exactly, like the other two feeds. From then on, every account kind has an exact history, and no future source will need a guess.

- **The last estimate:** at cutover, the manual part of each stored day is computed once, from the stored total minus the rebuilt parts, and frozen as a per-user «manual before events» series. This is the last time we guess.
- **Cost:** a few rows per manual account per month.

### 2.3 One engine for any account on any day

`lib/balances/history.ts` takes a user and a date range and returns each account's end-of-day series, in the user's currency, plus their sum. It has one source per feed:
- `transactions`: today's `ledgerByDay`;
- `statements`: today's `buildCashSeries`, extended to DEGIRO after the checks in 3. Trade Republic statement files keep the import's existing assumption that the opening balance is zero; nobody is asked for a balance;
- `manual`: the events, with the frozen series before cutover.

Exchange rates follow one rule: each day's rate, and today's balance uses the same rule. That ends the statement-end-date vs today's-rate split.

Consumers:
- **`net_worth_snapshots` cash rows** become a cache of this sum, recomputed from the inputs at any time. The `ledger_amount`/`statement_amount` split is no longer needed and can be dropped later.
- **`GET /api/accounts/[id]/history`** serves each account's line, for the Liquidità hero, the Conti sparklines and the native app. They draw exactly the lines drawn today: a manual account keeps its flat line. The difference is that lines are computed once, instead of in the browser from whatever transaction window happens to be loaded.
- **`netWorthOn(date)` / `netWorthSeries(range)`** in `lib/net-worth`, with the chart's carry-forward rule, used by the chart, the sidebar's 30-day change, search, Analitiche and the export.

**Adding a source later** (another broker, another Open Banking provider, a crypto wallet) means: set the feed at creation, and add a history source if the feed is new. History, charts, sync, grouping and editing follow automatically.

## 3. Plan

| Phase | What | Risk |
|---|---|---|
| 0 (in the current branch, before merge) | Fix the reset leaving `statement_amount`. Fix IBKR counted twice: use the estimate on every old day for users with statement accounts. Never count an account in both parts. Write a read-only production report (per user: days changed, largest change) and run it before the merge. | low |
| 1 | `accounts.feed`, `provider` and `connection_id`, a migration from the link tables, one classifier, `GET /api/accounts` exposing them, editing rules by feed. Replace the classifiers in 1.2. | medium: touches many screens, no change to amounts |
| 2 | `account_balance_events` for manual accounts (writes only), then the frozen «manual before events» series. | low |
| 3 | The `lib/balances` engine, `GET /api/accounts/[id]/history`, client lines moved to it, snapshots as its cache. DEGIRO statements as `statements` once a real export with «Conversione Fondo Comune Monetario» and the flatex sweep is checked. | medium: history amounts recomputed, compare before/after with the same report |
| 4 | `netWorthOn` / `netWorthSeries` for the sidebar, search, Analitiche and the export. Drop `ledger_amount` / `statement_amount`. | low |

**Decided, not open:**
- **Trade Republic statement files:** they keep the import's opening-at-zero assumption, with no question to the user.
- **History window:** cash history keeps its 24-month window.
- **Account grouping:** it stays as it is.
