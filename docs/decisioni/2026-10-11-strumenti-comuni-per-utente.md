# 2026-10-11 — No user's choice applies to others on shared instruments

- **Problem**: the `instruments` table is shared (prices, dividends and profiles apply to everyone), but tax rate, harmonization, name, type and ISIN↔symbol link of a shared instrument were decided by the first user who created it, and applied to everyone.
- **Decision**:
  - tax rate and harmonization chosen when creating a shared instrument go into the user's `user_instrument_settings`; `resolveTaxSettings` uses the row's values only for manual (private) ones;
  - for a Yahoo instrument name and type come from the source (Yahoo's `chart`), currency and exchange already before; the ISIN given by the client is linked only if OpenFIGI confirms that symbol;
  - an instrument created «from ISIN only» (name, type and currency not confirmed by any source) is created private to whoever creates it, with automatic prices;
  - matching by name in the import searches only among the user's instruments.
- **Existing data**: no migration. Tax rates saved on shared rows are no longer read (whoever had chosen them sets them again from the instrument settings); names, types and ISINs already saved on shared rows remain until a cleanup is decided.
- **Tests**: `lib/investments/instruments-shared-isolation.integration.test.ts`, `lib/calc/taxes.test.ts`, `app/api/instruments/route.test.ts`.
