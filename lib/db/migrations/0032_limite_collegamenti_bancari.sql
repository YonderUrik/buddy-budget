CREATE TABLE "bank_connection_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_connection_attempts" ADD CONSTRAINT "bank_connection_attempts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_connection_attempts_created_at_idx" ON "bank_connection_attempts" USING btree ("created_at");--> statement-breakpoint
-- Le connessioni recenti già avviate contano nel tetto del periodo dal primo giorno (le righe eliminate non sono recuperabili).
INSERT INTO "bank_connection_attempts" ("user_id", "created_at")
SELECT "user_id", "created_at" FROM "bank_connections"
WHERE "requisition_id" IS NOT NULL AND "created_at" > now() - interval '31 days';
