CREATE TABLE "categorization_run_items" (
	"run_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"previous_category_id" uuid NOT NULL,
	"previous_excluded_amount" numeric(12, 2) NOT NULL,
	"previous_source" "category_source",
	"previous_confidence" numeric(5, 4),
	"previous_categorized_at" timestamp with time zone,
	"new_category_id" uuid NOT NULL,
	"applied_at" timestamp with time zone NOT NULL,
	CONSTRAINT "categorization_run_items_run_id_transaction_id_pk" PRIMARY KEY("run_id","transaction_id")
);
--> statement-breakpoint
CREATE TABLE "categorization_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"scope" text NOT NULL,
	"changed" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "categorization_run_items" ADD CONSTRAINT "categorization_run_items_run_id_categorization_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."categorization_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_run_items" ADD CONSTRAINT "categorization_run_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_runs" ADD CONSTRAINT "categorization_runs_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categorization_runs_user_idx" ON "categorization_runs" USING btree ("user_id","created_at");