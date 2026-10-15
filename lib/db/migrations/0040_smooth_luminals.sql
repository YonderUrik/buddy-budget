CREATE TABLE "import_format_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"engine" text NOT NULL,
	"metadata" text NOT NULL,
	"observations" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_format_profiles_owner_layout" UNIQUE("user_id","engine","fingerprint")
);
--> statement-breakpoint
ALTER TABLE "personal_import_jobs" ADD COLUMN "failure_report" jsonb;--> statement-breakpoint
ALTER TABLE "personal_import_jobs" ADD COLUMN "support_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "personal_import_jobs" ADD COLUMN "support_notify_after" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "import_format_profiles" ADD CONSTRAINT "import_format_profiles_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;