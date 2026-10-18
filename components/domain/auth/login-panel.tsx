"use client";
import { useLocalization } from "@/lib/localization/provider";

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
const EMAIL_PLACEHOLDER = "nome@esempio.it";

/** Messaggio leggibile per un errore di better-auth (status HTTP opzionale). */
function describeAuthError(error: { status?: number; message?: string } | null | undefined): string {
  if (error?.status === RATE_LIMIT_STATUS) return "Troppi tentativi ravvicinati. Riprova tra qualche minuto.";
  return "Non siamo riusciti a inviare il link. Controlla l'indirizzo e riprova.";
}

export interface LoginPanelProps {
  redirectTo: string;
  googleEnabled: boolean;
  emailDelivery: boolean;
  /** Avviso informativo sopra il form (es. account appena eliminato). */
  notice?: string;
}

/** Form di accesso: titolo, email con la nota sulla durata del link, pulsante, Google e i link legali. */
export function LoginPanel({ redirectTo, notice, googleEnabled, emailDelivery }: LoginPanelProps) {
  const { t: tr } = useLocalization();
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
      setError(tr("Connessione non riuscita. Controlla la rete e riprova."));
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
        setError(tr("Accesso con Google non riuscito. Riprova o usa l'email."));
        setGoogleLoading(false);
      }
    } catch {
      setError(tr("Connessione non riuscita. Controlla la rete e riprova."));
      setGoogleLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-pos-soft text-pos">
          <MailCheck className="size-7" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-3xl font-medium tracking-tight">{tr(emailDelivery ? "Controlla la tua email" : "Il link è nei log dell’app")}</h1>
        {emailDelivery ? (
          <>
            <p className="mt-3 text-text-2" role="status">{tr("Abbiamo inviato un link di accesso a")}{" "}<strong className="font-medium text-foreground">{email}</strong>{tr(". Resta valido per")}{" "}{MAGIC_LINK_EXPIRES_MINUTES}{" "}{tr("minuti.")}</p>
            <p className="mt-2 text-sm text-text-3">{tr("Non lo trovi? Guarda anche nella cartella spam.")}</p>
          </>
        ) : (
          <div className="mt-3 text-sm text-text-2" role="status">
            <p>{tr("Questa installazione non invia email. L’amministratore trova il link di accesso nei log del servizio app.")}</p>
            <code className="mt-3 block rounded-lg bg-muted p-3">docker compose logs app</code>
            <p className="mt-3">{tr("Apri l’ultimo link di accesso: vale pochi minuti e si usa una volta sola.")}</p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-destructive" role="alert">{tr(error)}</p>}

        <div className="mt-8 flex w-full flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={sendLink}
            disabled={loading || cooldown > 0}
          >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {cooldown > 0 ? tr("Invia di nuovo tra {0}s", {0: cooldown}) : tr("Invia di nuovo il link")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full"
            onClick={() => {
              setSent(false);
              setError(null);
            }}
          >{tr("Usa un'altra email")}</Button>
        </div>
      </div>
    );
  }

  const busy = loading || googleLoading;

  return (
    <div className="flex flex-col gap-7">
      {notice && (
        <p className="border-l-2 border-primary pl-3 text-sm text-text-2" role="status">
          {notice}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-[2.1rem] font-semibold leading-tight tracking-tight text-balance">{tr("Entra in")}{" "}{tr("BuddyBudget")}</h1>
        <p className="text-text-2">{tr(emailDelivery ? "Un link via email, nessuna password. Se è la prima volta, l'account si crea da solo." : "Accedi con un link, senza password. Senza email configurata, il link compare nei log dell’app.")}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendLink();
        }}
        className="flex flex-col gap-2"
      >
        <Label htmlFor="email">{tr("Email")}</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          placeholder={tr(EMAIL_PLACEHOLDER)}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
          className="h-11 bg-card px-3.5 text-base"
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : "login-hint"}
        />
        {error ? (
          <p id="login-error" className="text-sm text-destructive" role="alert">
            {tr(error)}
          </p>
        ) : (
          <p id="login-hint" className="text-sm text-text-3">{tr("Il link vale {0} minuti e si usa una volta sola.", {0: MAGIC_LINK_EXPIRES_MINUTES})}</p>
        )}
        <Button type="submit" className="mt-3 h-11 w-full text-base" disabled={busy}>
          {loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {loading ? tr("Invio in corso…") : tr("Mandami il link")}
        </Button>
      </form>

      {googleEnabled && <><div className="flex items-center gap-3 text-sm text-text-3">
        <span className="h-px flex-1 bg-border" />{tr("oppure")}<span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="h-11 w-full text-base" type="button" onClick={handleGoogle} disabled={busy}>
        {googleLoading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <GoogleIcon className="size-5" />}
        {googleLoading ? tr("Reindirizzamento…") : tr("Continua con Google")}
      </Button>
      </>}

      <LegalLinksNote />
    </div>
  );
}
