ALTER TYPE "public"."category_source" ADD VALUE 'banca';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "bank_category" text;