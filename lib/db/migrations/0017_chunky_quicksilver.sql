CREATE TABLE "broker_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"account_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"statement" jsonb NOT NULL,
	"records" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broker_statements_user_fingerprint" UNIQUE("user_id","fingerprint"),
	CONSTRAINT "broker_statements_user_account_period" UNIQUE("user_id","account_key","period_from","period_to")
);
--> statement-breakpoint
ALTER TABLE "broker_statements" ADD CONSTRAINT "broker_statements_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_statements" ADD CONSTRAINT "broker_statements_portfolio_id_investment_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."investment_portfolios"("id") ON DELETE cascade ON UPDATE no action;