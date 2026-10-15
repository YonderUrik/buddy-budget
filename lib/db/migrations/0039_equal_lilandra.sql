CREATE TABLE "financial_plans" (
	"user_id" text NOT NULL,
	"country" text NOT NULL,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_plans_user_id_country_pk" PRIMARY KEY("user_id","country")
);
--> statement-breakpoint
ALTER TABLE "financial_plans" ADD CONSTRAINT "financial_plans_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;