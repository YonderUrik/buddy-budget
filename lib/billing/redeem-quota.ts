import "server-only";
import { redis } from "@/lib/redis/client";
import { REDEEM_ATTEMPTS_LIMIT, REDEEM_WINDOW_SECONDS } from "./constants";

/** Takes one access-code attempt for the account; false once the limit is reached. With Redis down it lets the attempt through. */
export async function consumeRedeemAttempt(userId: string): Promise<boolean> {
  const key = `billing:redeem:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, REDEEM_WINDOW_SECONDS);
    return count <= REDEEM_ATTEMPTS_LIMIT;
  } catch {
    return true;
  }
}
