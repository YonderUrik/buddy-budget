CREATE TABLE "trade_republic_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"external_account_hash" text NOT NULL,
	"session" text NOT NULL,
	"status" text DEFAULT 'linked' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_republic_connections_user_external_unique" UNIQUE("user_id","external_account_hash")
);
--> statement-breakpoint
ALTER TABLE "trade_republic_connections" ADD CONSTRAINT "trade_republic_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_republic_connections" ADD CONSTRAINT "trade_republic_connections_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;