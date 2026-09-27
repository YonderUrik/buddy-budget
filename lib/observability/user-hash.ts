import { createHash } from "node:crypto";

/** Lunghezza (caratteri esadecimali) dell'identificativo utente pseudonimizzato nei log. */
export const USER_HASH_LENGTH = 16;

/**
 * Pseudonimizza un id utente per i log: primi 16 hex di sha256. Non reversibile senza il DB
 * (gli id sono casuali), ricalcolabile da chi ha accesso al DB per un debug mirato.
 * Mai usarlo come etichetta di metrica (cardinalità).
 */
export function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, USER_HASH_LENGTH);
}
