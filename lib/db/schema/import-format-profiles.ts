import { pgTable, text, uuid, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { encryptedText } from "./encrypted-text";

/** Private, versioned layout observations; contain schema metadata, never CSV samples. */
export const importFormatProfiles = pgTable("import_format_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull(),
  engine: text("engine").notNull(),
  metadata: encryptedText("metadata").notNull(),
  observations: integer("observations").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [unique("import_format_profiles_owner_layout").on(table.userId, table.engine, table.fingerprint)]);
