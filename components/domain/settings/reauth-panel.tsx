"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * ReauthPanel
 *
 * Chiede di confermare l'identità prima di un'azione sensibile (export, reset, disattivazione, eliminazione):
 * la password (dove l'istanza la offre), un nuovo magic link all'email dell'account o un nuovo accesso con Google. Dopo l'accesso si torna a `returnTo`
 * con una sessione nuova, che vale come accesso recente per `RECENT_LOGIN_MAX_AGE_MINUTES` minuti.
 */

import * as React from "react";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleIcon, describePasswordError } from "@/components/domain/auth";
import { useInstance } from "@/lib/instance/provider";
import { authClient } from "@/lib/auth/client";
import { RECENT_LOGIN_MAX_AGE_MINUTES } from "@/lib/account/constants";

export interface ReauthPanelProps {
  email: string;
  googleLinked: boolean;
  /** The account has a password: on instances with password sign-in it confirms the identity right here. */
  passwordSet?: boolean;
  /** Pagina su cui tornare dopo l'accesso. Default: `/impostazioni`. */
  returnTo?: string;
}

export function ReauthPanel({ email, googleLinked, passwordSet = false, returnTo = "/impostazioni" }: ReauthPanelProps) {
  const { t: tr } = useLocalization();
  const { auth } = useInstance();
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "google" | "password">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const withPassword = auth.password && passwordSet;
  const withGoogle = googleLinked && auth.google;

  /** A new password sign-in is a fresh session: reload so the page reads it as a recent login. */
  async function confirmWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setState("password");
    setError(null);
    const { error: authError } = await authClient.signIn.email({ email, password }).catch(() => ({ error: { status: 0 } }));
    if (authError) {
      setError(describePasswordError(authError));
      setState("idle");
      return;
    }
    window.location.assign(returnTo);
  }

  async function sendLink() {
    setState("sending");
    setError(null);
    const { error: authError } = await authClient.signIn.magicLink({ email, callbackURL: returnTo }).catch(() => ({
      error: { status: 0 },
    }));
    if (authError) {
      setError(tr("Non siamo riusciti a inviare il link. Riprova tra poco."));
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
      setError(tr("Accesso con Google non riuscito. Riprova."));
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-4" role="status">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">{tr("Per sicurezza, conferma che sei tu")}</p>
          <p className="text-sm text-muted-foreground">{tr("Questa azione richiede un accesso fatto negli ultimi")}{" "}{RECENT_LOGIN_MAX_AGE_MINUTES}{" "}{tr("minuti. Accedi di nuovo e torni qui.")}</p>
        </div>
      </div>

      {state === "sent" ? (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <MailCheck className="size-4 text-pos" aria-hidden="true" />{tr("Ti abbiamo inviato un link a")}{" "}<strong className="font-medium">{email}</strong>{tr(". Aprilo per continuare.")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {withPassword && (
            <form onSubmit={confirmWithPassword} className="flex w-full flex-wrap gap-2">
              <Input type="password" aria-label={tr("Password")} placeholder={tr("La tua password")} className="sm:w-64" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" disabled={state !== "idle"} />
              <Button type="submit" size="sm" disabled={state !== "idle"}>
                {state === "password" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{tr("Conferma")}</Button>
            </form>
          )}
          {auth.magicLink && (
            <Button type="button" size="sm" variant={withPassword ? "outline" : "default"} onClick={sendLink} disabled={state !== "idle"}>
              {state === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{tr("Inviami un link di accesso")}</Button>
          )}
          {!withPassword && !auth.magicLink && !withGoogle && (
            <p className="text-sm text-muted-foreground">{tr("Esci e rientra, poi torna qui.")}</p>
          )}
          {withGoogle && (
            <Button type="button" size="sm" variant="outline" onClick={signInWithGoogle} disabled={state !== "idle"}>
              {state === "google" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <GoogleIcon className="size-4" />}{tr("Accedi con Google")}</Button>
          )}
        </div>
      )}
      {error && (
        <p className="text-sm text-neg" role="alert">
          {tr(error)}
        </p>
      )}
    </div>
  );
}
