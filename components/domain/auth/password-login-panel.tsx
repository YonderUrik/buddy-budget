"use client";

/**
 * PasswordLoginPanel
 *
 * Sign-in with email and password (self-hosted installs): «Entra» with the password, «Crea un account» where signups
 * are open (on an empty instance it opens on «Crea il primo account»), «Password dimenticata?», and the emailed link
 * and Google as alternatives when the instance offers them.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { useInstance } from "@/lib/instance/provider";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { AuthField } from "./auth-field";
import { AUTH_PRIMARY_BUTTON, AUTH_TITLE } from "./auth-styles";
import { GoogleIcon } from "./google-icon";
import { PasswordForgotPanel } from "./password-forgot-panel";
import { usePasswordActions } from "./use-password-actions";

export type PasswordLoginMode = "signin" | "signup" | "forgot";

export interface PasswordLoginPanelProps {
  redirectTo: string;
  /** No account exists yet: the page opens on «Crea il primo account» and offers nothing else. */
  firstAccount?: boolean;
  /** New accounts can be created («Crea un account» link). */
  signupOpen?: boolean;
  /** Opened from a «sign up» button. */
  signup?: boolean;
  /** Email to prefill (the account remembered on this device). */
  defaultEmail?: string;
  /** Sends an emailed sign-in link instead (offered only when the instance can send emails). */
  onSendLink?: (email: string) => void;
  /** Starts «Continua con Google» (offered only when Google is configured). */
  onGoogle?: () => void;
  busy?: boolean;
}

export function PasswordLoginPanel({ redirectTo, firstAccount = false, signupOpen = false, signup = false, defaultEmail = "", onSendLink, onGoogle, busy = false }: PasswordLoginPanelProps) {
  const { t: tr } = useLocalization();
  const { auth } = useInstance();
  const actions = usePasswordActions(redirectTo);
  const [mode, setMode] = React.useState<PasswordLoginMode>(firstAccount || (signup && signupOpen) ? "signup" : "signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState(defaultEmail);
  const [password, setPassword] = React.useState("");
  const disabled = actions.loading || busy;
  const creating = mode === "signup";

  function switchTo(next: PasswordLoginMode) {
    actions.clearError();
    setPassword("");
    setMode(next);
  }

  if (mode === "forgot") {
    return <PasswordForgotPanel email={email} onEmailChange={setEmail} actions={actions} onBack={() => switchTo("signin")} />;
  }

  const title = firstAccount ? tr("Crea il primo account") : creating ? tr("Crea il tuo account") : `${tr("Entra in")} ${tr("BuddyBudget")}`;
  const lead = firstAccount
    ? tr("Questa installazione è nuova: il primo account è il tuo. Gli altri si potranno creare solo se lo permetti nella configurazione.")
    : creating
      ? tr("Scegli una password di almeno {0} caratteri.", { 0: PASSWORD_MIN_LENGTH })
      : tr("Entra con la tua email e la tua password.");

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h1 className={AUTH_TITLE}>{title}</h1>
        <p className="text-text-2">{lead}</p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (creating) {
            void actions.signUp({ name: name.trim() || email.split("@")[0], email, password }).then((ok) => {
              if (ok) track("password_signup_completed", { first: firstAccount });
            });
          } else {
            void actions.signIn(email, password).then((ok) => {
              if (ok) track("password_login_completed");
            });
          }
        }}
      >
        {creating && <AuthField id="name" label={tr("Nome")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={disabled} />}
        <AuthField
          id="email"
          type="email"
          inputMode="email"
          label={tr("Email")}
          placeholder={tr("nome@esempio.it")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete={creating ? "email" : "username"}
          autoFocus={!defaultEmail}
          disabled={disabled}
        />
        <AuthField
          id="password"
          type="password"
          label={tr("Password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={creating ? PASSWORD_MIN_LENGTH : undefined}
          autoComplete={creating ? "new-password" : "current-password"}
          autoFocus={Boolean(defaultEmail) && !creating}
          hint={creating ? tr("Almeno {0} caratteri.", { 0: PASSWORD_MIN_LENGTH }) : undefined}
          disabled={disabled}
          aria-invalid={actions.error ? true : undefined}
        />
        {actions.error && (
          <p className="text-sm text-destructive" role="alert">
            {tr(actions.error)}
          </p>
        )}
        <Button type="submit" className={cn("mt-2 h-11 w-full text-base", AUTH_PRIMARY_BUTTON)} disabled={disabled}>
          {actions.loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {creating ? tr("Crea l'account") : tr("Entra")}
        </Button>
      </form>

      {!firstAccount && (
        <div className="flex flex-col items-center gap-2 text-sm">
          {!creating && (
            <button type="button" className="font-medium text-foreground underline underline-offset-4 hover:text-primary" onClick={() => switchTo("forgot")}>
              {tr("Password dimenticata?")}
            </button>
          )}
          {creating ? (
            <p className="text-text-2">
              {tr("Hai già un account?")}{" "}
              <button type="button" className="font-medium text-foreground underline underline-offset-4 hover:text-primary" onClick={() => switchTo("signin")}>
                {tr("Entra")}
              </button>
            </p>
          ) : (
            signupOpen && (
              <p className="text-text-2">
                {tr("Non hai un account?")}{" "}
                <button type="button" className="font-medium text-foreground underline underline-offset-4 hover:text-primary" onClick={() => switchTo("signup")}>
                  {tr("Creane uno")}
                </button>
              </p>
            )
          )}
        </div>
      )}

      {!firstAccount && !creating && ((auth.magicLink && auth.emailDelivery && onSendLink) || (auth.google && onGoogle)) && (
        <div className="flex flex-col gap-2">
          <p className="text-center text-sm text-text-3">{tr("oppure")}</p>
          {auth.magicLink && auth.emailDelivery && onSendLink && (
            <Button type="button" variant="outline" className="h-11 w-full rounded-full text-base" disabled={disabled || !email} onClick={() => onSendLink(email)}>
              {tr("Mandami un link via email")}
            </Button>
          )}
          {auth.google && onGoogle && (
            <Button type="button" variant="outline" className="h-11 w-full rounded-full text-base" disabled={disabled} onClick={onGoogle}>
              <GoogleIcon className="size-5" />
              {tr("Continua con Google")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
