CREATE TABLE "ibkr_flex_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_key" text NOT NULL,
	"account_label" text NOT NULL,
	"token" text NOT NULL,
	"query_id" text NOT NULL,
	"base_currency" text NOT NULL,
	"date_opened" date,
	"status" text DEFAULT 'linked' NOT NULL,
	"last_error" text,
	"last_error_detail" text,
	"synced_through" date,
	"last_synced_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"failures" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ibkr_flex_connections_user_account_unique" UNIQUE("user_id","account_key")
);
--> statement-breakpoint
ALTER TABLE "ibkr_flex_connections" ADD CONSTRAINT "ibkr_flex_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ibkr_flex_connections_due_idx" ON "ibkr_flex_connections" USING btree ("status","next_attempt_at");