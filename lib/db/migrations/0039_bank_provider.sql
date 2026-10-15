CREATE TYPE "public"."bank_provider" AS ENUM('gocardless', 'enablebanking');--> statement-breakpoint
ALTER TABLE "bank_connection_attempts" ADD COLUMN "provider" "bank_provider" DEFAULT 'gocardless' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD COLUMN "provider" "bank_provider" DEFAULT 'gocardless' NOT NULL;