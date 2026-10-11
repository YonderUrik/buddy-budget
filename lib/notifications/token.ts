import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { UNSUBSCRIBE_SCOPES, type UnsubscribeScope } from "./constants";

const TOKEN_SEPARATOR = ".";
const SIGNATURE_LENGTH = 32;
const KEY_CONTEXT = "buddybudget:email-unsubscribe:v1";

export interface UnsubscribePayload {
  userId: string;
  scope: UnsubscribeScope;
}

function sign(userId: string, scope: UnsubscribeScope): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET mancante: impossibile firmare il link di disiscrizione");
  const key = createHmac("sha256", secret).update(KEY_CONTEXT).digest();
  return createHmac("sha256", key).update(`${scope}:${userId}`).digest("hex").slice(0, SIGNATURE_LENGTH);
}

/**
 * Token del link di disiscrizione: `<userId>.<ambito>.<firma>`, firmato con un segreto derivato da `BETTER_AUTH_SECRET`.
 * Non scade di proposito (RFC 8058: il link deve funzionare finché esiste l'email) e permette solo di spegnere
 * le email di quell'ambito per quell'utente, niente altro.
 */
export function createUnsubscribeToken(payload: UnsubscribePayload): string {
  const encodedUser = Buffer.from(payload.userId, "utf8").toString("base64url");
  return [encodedUser, payload.scope, sign(payload.userId, payload.scope)].join(TOKEN_SEPARATOR);
}

/** Verifica il token a tempo costante. Null se è malformato o la firma non torna. */
export function verifyUnsubscribeToken(token: string | null | undefined): UnsubscribePayload | null {
  if (!token) return null;
  const parts = token.split(TOKEN_SEPARATOR);
  if (parts.length !== 3) return null;
  const [encodedUser, scope, signature] = parts;
  if (!(UNSUBSCRIBE_SCOPES as readonly string[]).includes(scope)) return null;
  const userId = Buffer.from(encodedUser, "base64url").toString("utf8");
  if (!userId) return null;
  let expected: string;
  try {
    expected = sign(userId, scope as UnsubscribeScope);
  } catch {
    return null;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId, scope: scope as UnsubscribeScope };
}

/** Indirizzo pubblico della pagina di disiscrizione (un clic, senza login). */
export function unsubscribePageUrl(appUrl: string, token: string): string {
  return `${appUrl}/disiscrizione?t=${encodeURIComponent(token)}`;
}

/** Indirizzo dell'endpoint `List-Unsubscribe` (POST one-click, RFC 8058). */
export function unsubscribeApiUrl(appUrl: string, token: string): string {
  return `${appUrl}/api/email/unsubscribe?t=${encodeURIComponent(token)}`;
}
