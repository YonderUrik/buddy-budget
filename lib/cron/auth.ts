import { timingSafeEqual } from "node:crypto";
import { CRON_SECRET_MIN_LENGTH } from "@/lib/env";

/**
 * Verifica `Authorization: Bearer <CRON_SECRET>` (inviato da Vercel Cron o dai CronJob k8s).
 * Confronto a tempo costante; senza segreto configurato, o se troppo corto, rifiuta sempre.
 */
export function isAuthorizedCronRequest(authorizationHeader: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < CRON_SECRET_MIN_LENGTH || !authorizationHeader) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorizationHeader);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
