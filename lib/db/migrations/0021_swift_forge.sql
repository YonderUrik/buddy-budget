CREATE TABLE "broker_import_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_key" text NOT NULL,
	"provider" text NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"cash_account_id" uuid,
	CONSTRAINT "broker_import_accounts_user_key" UNIQUE("user_id","account_key")
);
--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD COLUMN "statement_account_key" text;--> statement-breakpoint
ALTER TABLE "broker_import_accounts" ADD CONSTRAINT "broker_import_accounts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_import_accounts" ADD CONSTRAINT "broker_import_accounts_portfolio_id_investment_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."investment_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_import_accounts" ADD CONSTRAINT "broker_import_accounts_cash_account_id_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;