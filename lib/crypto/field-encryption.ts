import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifratura dei campi delicati nel database (descrizioni e note dei movimenti, note di debiti e investimenti, token).
 * AES-256-GCM con la chiave `DATA_ENCRYPTION_KEY` (32 byte in base64). Il valore cifrato è `enc:v1:` + base64(iv|tag|testo).
 *
 * Pensata per non rompere i dati esistenti:
 * - senza chiave si scrive in chiaro come prima (self-hosting, test, sviluppo);
 * - in lettura un valore senza prefisso è restituito così com'è, quindi righe vecchie in chiaro e righe nuove cifrate
 *   convivono finché `pnpm db:encrypt-fields` non le ha cifrate tutte;
 * - un valore cifrato senza chiave (o con la chiave sbagliata) fa lanciare un errore: meglio fermarsi che mostrare dati falsi.
 *
 * Non va usata su colonne filtrate, ordinate o raggruppate in SQL: l'IV è casuale, quindi lo stesso testo cifrato due
 * volte dà valori diversi.
 */

export const ENCRYPTED_PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

let cached: { raw: string; key: Buffer | null } | null = null;

/** Chiave attiva (o null se non configurata). Legge l'env a ogni chiamata ma decodifica una volta sola per valore. */
export function dataEncryptionKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.DATA_ENCRYPTION_KEY ?? "";
  if (cached && cached.raw === raw) return cached.key;
  let key: Buffer | null = null;
  if (raw !== "") {
    key = Buffer.from(raw, "base64");
    if (key.length !== KEY_BYTES) throw new Error("DATA_ENCRYPTION_KEY deve contenere 32 byte in base64");
  }
  cached = { raw, key };
  return key;
}

/** Vero se il valore è già cifrato con questo schema. */
export function isEncryptedField(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/** Cifra un testo con la chiave data. Già cifrato: restituito com'è (idempotente). */
export function encryptField(value: string, key: Buffer): string {
  if (isEncryptedField(value)) return value;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ENCRYPTED_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

/** Decifra un valore `enc:v1:`; un valore in chiaro è restituito com'è. */
export function decryptField(value: string, key: Buffer | null): string {
  if (!isEncryptedField(value)) return value;
  if (!key) throw new Error("Valore cifrato nel database ma DATA_ENCRYPTION_KEY non è impostata");
  const data = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, IV_BYTES));
  decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(data.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}

/** Scrittura verso il database: cifra se la chiave c'è, altrimenti lascia in chiaro. */
export function sealForDb(value: string): string {
  const key = dataEncryptionKey();
  return key ? encryptField(value, key) : value;
}

/** Lettura dal database: decifra i valori cifrati, lascia com'è il resto. */
export function openFromDb(value: string): string {
  return decryptField(value, dataEncryptionKey());
}
