ALTER TABLE "auth_user" ADD COLUMN "app_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "visit_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "visit_since_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "welcome_shown_at" timestamp with time zone;