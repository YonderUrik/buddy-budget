ALTER TABLE "debts" ADD COLUMN "credit_limit" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "spread" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "index_label" text;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "interest_frequency" text;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "day_count" text;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "capitalize_interest" boolean;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "alert_threshold_type" text;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "alert_threshold_value" numeric(14, 2);