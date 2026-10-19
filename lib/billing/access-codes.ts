import { createHash, randomInt } from "node:crypto";

/** Letters and digits of a generated code, without the ones easy to confuse (0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Characters of a generated code, in groups of four after `BB-`: 8 × log2(31) ≈ 40 bits, plenty with the rate limit. */
const CODE_GROUPS = 2;
const CODE_GROUP_LENGTH = 4;

/** Longest text accepted as a code (anything longer is not one of ours). */
export const ACCESS_CODE_MAX_LENGTH = 40;

/** A code as typed, normalised: upper case, without spaces and dashes (so «bb-abcd efgh» and «BBABCDEFGH» match). */
export function normalizeAccessCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]+/g, "");
}

/** SHA-256 of the normalised code, the only form stored. */
export function hashAccessCode(raw: string): string {
  return createHash("sha256").update(normalizeAccessCode(raw)).digest("hex");
}

/** New random code, e.g. `BB-K7QM-2XRT`. */
export function generateAccessCode(random: (max: number) => number = randomInt): string {
  const groups = Array.from({ length: CODE_GROUPS }, () =>
    Array.from({ length: CODE_GROUP_LENGTH }, () => CODE_ALPHABET[random(CODE_ALPHABET.length)]).join(""),
  );
  return ["BB", ...groups].join("-");
}

/** Why a code cannot be redeemed. */
export type AccessCodeRejection = "invalid" | "expired" | "used_up" | "already_redeemed";

/** The code fields its validity depends on. */
export interface AccessCodeState {
  maxRedemptions: number;
  redemptions: number;
  expiresAt: Date | null;
  disabledAt: Date | null;
}

/** Null when the code can be redeemed now, otherwise why not. A disabled code reads as invalid (it no longer exists). */
export function accessCodeRejection(code: AccessCodeState | null, now: Date = new Date()): AccessCodeRejection | null {
  if (!code || code.disabledAt) return "invalid";
  if (code.expiresAt && code.expiresAt.getTime() <= now.getTime()) return "expired";
  if (code.redemptions >= code.maxRedemptions) return "used_up";
  return null;
}
