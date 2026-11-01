-- Market data gets a content-change timestamp (decision 2026-11-01,
-- docs/decisioni/2026-11-01-impronta-storico-investimenti.md): the investment-history fingerprint used
-- count(*) + max(created_at), but the upserts that correct an existing close or FX rate never moved created_at, so a
-- retroactive correction left the derived history stale. `updated_at` is now maintained on every upsert. Existing rows
-- take now() from the column default, so the first refresh after the deploy recomputes them once.
ALTER TABLE "fx_rates" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "instrument_prices" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
