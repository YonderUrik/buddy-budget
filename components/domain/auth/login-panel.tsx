"use client";

/**
 * LoginPanel
 *
 * Sign-in via magic link or Google. With an account remembered on this device it opens on «Rientra in BuddyBudget»
 * (one tap to the method used last time); otherwise, or after «Non sei tu?», on the full form. Send errors never
 * show "check your email", the link can be resent after a cooldown. `redirectTo` is where to land after sign-in
 * (already validated by the caller).
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics";
import { MAGIC_LINK_EXPIRES_MINUTES } from "@/lib/auth/constants";
import { maskEmail } from "@/lib/auth/returning-user";
import { useLocalization } from "@/lib/localization/provider";
import { GoogleIcon } from "./google-icon";
import { LegalLinksNote } from "./legal-links-note";
import { LoginSentPanel } from "./login-sent-panel";
import { ReturningLoginPanel } from "./returning-login-panel";
import { useLoginActions } from "./use-login-actions";
import { useReturningUser } from "./use-returning-user";
import { AUTH_PRIMARY_BUTTON, AUTH_TITLE } from "./auth-styles";
import { cn } from "@/lib/utils";

const EMAIL_PLACEHOLDER = "nome@esempio.it";

export interface LoginPanelProps {
  redirectTo: string;
  /** Informational notice above the form (e.g. account just deleted). */
  notice?: string;
  /** Forget the account remembered on this device (e.g. it has just been deleted). */
  forgetRemembered?: boolean;
}

/** Login page content: «Rientra in BuddyBudget», the full form, or «Controlla la tua email» once a link went out. */
export function LoginPanel({ redirectTo, notice, forgetRemembered = false }: LoginPanelProps) {
  const { t: tr } = useLocalization();
  const actions = useLoginActions(redirectTo);
  const { user: remembered, forget } = useReturningUser();
  const [email, setEmail] = React.useState("");

  React.useEffect(() => {
    if (forgetRemembered) forget();
  }, [forgetRemembered, forget]);

  const returning = forgetRemembered ? null : remembered;
  const busy = actions.loading || actions.googleLoading;

  if (actions.sentTo) {
    const fromRemembered = returning?.email === actions.sentTo;
    return (
      <LoginSentPanel
        email={fromRemembered ? maskEmail(actions.sentTo) : actions.sentTo}
        loading={actions.loading}
        cooldown={actions.cooldown}
        error={actions.error}
        onResend={() => void actions.sendLink(actions.sentTo!)}
        onBack={actions.reset}
        backLabel={fromRemembered ? tr("Indietro") : tr("Usa un'altra email")}
      />
    );
  }

  if (returning) {
    return (
      <ReturningLoginPanel
        maskedEmail={maskEmail(returning.email)}
        method={returning.method}
        loading={actions.loading}
        googleLoading={actions.googleLoading}
        error={actions.error}
        onSendLink={async () => {
          if (await actions.sendLink(returning.email)) track("returning_login_used", { method: "email" });
        }}
        onGoogle={() => {
          // Tracked before the redirect: once Google opens, this page is gone.
          track("returning_login_used", { method: "google" });
          void actions.signInWithGoogle();
        }}
        onForget={() => {
          forget();
          track("returning_login_forgotten");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {notice && (
        <p className="border-l-2 border-primary pl-3 text-sm text-text-2" role="status">
          {notice}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <h1 className={AUTH_TITLE}>{tr("Entra in")}{" "}{tr("BuddyBudget")}</h1>
        <p className="text-text-2">{tr("Un link via email, nessuna password. Se è la prima volta, l'account si crea da solo.")}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void actions.sendLink(email);
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
          aria-invalid={actions.error ? true : undefined}
          aria-describedby={actions.error ? "login-error" : "login-hint"}
        />
        {actions.error ? (
          <p id="login-error" className="text-sm text-destructive" role="alert">
            {tr(actions.error)}
          </p>
        ) : (
          <p id="login-hint" className="text-sm text-text-3">{tr("Il link vale {0} minuti e si usa una volta sola.", {0: MAGIC_LINK_EXPIRES_MINUTES})}</p>
        )}
        <Button type="submit" className={cn("mt-3 h-11 w-full text-base", AUTH_PRIMARY_BUTTON)} disabled={busy}>
          {actions.loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {actions.loading ? tr("Invio in corso…") : tr("Mandami il link")}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-sm text-text-3">
        <span className="h-px flex-1 bg-border" />{tr("oppure")}<span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="h-11 w-full text-base" type="button" onClick={() => void actions.signInWithGoogle()} disabled={busy}>
        {actions.googleLoading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <GoogleIcon className="size-5" />}
        {actions.googleLoading ? tr("Reindirizzamento…") : tr("Continua con Google")}
      </Button>

      <LegalLinksNote />
    </div>
  );
}
