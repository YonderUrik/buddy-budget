import { dataEncryptionKey, decryptField, encryptField, isEncryptedField } from "@/lib/crypto/field-encryption";
import { isSelfHosted, parseFlag } from "@/lib/instance/config";

type Env = Record<string, string | undefined>;

/**
 * Whether new IBKR Flex connections can be made here. Unset means closed on the hosted version, open on a self-hosted
 * install: a hosted service using customers' Flex tokens waits on IBKR's confirmation that it is allowed. Without
 * `DATA_ENCRYPTION_KEY` it is never configured, because tokens are never stored in plaintext.
 */
export function ibkrFlexAvailability(env: Env = process.env): { open: boolean; configured: boolean } {
  const open = parseFlag(env.IBKR_FLEX_CONNECTIONS_OPEN) ?? isSelfHosted(env);
  return { open, configured: open && dataEncryptionKey(env) !== null };
}

/** Flex tokens never fall back to plaintext, including on self-hosted installations. */
export function sealFlexToken(token: string, env: Env = process.env): string {
  const key = dataEncryptionKey(env);
  if (!key) throw new Error("IBKR Flex token encryption is not configured");
  return encryptField(token, key);
}

/** Decrypt a stored token; an unencrypted value is refused, never used. */
export function openFlexToken(value: string, env: Env = process.env): string {
  if (!isEncryptedField(value)) throw new Error("Unencrypted IBKR Flex token refused");
  return decryptField(value, dataEncryptionKey(env));
}
