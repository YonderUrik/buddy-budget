CREATE TABLE "broker_operation_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_key" text NOT NULL,
	"instrument_id" uuid NOT NULL,
	"type" text NOT NULL,
	"date" date NOT NULL,
	"quantity" numeric(24, 10) NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"gross_amount" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broker_operation_exclusions" ADD CONSTRAINT "broker_operation_exclusions_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_operation_exclusions" ADD CONSTRAINT "broker_operation_exclusions_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broker_operation_exclusions_user_key_idx" ON "broker_operation_exclusions" USING btree ("user_id","account_key");