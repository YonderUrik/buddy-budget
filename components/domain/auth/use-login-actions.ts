"use client";

/**
 * State and actions shared by the login views (full form, «Rientra in BuddyBudget», «Controlla la tua email»):
 * magic-link sending with resend cooldown, Google and Apple sign-in and readable errors.
 * On the web Google is a redirect; inside the phone app Google blocks its page in WebViews, so Google and Apple open the
 * system sign-in sheet and the ID token goes to better-auth (`signIn.social` with `idToken`).
 */

import * as React from "react";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { MAGIC_LINK_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/constants";
import { useNativePlatform } from "@/lib/hooks/use-native-platform";
import { loadNativeAuthConfig, nativeSocialSignIn, type NativeAuthConfig, type NativeSignInProvider } from "@/lib/native";

const RATE_LIMIT_STATUS = 429;
const RATE_LIMIT_ERROR = "Troppi tentativi ravvicinati. Riprova tra qualche minuto.";
const SEND_ERROR = "Non siamo riusciti a inviare il link. Controlla l'indirizzo e riprova.";
const NETWORK_ERROR = "Connessione non riuscita. Controlla la rete e riprova.";
const GOOGLE_ERROR = "Accesso con Google non riuscito. Riprova o usa l'email.";
const APPLE_ERROR = "Accesso con Apple non riuscito. Riprova o usa l'email.";

/** Readable message (an Italian catalog key) for a better-auth error with an optional HTTP status. */
function describeAuthError(error: { status?: number } | null | undefined): string {
  return error?.status === RATE_LIMIT_STATUS ? RATE_LIMIT_ERROR : SEND_ERROR;
}

export interface LoginActions {
  /** Email the last link was sent to; `null` until a link has been sent. */
  sentTo: string | null;
  loading: boolean;
  googleLoading: boolean;
  appleLoading: boolean;
  /** Google can be offered: always on the web, in the phone app only when the server has a Google client. */
  googleAvailable: boolean;
  /** Sign in with Apple can be offered: only in the iPhone app with Apple configured on the server. */
  appleAvailable: boolean;
  /** Error to show, as an Italian catalog key (translate with `tr`). */
  error: string | null;
  /** Seconds left before a new link can be requested. */
  cooldown: number;
  /** Sends a magic link; resolves `true` when the email went out. */
  sendLink: (email: string) => Promise<boolean>;
  /** Starts Google sign-in; resolves `false` when it could not start or did not finish. */
  signInWithGoogle: () => Promise<boolean>;
  /** Starts Sign in with Apple (iPhone app only); resolves `false` when it did not finish. */
  signInWithApple: () => Promise<boolean>;
  /** Back from «Controlla la tua email» to the form. */
  reset: () => void;
}

/** Login actions landing on `redirectTo` (already validated by the caller). */
export function useLoginActions(redirectTo: string): LoginActions {
  const native = useNativePlatform();
  const [nativeConfig, setNativeConfig] = React.useState<NativeAuthConfig | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (!native) return;
    let active = true;
    void loadNativeAuthConfig().then((config) => {
      if (active) setNativeConfig(config);
    });
    return () => {
      active = false;
    };
  }, [native]);

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

  /** Native sheet → ID token → better-auth session cookie in the WebView, then the same landing page as the web. */
  async function signInNatively(provider: NativeSignInProvider, failure: string, setBusy: (busy: boolean) => void): Promise<boolean> {
    if (!nativeConfig) return false;
    setBusy(true);
    setError(null);
    try {
      const result = await nativeSocialSignIn(provider, nativeConfig);
      if (result === "cancelled" || result === "failed") {
        track("native_sign_in", { provider, outcome: result });
        if (result === "failed") setError(failure);
        setBusy(false);
        return false;
      }
      const { error: authError } = await authClient.signIn.social({
        provider,
        callbackURL: redirectTo,
        idToken: { token: result.idToken, ...(result.name ? { user: { name: result.name } } : {}) },
      });
      if (authError) {
        track("native_sign_in", { provider, outcome: "failed" });
        setError(failure);
        setBusy(false);
        return false;
      }
      track("native_sign_in", { provider, outcome: "success" });
      window.location.assign(redirectTo);
      return true;
    } catch {
      setError(NETWORK_ERROR);
      setBusy(false);
      return false;
    }
  }

  async function signInWithGoogle(): Promise<boolean> {
    if (native) return signInNatively("google", GOOGLE_ERROR, setGoogleLoading);
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

  function signInWithApple(): Promise<boolean> {
    return signInNatively("apple", APPLE_ERROR, setAppleLoading);
  }

  function reset() {
    setSentTo(null);
    setError(null);
  }

  return {
    sentTo,
    loading,
    googleLoading,
    appleLoading,
    googleAvailable: native ? Boolean(nativeConfig?.google) : true,
    appleAvailable: native === "ios" && Boolean(nativeConfig?.apple),
    error,
    cooldown,
    sendLink,
    signInWithGoogle,
    signInWithApple,
    reset,
  };
}
