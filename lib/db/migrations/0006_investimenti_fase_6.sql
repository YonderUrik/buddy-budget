CREATE TABLE "user_price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instrument_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"target_price" numeric(20, 8) NOT NULL,
	"status" text DEFAULT 'attivo' NOT NULL,
	"triggered_at" timestamp with time zone,
	"triggered_price" numeric(20, 8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instrument_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_watchlist_items_user_instrument_unique" UNIQUE("user_id","instrument_id")
);
--> statement-breakpoint
ALTER TABLE "user_price_alerts" ADD CONSTRAINT "user_price_alerts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_price_alerts" ADD CONSTRAINT "user_price_alerts_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watchlist_items" ADD CONSTRAINT "user_watchlist_items_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watchlist_items" ADD CONSTRAINT "user_watchlist_items_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_price_alerts_user_instrument_idx" ON "user_price_alerts" USING btree ("user_id","instrument_id");--> statement-breakpoint
CREATE INDEX "user_price_alerts_status_idx" ON "user_price_alerts" USING btree ("status");