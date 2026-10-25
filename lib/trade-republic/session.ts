import { dataEncryptionKey, decryptField, encryptField, isEncryptedField } from "@/lib/crypto/field-encryption";
import type { TradeRepublicSession } from "./client";

/** TR credentials never fall back to plaintext, including on self-hosted installations. */
export function sealTradeRepublicSession(session: TradeRepublicSession): string {
  const key = dataEncryptionKey();
  if (!key) throw new Error("Trade Republic encryption is not configured");
  return encryptField(JSON.stringify(session), key);
}

/** Only decrypt server-created sessions; phone numbers, PINs and MFA codes are never part of this shape. */
export function openTradeRepublicSession(value: string): TradeRepublicSession {
  if (!isEncryptedField(value)) throw new Error("Unencrypted Trade Republic session refused");
  return JSON.parse(decryptField(value, dataEncryptionKey())) as TradeRepublicSession;
}
