# 2026-10-11 — Instrument search no longer lists the shared catalog

- **Problem**: in Investimenti, «Cerca un titolo» ("Search for a security") listed among the «già aggiunti» ("already added") all the shared instruments of the catalog, including those added only by other users. No personal data (quantities, amounts, operations), but it showed what others had searched for and added.
- **Decision**: the shared catalog stays shared for prices (ISIN, ticker, history), but `searchKnownInstruments` returns only instruments tied to the user: created by them, with their operations, in the watchlist, with an alert or settings of theirs. The others are found from the market sources and reused.
- **Tests**: `lib/investments/instruments-search.integration.test.ts`.

## Isolation audit (same PR)

Audit of all 105 routes and of the `lib/**` functions on user tables: no cross access to per-user data. Fixed: GoCardless callback filtered by user; GoCardless finalize accepts only accounts of the connection's requisition; backfill status only for visible instruments; AI comment cache per user (a user's manual prices do not end up in others' text); logout with full reload (TanStack cache cleared). Open: name, type and tax rates of shared instruments created from Yahoo/ISIN come from the client (decision to be made).
