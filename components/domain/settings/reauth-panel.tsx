"use client";

/**
 * ReauthPanel
 *
 * Chiede di confermare l'identità prima di un'azione sensibile (export, reset, disattivazione, eliminazione):
 * un nuovo magic link all'email dell'account o un nuovo accesso con Google. Dopo l'accesso si torna a `returnTo`
 * con una sessione nuova, che vale come accesso recente per `RECENT_LOGIN_MAX_AGE_MINUTES` minuti.
 */

import * as React from "react";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/domain/auth";
import { authClient } from "@/lib/auth/client";
import { RECENT_LOGIN_MAX_AGE_MINUTES } from "@/lib/account/constants";

export interface ReauthPanelProps {
  email: string;
  googleLinked: boolean;
  /** Pagina su cui tornare dopo l'accesso. Default: `/impostazioni`. */
  returnTo?: string;
}

export function ReauthPanel({ email, googleLinked, returnTo = "/impostazioni" }: ReauthPanelProps) {
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "google">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function sendLink() {
    setState("sending");
    setError(null);
    const { error: authError } = await authClient.signIn.magicLink({ email, callbackURL: returnTo }).catch(() => ({
      error: { status: 0 },
    }));
    if (authError) {
      setError("Non siamo riusciti a inviare il link. Riprova tra poco.");
      setState("idle");
      return;
    }
    setState("sent");
  }

  async function signInWithGoogle() {
    setState("google");
    setError(null);
    const { error: authError } = await authClient.signIn
      .social({ provider: "google", callbackURL: returnTo })
      .catch(() => ({ error: { status: 0 } }));
    if (authError) {
      setError("Accesso con Google non riuscito. Riprova.");
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-4" role="status">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">Per sicurezza, conferma che sei tu</p>
          <p className="text-sm text-muted-foreground">
            Questa azione richiede un accesso fatto negli ultimi {RECENT_LOGIN_MAX_AGE_MINUTES} minuti. Accedi di nuovo e
            torni qui.
          </p>
        </div>
      </div>

      {state === "sent" ? (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <MailCheck className="size-4 text-pos" aria-hidden="true" />
          Ti abbiamo inviato un link a <strong className="font-medium">{email}</strong>. Aprilo per continuare.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={sendLink} disabled={state !== "idle"}>
            {state === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Inviami un link di accesso
          </Button>
          {googleLinked && (
            <Button type="button" size="sm" variant="outline" onClick={signInWithGoogle} disabled={state !== "idle"}>
              {state === "google" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <GoogleIcon className="size-4" />}
              Accedi con Google
            </Button>
          )}
        </div>
      )}
      {error && (
        <p className="text-sm text-neg" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
