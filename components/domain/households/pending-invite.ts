"use client";

/**
 * The invitation a signed-out visitor opened, kept on the device: a new account goes through onboarding first, then
 * `PendingInviteRedirect` brings it back to the invitation. Storage can fail (private mode): then the visitor opens
 * the link again.
 */

const KEY = "bb-pending-invite";

export function rememberPendingInvite(token: string) {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {}
}

export function forgetPendingInvite() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}

export function readPendingInvite(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
