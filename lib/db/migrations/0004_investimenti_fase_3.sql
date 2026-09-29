CREATE TABLE "instrument_profiles" (
	"instrument_id" uuid PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"symbol" text,
	"sectors" jsonb,
	"asset_mix" jsonb,
	"holdings" jsonb,
	"sector" text,
	"country" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series" text NOT NULL,
	"date" date NOT NULL,
	"rate" numeric(10, 8) NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interest_rates_series_date_unique" UNIQUE("series","date")
);
--> statement-breakpoint
CREATE TABLE "investment_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"weight" numeric(7, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investment_targets_portfolio_instrument_unique" UNIQUE("portfolio_id","instrument_id")
);
--> statement-breakpoint
CREATE TABLE "user_instrument_breakdowns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instrument_id" uuid NOT NULL,
	"sectors" jsonb,
	"areas" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_instrument_breakdowns_unique" UNIQUE("user_id","instrument_id")
);
--> statement-breakpoint
ALTER TABLE "instrument_profiles" ADD CONSTRAINT "instrument_profiles_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_targets" ADD CONSTRAINT "investment_targets_portfolio_id_investment_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."investment_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_targets" ADD CONSTRAINT "investment_targets_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_instrument_breakdowns" ADD CONSTRAINT "user_instrument_breakdowns_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_instrument_breakdowns" ADD CONSTRAINT "user_instrument_breakdowns_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;