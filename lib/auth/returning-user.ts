/**
 * Device-local memory of the last account that signed in, used by the login page to offer a one-tap way back in
 * («Rientra in BuddyBudget»). Only the email and the last sign-in method are kept, in localStorage, never on the
 * server; «Non sei tu?» forgets them. Every storage access is wrapped: private windows and blocked storage just
 * fall back to the normal login form.
 */

/** localStorage key of the remembered account. */
export const RETURNING_USER_STORAGE_KEY = "bb.returning-user";

/** Sign-in methods the login page can offer again. */
export type ReturningMethod = "email" | "google" | "apple";

export interface ReturningUser {
  email: string;
  /** Last method used to sign in; `null` when unknown (session started before the method was tracked). */
  method: ReturningMethod | null;
}

/** Characters of the email's local part left visible by `maskEmail`. */
const VISIBLE_LOCAL_CHARS = 3;
const MASK = "•••";

/** Maps better-auth's last-login-method value (`magic-link`, `google`, …) to a method the login page offers. */
export function toReturningMethod(value: string | null | undefined): ReturningMethod | null {
  if (value === "magic-link") return "email";
  if (value === "google") return "google";
  if (value === "apple") return "apple";
  return null;
}

/** Validates a parsed storage value: anything malformed is treated as "no remembered account". */
export function parseReturningUser(raw: string | null): ReturningUser | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const { email, method } = value as Record<string, unknown>;
    if (typeof email !== "string" || !email.includes("@")) return null;
    return { email, method: method === "email" || method === "google" || method === "apple" ? method : null };
  } catch {
    return null;
  }
}

/** Hides most of the email's local part for a shared screen: `daniele@gmail.com` → `dan•••@gmail.com`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const visible = local.slice(0, Math.min(VISIBLE_LOCAL_CHARS, Math.max(1, local.length - 1)));
  return `${visible}${MASK}${email.slice(at)}`;
}

/** Reads the remembered account, or `null` (nothing saved, unreadable storage, server side). */
export function readReturningUser(): ReturningUser | null {
  if (typeof window === "undefined") return null;
  try {
    return parseReturningUser(window.localStorage.getItem(RETURNING_USER_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Remembers the signed-in account. When the method is unknown, an already remembered method for the same email
 * is kept, so a missing cookie does not erase what we knew.
 */
export function rememberReturningUser(user: ReturningUser): void {
  if (typeof window === "undefined") return;
  try {
    const previous = readReturningUser();
    const method = user.method ?? (previous?.email === user.email ? previous.method : null);
    window.localStorage.setItem(RETURNING_USER_STORAGE_KEY, JSON.stringify({ email: user.email, method }));
  } catch {
    // Storage unavailable: the login page shows the normal form.
  }
}

/** Forgets the remembered account («Non sei tu?», account deleted). */
export function forgetReturningUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RETURNING_USER_STORAGE_KEY);
  } catch {
    // Nothing to forget if storage is unavailable.
  }
}
