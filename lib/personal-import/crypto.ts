import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function key() {
  const key = Buffer.from(process.env.PERSONAL_CSV_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("PERSONAL_CSV_ENCRYPTION_KEY deve contenere 32 byte in base64");
  return key;
}
export function seal(value: string, owner: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(owner));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function unseal(value: string, owner: string) {
  const data = Buffer.from(value, "base64"), decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(owner)); decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}
