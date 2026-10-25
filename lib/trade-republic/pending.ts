import "server-only";
import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis/client";
import { openTradeRepublicSession, sealTradeRepublicSession } from "./session";
import type { TradeRepublicSession } from "./client";

const PENDING_TTL = 180;
const pendingKey = (userId: string) => `trade-republic:pending:${userId}`;

/** Pending sessions are user-scoped and expire even when a browser tab is abandoned. */
export async function readPendingLogin(userId: string): Promise<TradeRepublicSession | null> {
  const raw = await redis.get(pendingKey(userId));
  return raw ? openTradeRepublicSession(raw) : null;
}
/** Preserve the original expiry instead of extending MFA indefinitely while polling. */
export async function savePendingLogin(userId: string, session: TradeRepublicSession, initial = false): Promise<void> {
  const value = sealTradeRepublicSession(session);
  if (initial) await redis.set(pendingKey(userId), value, "EX", PENDING_TTL);
  else await redis.set(pendingKey(userId), value, "KEEPTTL", "XX");
}
/** Delete transient credentials after success or cancellation. */
export async function clearPendingLogin(userId: string): Promise<void> { await redis.del(pendingKey(userId)); }

/** Atomic fixed-window limit, shared across app instances. */
export async function allowTradeRepublicAttempt(userId: string, kind: "login" | "poll", limit: number, seconds: number): Promise<boolean> {
  const count = await redis.eval("local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n", 1, `trade-republic:rate:${kind}:${userId}`, seconds);
  return Number(count) <= limit;
}

/** Serialize login actions without retaining a lock if the request is interrupted. */
export async function withTradeRepublicLoginLock<T>(userId: string, action: () => Promise<T>): Promise<T | null> {
  const key = `trade-republic:login-lock:${userId}`;
  const token = randomUUID();
  if (!await redis.set(key, token, "EX", 60, "NX")) return null;
  try { return await action(); }
  finally { await redis.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end; return 0", 1, key, token); }
}
