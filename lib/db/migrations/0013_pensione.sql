CREATE TABLE "pension_funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"adhesion_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pension_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"net_contributions" numeric(14, 2) NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pension_snapshots_fund_date_unique" UNIQUE("fund_id","date")
);
--> statement-breakpoint
ALTER TABLE "pension_funds" ADD CONSTRAINT "pension_funds_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pension_snapshots" ADD CONSTRAINT "pension_snapshots_fund_id_pension_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."pension_funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pension_snapshots" ADD CONSTRAINT "pension_snapshots_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pension_funds_user_idx" ON "pension_funds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pension_snapshots_user_idx" ON "pension_snapshots" USING btree ("user_id");