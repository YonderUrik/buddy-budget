import "server-only";
/**
 * Limits of «Chiedi all'AI» in «Cerca», so a person or a script cannot turn it into a free chatbot or a bill: a short
 * sentence with letters in it, a few questions per user per hour and per day, a ceiling for the whole service per day
 * (a cost breaker), and the same sentence answered from a 24-hour cache instead of a new paid call. Counters live on
 * Redis; when Redis does not answer the question is refused (fail closed: the rules in the browser keep working).
 */

import { createHash } from "node:crypto";
import { redis } from "@/lib/redis/client";
import { COMMAND_MAX_LENGTH, type CommandDraft } from "./types";

export const COMMAND_AI_LIMITS = { perHour: 10, perDay: 40, servicePerDay: 3_000 } as const;
const CACHE_SECONDS = 24 * 60 * 60;

export type SentenceProblem = "empty" | "too_long" | "no_letters";

/** Why a sentence is refused before any counter or model call, or null when it can go on. */
export function checkSentence(sentence: string): SentenceProblem | null {
  if (sentence.trim().length < 3) return "empty";
  if (sentence.length > COMMAND_MAX_LENGTH) return "too_long";
  if (!/\p{L}{2,}/u.test(sentence)) return "no_letters";
  return null;
}

async function bump(key: string, ttlSeconds: number): Promise<number> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, ttlSeconds);
  return count;
}

/** Counts one model question for the user and the service; false when a limit is reached or Redis is down. */
export async function consumeCommandQuota(userId: string, now = new Date()): Promise<boolean> {
  const day = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13);
  try {
    const [perHour, perDay, service] = await Promise.all([
      bump(`commands:ai:h:${userId}:${hour}`, 60 * 60),
      bump(`commands:ai:d:${userId}:${day}`, CACHE_SECONDS),
      bump(`commands:ai:service:${day}`, CACHE_SECONDS),
    ]);
    return perHour <= COMMAND_AI_LIMITS.perHour && perDay <= COMMAND_AI_LIMITS.perDay && service <= COMMAND_AI_LIMITS.servicePerDay;
  } catch {
    return false;
  }
}

const cacheKey = (userId: string, sentence: string, today: string) =>
  `commands:ai:cache:${createHash("sha256").update(`${userId}\n${today}\n${sentence.trim().toLocaleLowerCase()}`).digest("hex")}`;

/** A previous answer to the same sentence today (null draft = «not something to add»), or undefined. */
export async function cachedInterpretation(userId: string, sentence: string, today: string): Promise<CommandDraft | null | undefined> {
  try {
    const value = await redis.get(cacheKey(userId, sentence, today));
    return value === null ? undefined : (JSON.parse(value) as CommandDraft | null);
  } catch {
    return undefined;
  }
}

export async function cacheInterpretation(userId: string, sentence: string, today: string, draft: CommandDraft | null): Promise<void> {
  try {
    await redis.set(cacheKey(userId, sentence, today), JSON.stringify(draft), "EX", CACHE_SECONDS);
  } catch {
    // Without the cache the next identical question is just another counted call.
  }
}
