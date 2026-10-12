CREATE TYPE "public"."category_source" AS ENUM('regola', 'storico', 'assistente', 'utente');--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "categorization_auto_apply" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "auto_categorized_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "category_source" "category_source";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "category_confidence" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "categorized_at" timestamp with time zone;--> statement-breakpoint
-- Chi ha già acconsentito all'assistente aveva letto «le proposte non si applicano mai da sole»: per loro resta spento finché non lo attivano.
UPDATE "auth_user" SET "categorization_auto_apply" = false WHERE "ai_categorization_consent_at" IS NOT NULL;
