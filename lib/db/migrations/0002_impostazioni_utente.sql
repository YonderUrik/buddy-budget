ALTER TABLE "auth_user" ADD COLUMN "home_page" text DEFAULT '/panoramica' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "deletion_scheduled_at" timestamp with time zone;