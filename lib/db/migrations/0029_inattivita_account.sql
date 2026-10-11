ALTER TABLE "auth_user" ADD COLUMN "last_active_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "inactivity_warned_at" timestamp with time zone;
-- Recupero dell'ultimo accesso noto: il più recente tra l'ultimo aggiornamento dell'utente, la sessione più recente
-- e la creazione. È una stima per eccesso (mai per difetto): nessun account esistente risulta inattivo da più di quanto lo sia davvero.
UPDATE "auth_user" u SET "last_active_at" = GREATEST(
  u."created_at",
  u."updated_at",
  COALESCE((SELECT MAX(s."updated_at") FROM "auth_session" s WHERE s."user_id" = u."id"), u."created_at")
);
