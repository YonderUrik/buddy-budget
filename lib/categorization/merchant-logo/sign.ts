import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { MerchantLogoRef } from "./resolve";

const KEY_CONTEXT = "buddybudget:merchant-logo:v1";
const SIGNATURE_LENGTH = 24;

function signatureFor(kind: MerchantLogoRef["kind"], value: string): string | null {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return null;
  const key = createHmac("sha256", secret).update(KEY_CONTEXT).digest();
  return createHmac("sha256", key).update(`${kind}:${value}`).digest("hex").slice(0, SIGNATURE_LENGTH);
}

/**
 * Indirizzo del logo sul nostro server. I domini del dizionario non hanno firma; gli altri (sito letto nel movimento,
 * nome da cercare) sì: così il server chiede a Logo.dev solo ciò che ha trovato lui nei movimenti, e la rotta non diventa
 * un proxy per domini o nomi qualunque. Null se manca il segreto per firmare.
 */
export function merchantLogoPath(ref: MerchantLogoRef): string | null {
  if (ref.kind === "domain" && ref.origin === "dictionary") return `/api/merchant-logos/${ref.domain}`;
  const value = ref.kind === "domain" ? ref.domain : ref.name;
  const signature = signatureFor(ref.kind, value);
  if (!signature) return null;
  const base = ref.kind === "domain" ? `/api/merchant-logos/${ref.domain}` : `/api/merchant-logos/name/${encodeURIComponent(ref.name)}`;
  return `${base}?s=${signature}`;
}

/** Verifica a tempo costante la firma di un dominio o di un nome. */
export function verifyMerchantLogoSignature(kind: MerchantLogoRef["kind"], value: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = signatureFor(kind, value);
  if (!expected || expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
