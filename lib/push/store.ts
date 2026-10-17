import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pushDevices, type PushDevice } from "@/lib/db/schema/push-devices";
import type { PushPlatform } from "./types";

/** Devices silent for this long (the app re-registers its token at every launch) are deleted by the notifications cron. */
export const PUSH_DEVICE_STALE_DAYS = 90;

/** Devices of a user that accept push notifications. */
export function listPushDevices(userId: string): Promise<PushDevice[]> {
  return db.select().from(pushDevices).where(eq(pushDevices.userId, userId));
}

/**
 * Saves the token of this device for the user. A token is unique: if the phone was used by another account before,
 * the row moves to the account signed in now, so notifications never reach the previous one.
 */
export async function registerPushDevice(userId: string, platform: PushPlatform, token: string, now = new Date()): Promise<void> {
  await db
    .insert(pushDevices)
    .values({ userId, platform, token, createdAt: now, lastSeenAt: now })
    .onConflictDoUpdate({ target: pushDevices.token, set: { userId, platform, lastSeenAt: now } });
}

/** Removes one device of the user (sign-out, push turned off on that phone). */
export async function removePushDevice(userId: string, token: string): Promise<number> {
  const rows = await db.delete(pushDevices).where(and(eq(pushDevices.userId, userId), eq(pushDevices.token, token))).returning({ id: pushDevices.id });
  return rows.length;
}

/** Deletes tokens the provider reported as dead. */
export async function deletePushTokens(tokens: string[]): Promise<void> {
  if (tokens.length > 0) await db.delete(pushDevices).where(inArray(pushDevices.token, tokens));
}

/** Deletes devices not seen for `PUSH_DEVICE_STALE_DAYS` days; returns how many. */
export async function purgeStalePushDevices(now: Date): Promise<number> {
  const before = new Date(now.getTime() - PUSH_DEVICE_STALE_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.delete(pushDevices).where(lt(pushDevices.lastSeenAt, before)).returning({ id: pushDevices.id });
  return rows.length;
}
