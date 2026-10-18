"use client";

/**
 * ReturningLoginPanel
 *
 * «Rientra in BuddyBudget»: the login view for an account remembered on this device. One main button repeats the
 * method used last time (link to the remembered email, or Google), the other method stays one tap away, and
 * «Non sei tu?» forgets the account and opens the full form.
 */

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAGIC_LINK_EXPIRES_MINUTES } from "@/lib/auth/constants";
import type { ReturningMethod } from "@/lib/auth/returning-user";
import { useInstance } from "@/lib/instance/provider";
import { useLocalization } from "@/lib/localization/provider";
import { GoogleIcon } from "./google-icon";
import { LegalLinksNote } from "./legal-links-note";
import { AUTH_PRIMARY_BUTTON, AUTH_TITLE } from "./auth-styles";
import { cn } from "@/lib/utils";

export interface ReturningLoginPanelProps {
  /** Remembered email, already masked for display. */
  maskedEmail: string;
  /** Method used last time; unknown methods default to the email link. */
  method: ReturningMethod | null;
  loading: boolean;
  googleLoading: boolean;
  /** Error to show, as an Italian catalog key. */
  error: string | null;
  onSendLink: () => void;
  onGoogle: () => void;
  /** «Non sei tu?»: forget the account and show the full form. */
  onForget: () => void;
}

export function ReturningLoginPanel({ maskedEmail, method, loading, googleLoading, error, onSendLink, onGoogle, onForget }: ReturningLoginPanelProps) {
  const { t: tr } = useLocalization();
  const { auth, selfHosted } = useInstance();
  const busy = loading || googleLoading;
  const googleFirst = method === "google" && auth.google;

  const linkButton = (primary: boolean) => (
    <Button type="button" variant={primary ? "default" : "outline"} className={cn("h-11 w-full rounded-full rounded-full text-base", primary && AUTH_PRIMARY_BUTTON)} onClick={onSendLink} disabled={busy}>
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
      {loading ? tr("Invio in corso…") : primary ? tr("Mandami il link") : tr("Mandami il link via email")}
    </Button>
  );
  const googleButton = (primary: boolean) => (
    <Button type="button" variant={primary ? "default" : "outline"} className={cn("h-11 w-full rounded-full rounded-full text-base", primary && AUTH_PRIMARY_BUTTON)} onClick={onGoogle} disabled={busy}>
      {googleLoading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <GoogleIcon className="size-5" />}
      {googleLoading ? tr("Reindirizzamento…") : tr("Continua con Google")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h1 className={AUTH_TITLE}>{tr("Rientra in BuddyBudget")}</h1>
        <p className="text-text-2">{tr("Su questo dispositivo ricordiamo il tuo account, così non devi riscrivere l'email.")}</p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-heading text-lg font-semibold uppercase text-foreground" aria-hidden="true">
          {maskedEmail.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{maskedEmail}</p>
          <p className="text-sm text-text-3">{googleFirst ? tr("Ultimo accesso con Google") : tr("Ultimo accesso con il link via email")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {googleFirst ? googleButton(true) : linkButton(true)}
        {error ? (
          <p className="text-sm text-destructive" role="alert">{tr(error)}</p>
        ) : (
          !googleFirst && <p className="text-sm text-text-3">{tr("Il link arriva a questo indirizzo e vale {0} minuti.", {0: MAGIC_LINK_EXPIRES_MINUTES})}</p>
        )}
      </div>

      {(googleFirst || auth.google) && <p className="text-center text-sm text-text-3">{tr("oppure")}</p>}

      <div className="flex flex-col gap-2">
        {googleFirst ? linkButton(false) : auth.google && googleButton(false)}
        <Button type="button" variant="ghost" className="h-11 w-full rounded-full" onClick={onForget} disabled={busy}>{tr("Non sei tu? Usa un altro account")}</Button>
      </div>

      {!selfHosted && <LegalLinksNote />}
    </div>
  );
}
