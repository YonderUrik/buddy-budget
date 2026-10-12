import "server-only";
import { redis } from "@/lib/redis/client";

/** Errori del browser accettati per utente in una finestra: una pagina in loop non deve riempire i log. */
export const CLIENT_ERROR_RATE_LIMIT = 20;
export const CLIENT_ERROR_RATE_WINDOW_SECONDS = 600;

/** Consuma un posto nella quota dell'utente; true se l'errore va registrato. Con Redis giù lascia passare. */
export async function consumeClientErrorQuota(userId: string): Promise<boolean> {
  const key = `client-errors:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, CLIENT_ERROR_RATE_WINDOW_SECONDS);
    return count <= CLIENT_ERROR_RATE_LIMIT;
  } catch {
    return true;
  }
}
