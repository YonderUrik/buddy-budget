CREATE TYPE "public"."suggestion_direction" AS ENUM('entrata', 'uscita');--> statement-breakpoint
CREATE TYPE "public"."suggestion_source" AS ENUM('assistente', 'utente');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('in_attesa', 'confermata', 'corretta');--> statement-breakpoint
CREATE TABLE "categorization_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"merchant_key" text NOT NULL,
	"direction" "suggestion_direction" NOT NULL,
	"category_id" uuid NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"source" "suggestion_source" DEFAULT 'assistente' NOT NULL,
	"status" "suggestion_status" DEFAULT 'in_attesa' NOT NULL,
	"model" text,
	"prompt_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "categorization_suggestions_user_merchant_unique" UNIQUE("user_id","merchant_key","direction")
);
--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "ai_categorization_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categorization_suggestions" ADD CONSTRAINT "categorization_suggestions_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_suggestions" ADD CONSTRAINT "categorization_suggestions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categorization_suggestions_user_idx" ON "categorization_suggestions" USING btree ("user_id");