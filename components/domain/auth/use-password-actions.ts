"use client";

/**
 * State and actions of the password sign-in views: sign in, create an account, ask for a reset link.
 * After sign-in or sign-up the browser goes to `redirectTo` with a full load, so the server reads the new session.
 */

import * as React from "react";
import { authClient } from "@/lib/auth/client";

/** Path of the page that receives the emailed reset link (`app/(auth)/reimposta-password`). */
export const PASSWORD_RESET_PAGE_PATH = "/reimposta-password";

const RATE_LIMIT_ERROR = "Troppi tentativi ravvicinati. Riprova tra qualche minuto.";
const NETWORK_ERROR = "Connessione non riuscita. Controlla la rete e riprova.";
const WRONG_CREDENTIALS_ERROR = "Email o password non corretti.";
const ACCOUNT_EXISTS_ERROR = "Esiste già un account con questa email: entra con la tua password.";
const PASSWORD_LENGTH_ERROR = "La password deve avere almeno 10 caratteri.";
const SIGNUPS_CLOSED_ERROR = "Su questa installazione non si possono creare nuovi account. Chiedi a chi la gestisce.";
const GENERIC_ERROR = "Qualcosa non ha funzionato. Riprova.";

/** Readable message (an Italian catalog key) for a better-auth error. */
export function describePasswordError(error: { status?: number; code?: string } | null | undefined): string {
  if (!error) return GENERIC_ERROR;
  if (error.status === 429) return RATE_LIMIT_ERROR;
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return WRONG_CREDENTIALS_ERROR;
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return ACCOUNT_EXISTS_ERROR;
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
      return PASSWORD_LENGTH_ERROR;
    case "SIGNUPS_CLOSED":
      return SIGNUPS_CLOSED_ERROR;
    default:
      return error.status === 401 ? WRONG_CREDENTIALS_ERROR : GENERIC_ERROR;
  }
}

export interface PasswordActions {
  loading: boolean;
  /** Error to show, as an Italian catalog key (translate with `tr`). */
  error: string | null;
  /** Email a reset link was asked for; `null` until then. */
  resetSentTo: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<boolean>;
  requestReset: (email: string) => Promise<boolean>;
  clearError: () => void;
}

/** Password actions landing on `redirectTo` (already validated by the caller). */
export function usePasswordActions(redirectTo: string): PasswordActions {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = React.useState<string | null>(null);

  async function run(action: () => Promise<{ error: { status?: number; code?: string } | null }>, onSuccess: () => void): Promise<boolean> {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await action();
      if (authError) {
        setError(describePasswordError(authError));
        setLoading(false);
        return false;
      }
      onSuccess();
      return true;
    } catch {
      setError(NETWORK_ERROR);
      setLoading(false);
      return false;
    }
  }

  // Full load: the proxy and the server components read the session cookie that was just set.
  const go = () => window.location.assign(redirectTo);

  return {
    loading,
    error,
    resetSentTo,
    signIn: (email, password) => run(() => authClient.signIn.email({ email, password }), go),
    signUp: ({ name, email, password }) => run(() => authClient.signUp.email({ name, email, password }), go),
    requestReset: (email) =>
      run(
        () => authClient.requestPasswordReset({ email, redirectTo: PASSWORD_RESET_PAGE_PATH }),
        () => {
          setResetSentTo(email);
          setLoading(false);
        },
      ),
    clearError: () => setError(null),
  };
}
