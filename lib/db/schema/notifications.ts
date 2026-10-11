import { boolean, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/**
 * Preferenze sulle email non di servizio (riepilogo, avvisi budget, avvisi scadenze). Una riga per utente, creata
 * al primo salvataggio: senza riga valgono i default di `NOTIFICATION_DEFAULTS` (oggi tutto spento, opt-in).
 */
export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => authUser.id, { onDelete: "cascade" }),
  digestEnabled: boolean("digest_enabled").notNull().default(false),
  /** `settimanale` | `mensile` (validato da `lib/validation/notifications`). */
  digestFrequency: text("digest_frequency").notNull().default("mensile"),
  budgetAlertsEnabled: boolean("budget_alerts_enabled").notNull().default(false),
  deadlineAlertsEnabled: boolean("deadline_alerts_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Registro delle email non di servizio già inviate: deduplica (`unique` su utente, tipo e chiave dell'elemento) e
 * tetto di frequenza (le righe di uno stesso invio condividono `sentAt`). Contiene solo chiavi tecniche, mai importi
 * o testi; si ripulisce dopo `NOTIFICATION_LOG_RETENTION_DAYS` giorni.
 */
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    itemKey: text("item_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("notification_log_user_kind_item_unique").on(table.userId, table.kind, table.itemKey),
    index("notification_log_user_sent_idx").on(table.userId, table.sentAt),
  ]
);

export type NotificationPreferencesRow = typeof notificationPreferences.$inferSelect;
