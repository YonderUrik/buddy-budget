CREATE TYPE "public"."bank_connection_status" AS ENUM('pending', 'linked', 'expired', 'error');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_external_id_unique" UNIQUE("account_id","external_id");--> statement-breakpoint
CREATE TABLE "bank_account_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"external_account_id" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"next_sync_eligible_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"institution_id" text NOT NULL,
	"institution_name" text NOT NULL,
	"requisition_id" text,
	"status" "bank_connection_status" DEFAULT 'pending' NOT NULL,
	"consent_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gocardless_token" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_account_links" ADD CONSTRAINT "bank_account_links_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_account_links" ADD CONSTRAINT "bank_account_links_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
