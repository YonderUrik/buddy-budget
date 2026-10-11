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
import { useSheetFormula } from "./auth-sheet-formula";
import { GoogleIcon } from "./google-icon";
import { LegalLinksNote } from "./legal-links-note";

const RATE_LIMIT_STATUS = 429;
/** Argomento della formula finché il campo email è vuoto. */
const EMAIL_PLACEHOLDER = "nome@esempio.it";

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

/** Form di accesso del foglio: l'email è la cella selezionata e la barra della formula la ripete mentre si scrive. */
export function LoginPanel({ redirectTo, notice }: LoginPanelProps) {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  useSheetFormula(sent ? { fn: "CONTROLLA_EMAIL", arg: email } : { fn: "ACCEDI", arg: email || EMAIL_PLACEHOLDER });

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
        <p className="border-l-2 border-primary pl-3 text-sm text-text-2" role="status">
          {notice}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight text-balance">
          Accedi al tuo <mark className="rounded-sm bg-highlight px-1 text-foreground">foglio</mark>.
        </h1>
        <p className="text-text-2">
          Nessuna password: scrivi l&apos;email e premi Invio, ti mandiamo un link. Se è la prima volta, l&apos;account
          si crea da solo.
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
        <div className="relative">
          <Input
            id="email"
            type="email"
            inputMode="email"
            placeholder={EMAIL_PLACEHOLDER}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
            className="h-11 rounded-sm border-2 border-primary bg-card font-mono text-base focus-visible:border-primary"
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
          {/* Quadratino di trascinamento della cella selezionata. */}
          <span className="pointer-events-none absolute -bottom-1 -right-1 size-2 bg-primary ring-2 ring-card" aria-hidden="true" />
        </div>
        {error && (
          <p id="login-error" className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
          {loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {loading ? "Invio in corso…" : "Inviami il link"}
          {!loading && (
            <kbd className="ml-1 hidden rounded-sm border border-primary-foreground/30 px-1.5 font-mono text-xs sm:inline" aria-hidden="true">
              ↵
            </kbd>
          )}
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
