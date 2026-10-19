"use client";

/**
 * PasswordForgotPanel
 *
 * «Password dimenticata?»: with an email service, a reset link to the address; without one, how whoever runs the
 * instance sets a new password from the command line.
 */

import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PASSWORD_RESET_EXPIRES_MINUTES } from "@/lib/auth/constants";
import { useInstance } from "@/lib/instance/provider";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { AuthField } from "./auth-field";
import { AUTH_PRIMARY_BUTTON, AUTH_TITLE } from "./auth-styles";
import type { PasswordActions } from "./use-password-actions";

/** Command that sets a new password on a docker compose install (docs/self-hosting.md). */
export const RESET_PASSWORD_COMMAND = "docker compose run --rm migrate pnpm auth:reset-password";

export interface PasswordForgotPanelProps {
  email: string;
  onEmailChange: (email: string) => void;
  actions: PasswordActions;
  onBack: () => void;
}

export function PasswordForgotPanel({ email, onEmailChange, actions, onBack }: PasswordForgotPanelProps) {
  const { t: tr } = useLocalization();
  const { auth } = useInstance();

  if (!auth.emailDelivery) {
    return (
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-3">
          <h1 className={AUTH_TITLE}>{tr("Password dimenticata")}</h1>
          <p className="text-text-2">{tr("Questa installazione non manda email, quindi la password la reimposta chi la gestisce, dal computer dove gira:")}</p>
        </div>
        <pre className="whitespace-pre-wrap break-all rounded-xl bg-muted px-4 py-3 text-sm">
          <code>{`${RESET_PASSWORD_COMMAND} ${email || tr("nome@esempio.it")}`}</code>
        </pre>
        <p className="text-sm text-text-2">{tr("Il comando stampa una nuova password e chiude le sessioni aperte.")}</p>
        <Button type="button" variant="ghost" className="h-11 w-full rounded-full" onClick={onBack}>
          {tr("Indietro")}
        </Button>
      </div>
    );
  }

  if (actions.resetSentTo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-pos-soft text-pos">
          <MailCheck className="size-7" aria-hidden="true" />
        </div>
        <h1 className={AUTH_TITLE}>{tr("Controlla la tua email")}</h1>
        <p className="text-text-2" role="status">
          {tr("Se {0} ha un account, gli abbiamo mandato un link per scegliere una nuova password. Vale {1} minuti.", { 0: actions.resetSentTo, 1: PASSWORD_RESET_EXPIRES_MINUTES })}
        </p>
        <Button type="button" variant="ghost" className="mt-5 h-11 w-full rounded-full" onClick={onBack}>
          {tr("Torna all'accesso")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h1 className={AUTH_TITLE}>{tr("Password dimenticata")}</h1>
        <p className="text-text-2">{tr("Ti mandiamo un link per sceglierne una nuova.")}</p>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void actions.requestReset(email);
        }}
      >
        <AuthField id="email" type="email" inputMode="email" label={tr("Email")} value={email} onChange={(e) => onEmailChange(e.target.value)} required autoComplete="username" autoFocus disabled={actions.loading} />
        {actions.error && (
          <p className="text-sm text-destructive" role="alert">
            {tr(actions.error)}
          </p>
        )}
        <Button type="submit" className={cn("mt-2 h-11 w-full text-base", AUTH_PRIMARY_BUTTON)} disabled={actions.loading}>
          {actions.loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {tr("Mandami il link")}
        </Button>
      </form>
      <Button type="button" variant="ghost" className="h-11 w-full rounded-full" onClick={onBack}>
        {tr("Indietro")}
      </Button>
    </div>
  );
}
