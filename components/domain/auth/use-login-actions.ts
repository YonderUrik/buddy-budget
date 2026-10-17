"use client";

/**
 * State and actions shared by the login views (full form, «Rientra in BuddyBudget», «Controlla la tua email»):
 * magic-link sending with resend cooldown, Google redirect and readable errors.
 */

import * as React from "react";
import { authClient } from "@/lib/auth/client";
import { MAGIC_LINK_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/constants";

const RATE_LIMIT_STATUS = 429;
const RATE_LIMIT_ERROR = "Troppi tentativi ravvicinati. Riprova tra qualche minuto.";
const SEND_ERROR = "Non siamo riusciti a inviare il link. Controlla l'indirizzo e riprova.";
const NETWORK_ERROR = "Connessione non riuscita. Controlla la rete e riprova.";
const GOOGLE_ERROR = "Accesso con Google non riuscito. Riprova o usa l'email.";

/** Readable message (an Italian catalog key) for a better-auth error with an optional HTTP status. */
function describeAuthError(error: { status?: number } | null | undefined): string {
  return error?.status === RATE_LIMIT_STATUS ? RATE_LIMIT_ERROR : SEND_ERROR;
}

export interface LoginActions {
  /** Email the last link was sent to; `null` until a link has been sent. */
  sentTo: string | null;
  loading: boolean;
  googleLoading: boolean;
  /** Error to show, as an Italian catalog key (translate with `tr`). */
  error: string | null;
  /** Seconds left before a new link can be requested. */
  cooldown: number;
  /** Sends a magic link; resolves `true` when the email went out. */
  sendLink: (email: string) => Promise<boolean>;
  /** Starts the Google redirect; resolves `false` when it could not start. */
  signInWithGoogle: () => Promise<boolean>;
  /** Back from «Controlla la tua email» to the form. */
  reset: () => void;
}

/** Login actions landing on `redirectTo` (already validated by the caller). */
export function useLoginActions(redirectTo: string): LoginActions {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function sendLink(email: string): Promise<boolean> {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signIn.magicLink({ email, callbackURL: redirectTo });
      if (authError) {
        setError(describeAuthError(authError));
        return false;
      }
      setSentTo(email);
      setCooldown(MAGIC_LINK_RESEND_COOLDOWN_SECONDS);
      return true;
    } catch {
      setError(NETWORK_ERROR);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle(): Promise<boolean> {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signIn.social({ provider: "google", callbackURL: redirectTo });
      // On success the browser is already on its way to Google: we only get here on error.
      if (authError) {
        setError(GOOGLE_ERROR);
        setGoogleLoading(false);
        return false;
      }
      return true;
    } catch {
      setError(NETWORK_ERROR);
      setGoogleLoading(false);
      return false;
    }
  }

  function reset() {
    setSentTo(null);
    setError(null);
  }

  return { sentTo, loading, googleLoading, error, cooldown, sendLink, signInWithGoogle, reset };
}
