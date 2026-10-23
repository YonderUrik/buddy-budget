import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** New invitation token (in the link) and its hash (in the database). */
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

/** SHA-256 of a token, as stored in `household_invites.token_hash`. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Address of the invitation page for a token. */
export function inviteUrl(token: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/invite/${token}`;
}
