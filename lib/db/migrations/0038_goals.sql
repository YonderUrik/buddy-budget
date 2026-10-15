CREATE TABLE "goal_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid,
	"instrument_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_sources_one_target" CHECK (("goal_sources"."account_id" is null) <> ("goal_sources"."instrument_id" is null))
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"target_amount" numeric(14, 2) NOT NULL,
	"target_date" date,
	"monthly_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"achieved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "goal_alerts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_sources" ADD CONSTRAINT "goal_sources_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_sources" ADD CONSTRAINT "goal_sources_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_sources" ADD CONSTRAINT "goal_sources_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_sources" ADD CONSTRAINT "goal_sources_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_sources_user_idx" ON "goal_sources" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_sources_goal_account_unique" ON "goal_sources" USING btree ("goal_id","account_id") WHERE "goal_sources"."account_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "goal_sources_goal_instrument_unique" ON "goal_sources" USING btree ("goal_id","instrument_id") WHERE "goal_sources"."instrument_id" is not null;--> statement-breakpoint
CREATE INDEX "goals_user_idx" ON "goals" USING btree ("user_id");