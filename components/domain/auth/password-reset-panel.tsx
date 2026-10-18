"use client";

/**
 * PasswordResetPanel
 *
 * The page opened from the emailed reset link: a new password, then straight to the sign-in page. An expired or
 * already used link says so and leads back to «Password dimenticata?».
 */

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { AuthField } from "./auth-field";
import { AUTH_PRIMARY_BUTTON, AUTH_TITLE } from "./auth-styles";
import { describePasswordError } from "./use-password-actions";

/** Sign-in page, where the user goes after the new password is saved. */
const LOGIN_PATH = "/login";

export function PasswordResetPanel() {
  const { t: tr } = useLocalization();
  const token = useSearchParams().get("token");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-3">
          <h1 className={AUTH_TITLE}>{tr("Link scaduto")}</h1>
          <p className="text-text-2">{tr("Il link per reimpostare la password non vale più. Chiedine uno nuovo da «Password dimenticata?».")}</p>
        </div>
        <a href={LOGIN_PATH} className={cn(buttonVariants(), "h-11 w-full text-base", AUTH_PRIMARY_BUTTON)}>
          {tr("Torna all'accesso")}
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-3">
          <h1 className={AUTH_TITLE}>{tr("Password cambiata")}</h1>
          <p className="text-text-2" role="status">{tr("Entra con la nuova password. Le sessioni aperte sugli altri dispositivi sono state chiuse.")}</p>
        </div>
        <a href={LOGIN_PATH} className={cn(buttonVariants(), "h-11 w-full text-base", AUTH_PRIMARY_BUTTON)}>
          {tr("Entra")}
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h1 className={AUTH_TITLE}>{tr("Nuova password")}</h1>
        <p className="text-text-2">{tr("Scegli una password di almeno {0} caratteri.", { 0: PASSWORD_MIN_LENGTH })}</p>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          setError(null);
          const { error: authError } = await authClient.resetPassword({ newPassword: password, token }).catch(() => ({ error: { status: 0 } }));
          setLoading(false);
          if (authError) setError(authError.status === 400 ? "Il link per reimpostare la password non vale più. Chiedine uno nuovo da «Password dimenticata?»." : describePasswordError(authError));
          else setDone(true);
        }}
      >
        <AuthField id="password" type="password" label={tr("Nuova password")} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" autoFocus disabled={loading} />
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {tr(error)}
          </p>
        )}
        <Button type="submit" className={cn("mt-2 h-11 w-full text-base", AUTH_PRIMARY_BUTTON)} disabled={loading}>
          {loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {tr("Salva la nuova password")}
        </Button>
      </form>
    </div>
  );
}
