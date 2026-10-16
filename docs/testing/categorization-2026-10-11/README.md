# Categorization check

Screenshots of the local app on the `buddy_categorization_demo_v2` database, with Giulia Demo's fictitious data. No calls to real AI services during the check.

- Internal transfer of €250 between current account and deposit account: original amounts visible, label «Escluso dai conteggi» ("Excluded from totals"), monthly income still at zero.
- Category available in the «Trasferimenti tra conti» ("Transfers between accounts") section.
- Personal instructions saved from Impostazioni ("Settings") and found again after reloading.
- Light and dark themes checked in the browser.

Tests: regressions on `DB Vertrieb GmbH`, 5+5+2 batches, propagation of the instructions and discarding of stale responses; APIs for assignment/recategorization, changed amount, both signs, rules and category type change.

The full suite has a pre-existing failure in `lib/observability/logger.test.ts`: it looks for the word «mario» in the stack, which here contains the path `/Users/mario`. A first run also picked up a test from a temporary pnpm cache, later removed from the workspace. See the PR for the final results.

Final check after integrating main `9a79147`: 29 files, 236 tests passed; TypeScript without errors; lint without errors (one pre-existing warning). Migration 0033 applied successfully on fresh local databases. Screenshots updated in the browser, light/dark themes; landing images of transactions and categories at 1280 × 1200.
