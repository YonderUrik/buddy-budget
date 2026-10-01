ALTER TABLE "bank_connections" ADD COLUMN "expiry_warning_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD COLUMN "expired_notice_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD COLUMN "orphaned_at" timestamp with time zone;