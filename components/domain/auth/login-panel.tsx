"use client";

/**
 * LoginPanel
 *
 * Accesso via magic link o Google. Gestisce gli errori di invio (niente "controlla la tua email" se l'invio
 * è fallito), il reinvio con attesa minima e il cambio email. `redirectTo` è la pagina dove atterrare dopo
 * l'accesso (già validata dal chiamante).
 */

import * as React from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { MAGIC_LINK_EXPIRES_MINUTES, MAGIC_LINK_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/constants";
import { GoogleIcon } from "./google-icon";
import { LegalLinksNote } from "./legal-links-note";

const RATE_LIMIT_STATUS = 429;

/** Messaggio leggibile per un errore di better-auth (status HTTP opzionale). */
function describeAuthError(error: { status?: number; message?: string } | null | undefined): string {
  if (error?.status === RATE_LIMIT_STATUS) return "Troppi tentativi ravvicinati. Riprova tra qualche minuto.";
  return "Non siamo riusciti a inviare il link. Controlla l'indirizzo e riprova.";
}

export interface LoginPanelProps {
  redirectTo: string;
  /** Avviso informativo sopra il form (es. account appena eliminato). */
  notice?: string;
}

export function LoginPanel({ redirectTo, notice }: LoginPanelProps) {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function sendLink() {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signIn.magicLink({ email, callbackURL: redirectTo });
      if (authError) {
        setError(describeAuthError(authError));
        return;
      }
      setSent(true);
      setCooldown(MAGIC_LINK_RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Connessione non riuscita. Controlla la rete e riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signIn.social({ provider: "google", callbackURL: redirectTo });
      // Se va a buon fine il browser viene reindirizzato a Google: qui arriviamo solo in caso di errore.
      if (authError) {
        setError("Accesso con Google non riuscito. Riprova o usa l'email.");
        setGoogleLoading(false);
      }
    } catch {
      setError("Connessione non riuscita. Controlla la rete e riprova.");
      setGoogleLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-pos-soft text-pos">
          <MailCheck className="size-7" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-3xl font-medium tracking-tight">Controlla la tua email</h1>
        <p className="mt-3 text-text-2" role="status">
          Abbiamo inviato un link di accesso a <strong className="font-medium text-foreground">{email}</strong>.
          Resta valido per {MAGIC_LINK_EXPIRES_MINUTES} minuti.
        </p>
        <p className="mt-2 text-sm text-text-3">Non lo trovi? Guarda anche nella cartella spam.</p>

        {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}

        <div className="mt-8 flex w-full flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={sendLink}
            disabled={loading || cooldown > 0}
          >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {cooldown > 0 ? `Invia di nuovo tra ${cooldown}s` : "Invia di nuovo il link"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full"
            onClick={() => {
              setSent(false);
              setError(null);
            }}
          >
            Usa un&apos;altra email
          </Button>
        </div>
      </div>
    );
  }

  const busy = loading || googleLoading;

  return (
    <div className="flex flex-col gap-8">
      {notice && (
        <p className="rounded-lg bg-muted p-3 text-sm text-foreground" role="status">
          {notice}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">Accedi</h1>
        <p className="text-text-2">
          Nessuna password: ti mandiamo un link via email. Se è la prima volta, l&apos;account si crea da solo.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendLink();
        }}
        className="flex flex-col gap-3"
      >
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          placeholder="nome@esempio.it"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
          className="h-11 text-base"
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
        {error && (
          <p id="login-error" className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
          {loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {loading ? "Invio in corso…" : "Inviami il link"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-sm text-text-3">
        <span className="h-px flex-1 bg-border" />
        oppure
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="h-11 w-full text-base" type="button" onClick={handleGoogle} disabled={busy}>
        {googleLoading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <GoogleIcon className="size-5" />}
        {googleLoading ? "Reindirizzamento…" : "Continua con Google"}
      </Button>

      <LegalLinksNote />
    </div>
  );
}
