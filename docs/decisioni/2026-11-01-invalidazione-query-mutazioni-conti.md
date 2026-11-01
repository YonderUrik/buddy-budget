# 2026-11-01 — Account mutations invalidate every view they change

Creating an account invalidated only `["accounts"]`, deleting one only `["accounts"]` and the GoCardless capacity, while editing one already invalidated the balance-dependent views. The asymmetry was visible in the code (`lib/queries/accounts.ts`): create a manual account with a balance and the overview kept showing the old net worth, because `["net-worth-snapshots"]` (2-minute `staleTime`), the sidebar summary and `["goals"]` (5 minutes) were never marked stale.

Now the shared keys live in a small module, `lib/queries/invalidation.ts`, independent of the hooks so nothing has to import the accounts mutations to reach them. `BALANCE_CHANGED_QUERY_KEYS` (accounts, net worth history, sidebar summary, goals) is what any balance change makes stale: create and update both use it. `ACCOUNT_DELETED_QUERY_KEYS` adds the ledger views (transactions, attention, budget month, bank capacity), because the delete route drops the account's transactions in the same database transaction and the client would otherwise keep rows that no longer exist. `invalidateKeys` invalidates them in parallel; inactive queries stay stale and refresh when they mount again.

`lib/queries/transactions.ts` now imports its balance keys from `invalidation.ts` instead of from `accounts.ts`, removing the accounts→transactions import. The transaction mutations keep the same set of keys they had.

Deliberately left out of this first change: making the update mutation selective (a rename-only edit still invalidates net worth, goals and the sidebar, which are not affected). Complete and predictable beats minimal here; a semantic dependency matrix is a later, separate step.
