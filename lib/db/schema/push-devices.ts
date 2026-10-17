import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/**
 * Phones of the native app that accept push notifications: one row per device token. Android tokens are FCM
 * registration tokens, iOS tokens are APNs device tokens (hex). A token the provider reports as dead is deleted on the
 * next send; signing out of the app deletes the row of that device.
 */
export const pushDevices = pgTable(
  "push_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    /** `ios` | `android` (validated by `lib/validation/push-devices`). */
    platform: text("platform").notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last time the app registered this token: devices silent for a long time are pruned. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("push_devices_token_unique").on(table.token), index("push_devices_user_idx").on(table.userId)]
);

export type PushDevice = typeof pushDevices.$inferSelect;
