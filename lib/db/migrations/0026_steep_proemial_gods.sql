ALTER TABLE "auth_user" ADD COLUMN "start_checklist_dismissed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "start_checklist_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;