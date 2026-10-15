ALTER TABLE "personal_import_jobs" ADD COLUMN "correction_of" uuid;--> statement-breakpoint
ALTER TABLE "personal_import_jobs" ADD COLUMN "correction_token" text;--> statement-breakpoint
ALTER TABLE "personal_import_jobs" ADD COLUMN "encrypted_correction_feedback" text;