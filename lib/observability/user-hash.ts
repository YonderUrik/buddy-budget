import { createHash, createHmac } from "node:crypto";

/** Lunghezza (caratteri esadecimali) dell'identificativo utente pseudonimizzato nei log. */
export const USER_HASH_LENGTH = 16;

/**
 * Pseudonimizza un id utente per i log: primi 16 hex di HMAC-SHA256 con `LOG_HASH_SECRET`
 * (senza segreto, come in sviluppo e nei test, sha256 semplice). Con il segreto l'identificativo
 * non si ricalcola da un id noto senza averlo; chi ha il segreto e il DB può comunque risalire
 * all'utente per un debug mirato. Cambiare il segreto spezza la continuità dei log già scritti.
 * Mai usarlo come etichetta di metrica (cardinalità).
 */
export function hashUserId(userId: string): string {
  const secret = process.env.LOG_HASH_SECRET;
  const digest = secret
    ? createHmac("sha256", secret).update(userId).digest("hex")
    : createHash("sha256").update(userId).digest("hex");
  return digest.slice(0, USER_HASH_LENGTH);
}
