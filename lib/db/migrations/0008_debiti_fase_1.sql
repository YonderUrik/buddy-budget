CREATE TABLE "debt_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debt_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2),
	"installment_number" integer,
	"rate" numeric(7, 4),
	"transaction_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text DEFAULT 'loan' NOT NULL,
	"name" text NOT NULL,
	"start_mode" text NOT NULL,
	"principal" numeric(14, 2) NOT NULL,
	"annual_rate" numeric(7, 4) NOT NULL,
	"installments" integer NOT NULL,
	"first_installment_date" date NOT NULL,
	"installment" numeric(12, 2),
	"anchor_date" date,
	"costs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debt_events" ADD CONSTRAINT "debt_events_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_events" ADD CONSTRAINT "debt_events_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_events" ADD CONSTRAINT "debt_events_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debt_events_debt_idx" ON "debt_events" USING btree ("debt_id");--> statement-breakpoint
CREATE INDEX "debt_events_user_idx" ON "debt_events" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "debt_events_payment_unique" ON "debt_events" USING btree ("debt_id","installment_number") WHERE "debt_events"."type" = 'payment';--> statement-breakpoint
CREATE INDEX "debts_user_idx" ON "debts" USING btree ("user_id");