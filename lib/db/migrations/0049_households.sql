CREATE TABLE "household_accounts" (
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_accounts_household_id_account_id_pk" PRIMARY KEY("household_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "household_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"invited_by" text NOT NULL,
	"email" text,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"household_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"shares_net_worth" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_members_household_id_user_id_pk" PRIMARY KEY("household_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "household_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_split_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"household_id" uuid NOT NULL,
	"merchant_key" text NOT NULL,
	"from_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_split_rules_user_merchant_unique" UNIQUE("user_id","merchant_key")
);
--> statement-breakpoint
CREATE TABLE "household_splits" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"household_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household_accounts" ADD CONSTRAINT "household_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_accounts" ADD CONSTRAINT "household_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_accounts" ADD CONSTRAINT "household_accounts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_invited_by_auth_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_accepted_by_auth_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_settlements" ADD CONSTRAINT "household_settlements_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_settlements" ADD CONSTRAINT "household_settlements_from_user_id_auth_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_settlements" ADD CONSTRAINT "household_settlements_to_user_id_auth_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_settlements" ADD CONSTRAINT "household_settlements_created_by_auth_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_split_rules" ADD CONSTRAINT "household_split_rules_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_split_rules" ADD CONSTRAINT "household_split_rules_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_splits" ADD CONSTRAINT "household_splits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_splits" ADD CONSTRAINT "household_splits_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_splits" ADD CONSTRAINT "household_splits_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_created_by_auth_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "household_accounts_user_idx" ON "household_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "household_invites_household_idx" ON "household_invites" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "household_members_user_idx" ON "household_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "household_settlements_household_idx" ON "household_settlements" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "household_splits_household_idx" ON "household_splits" USING btree ("household_id");