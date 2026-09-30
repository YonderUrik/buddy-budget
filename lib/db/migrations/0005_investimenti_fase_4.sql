CREATE TABLE "instrument_dividends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"ex_date" date NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instrument_dividends_instrument_date_unique" UNIQUE("instrument_id","ex_date")
);
--> statement-breakpoint
CREATE TABLE "investment_tax_carryforwards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_dismissed_dividends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instrument_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_dismissed_dividends_unique" UNIQUE("user_id","instrument_id","date")
);
--> statement-breakpoint
CREATE TABLE "user_instrument_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instrument_id" uuid NOT NULL,
	"tax_rate" numeric(5, 4),
	"tax_harmonized" boolean,
	"coupon_rate" numeric(8, 6),
	"coupon_frequency" integer,
	"maturity_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_instrument_settings_unique" UNIQUE("user_id","instrument_id")
);
--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "dividends_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "investment_portfolios" ADD COLUMN "tax_regime" text DEFAULT 'amministrato' NOT NULL;--> statement-breakpoint
ALTER TABLE "instrument_dividends" ADD CONSTRAINT "instrument_dividends_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_tax_carryforwards" ADD CONSTRAINT "investment_tax_carryforwards_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_tax_carryforwards" ADD CONSTRAINT "investment_tax_carryforwards_portfolio_id_investment_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."investment_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dismissed_dividends" ADD CONSTRAINT "user_dismissed_dividends_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dismissed_dividends" ADD CONSTRAINT "user_dismissed_dividends_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_instrument_settings" ADD CONSTRAINT "user_instrument_settings_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_instrument_settings" ADD CONSTRAINT "user_instrument_settings_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investment_tax_carryforwards_user_idx" ON "investment_tax_carryforwards" USING btree ("user_id");