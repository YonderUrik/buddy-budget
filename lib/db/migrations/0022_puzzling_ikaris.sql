CREATE TABLE "personal_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"account_id" uuid,
	"portfolio_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"format_id" uuid NOT NULL,
	"parser_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"encrypted_csv" text,
	"encrypted_preview" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease" uuid,
	"lease_until" timestamp with time zone,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"estimated_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"notified_at" timestamp with time zone,
	"notify_after" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_import_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"format_id" uuid NOT NULL,
	"record_key" text NOT NULL,
	"outcome_hash" text NOT NULL,
	CONSTRAINT "personal_import_receipts_record_unique" UNIQUE("format_id","record_key")
);
--> statement-breakpoint
CREATE TABLE "personal_parsers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"format_id" uuid NOT NULL,
	"signature" text NOT NULL,
	"encrypted_parser" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "personal_formats" ADD CONSTRAINT "personal_formats_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_formats" ADD CONSTRAINT "personal_formats_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_formats" ADD CONSTRAINT "personal_formats_portfolio_id_investment_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."investment_portfolios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_import_jobs" ADD CONSTRAINT "personal_import_jobs_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_import_jobs" ADD CONSTRAINT "personal_import_jobs_format_id_personal_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."personal_formats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_import_jobs" ADD CONSTRAINT "personal_import_jobs_parser_id_personal_parsers_id_fk" FOREIGN KEY ("parser_id") REFERENCES "public"."personal_parsers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_import_receipts" ADD CONSTRAINT "personal_import_receipts_format_id_personal_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."personal_formats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_parsers" ADD CONSTRAINT "personal_parsers_format_id_personal_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."personal_formats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personal_import_jobs_queue_idx" ON "personal_import_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "personal_import_jobs_user_idx" ON "personal_import_jobs" USING btree ("user_id");