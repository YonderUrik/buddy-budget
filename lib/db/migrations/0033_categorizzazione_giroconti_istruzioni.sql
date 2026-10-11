-- Ricrea l'enum per poter usare il nuovo valore nella stessa transazione delle migration.
ALTER TYPE "public"."category_type" RENAME TO "category_type_before_transfers";
--> statement-breakpoint
CREATE TYPE "public"."category_type" AS ENUM ('dovuta', 'voluta', 'futuro', 'saltuaria', 'entrata', 'trasferimento');
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "type" TYPE "public"."category_type" USING "type"::text::"public"."category_type";
--> statement-breakpoint
DROP TYPE "public"."category_type_before_transfers";
--> statement-breakpoint
-- Aggiunge la scelta agli utenti esistenti senza ricategorizzare movimenti o modificare categorie personali.
INSERT INTO "categories" ("user_id", "name", "type", "color", "icon", "description")
SELECT u.id,
  CASE WHEN EXISTS (SELECT 1 FROM categories c WHERE c.user_id = u.id AND c.name = 'Trasferimenti tra i miei conti')
    THEN 'Trasferimenti tra i miei conti (' || gen_random_uuid()::text || ')'
    ELSE 'Trasferimenti tra i miei conti' END,
  'trasferimento', 'slate', 'landmark', 'Giroconti fra conti di tua proprietà: esclusi da entrate e spese'
FROM auth_user u
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.user_id = u.id AND c.type = 'trasferimento');

--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "ai_categorization_instructions" text DEFAULT '' NOT NULL;