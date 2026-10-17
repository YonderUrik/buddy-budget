"use client";

/**
 * LoginSentPanel
 *
 * «Controlla la tua email» after a magic link went out: where it went, how long it lasts, resend with cooldown and
 * a way back to the previous view.
 */

import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAGIC_LINK_EXPIRES_MINUTES } from "@/lib/auth/constants";
import { useLocalization } from "@/lib/localization/provider";
import { AUTH_TITLE } from "./auth-styles";

export interface LoginSentPanelProps {
  /** Address shown to the user (masked when it comes from the remembered account). */
  email: string;
  loading: boolean;
  cooldown: number;
  /** Error to show, as an Italian catalog key. */
  error: string | null;
  onResend: () => void;
  onBack: () => void;
  /** Label of the way back (e.g. «Usa un'altra email»). */
  backLabel: string;
}

export function LoginSentPanel({ email, loading, cooldown, error, onResend, onBack, backLabel }: LoginSentPanelProps) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex flex-col items-center text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-pos-soft text-pos">
        <MailCheck className="size-7" aria-hidden="true" />
      </div>
      <h1 className={AUTH_TITLE}>{tr("Controlla la tua email")}</h1>
      <p className="mt-3 text-text-2" role="status">{tr("Abbiamo inviato un link di accesso a")}{" "}<strong className="font-medium text-foreground">{email}</strong>{tr(". Resta valido per")}{" "}{MAGIC_LINK_EXPIRES_MINUTES}{" "}{tr("minuti.")}</p>
      <p className="mt-2 text-sm text-text-3">{tr("Non lo trovi? Guarda anche nella cartella spam.")}</p>

      {error && <p className="mt-4 text-sm text-destructive" role="alert">{tr(error)}</p>}

      <div className="mt-8 flex w-full flex-col gap-2">
        <Button type="button" variant="outline" className="h-11 w-full" onClick={onResend} disabled={loading || cooldown > 0}>
          {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {cooldown > 0 ? tr("Invia di nuovo tra {0}s", {0: cooldown}) : tr("Invia di nuovo il link")}
        </Button>
        <Button type="button" variant="ghost" className="h-11 w-full" onClick={onBack}>{backLabel}</Button>
      </div>
    </div>
  );
}
