CREATE TABLE "inflation_index" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area" text NOT NULL,
	"month" text NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inflation_index_area_month_unique" UNIQUE("area","month")
);
--> statement-breakpoint
ALTER TABLE "investment_portfolios" ADD COLUMN "benchmark_instrument_id" uuid;--> statement-breakpoint
ALTER TABLE "investment_portfolios" ADD CONSTRAINT "investment_portfolios_benchmark_instrument_id_instruments_id_fk" FOREIGN KEY ("benchmark_instrument_id") REFERENCES "public"."instruments"("id") ON DELETE set null ON UPDATE no action;