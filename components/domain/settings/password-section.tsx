"use client";

/**
 * Sezione Password (only where the instance offers password sign-in): change the password with the current one, or
 * add one to an account that signs in with the emailed link or Google (this needs a recent sign-in).
 */

import * as React from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describePasswordError } from "@/components/domain/auth";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { useInstance } from "@/lib/instance/provider";
import { useLocalization } from "@/lib/localization/provider";
import type { UserSettings } from "@/lib/queries/user-settings";
import { ReauthPanel } from "./reauth-panel";
import { SettingsRow, SettingsSection } from "./settings-section";

export interface PasswordSectionProps {
  settings: UserSettings;
  /** The session is recent enough for sensitive actions (`useRecentLogin`). */
  recentLogin: boolean;
}

/** Saves the password: `change` with the current one (better-auth), `set` for an account without one (our route). */
async function savePassword(kind: "change" | "set", current: string, next: string): Promise<string | null> {
  if (kind === "change") {
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true }).catch(() => ({ error: { status: 0 } }));
    if (!error) return null;
    return error.status === 400 || error.status === 401 ? "La password attuale non è corretta." : describePasswordError(error);
  }
  const response = await fetch("/api/user/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: next }) }).catch(() => null);
  if (response?.ok) return null;
  const body = (await response?.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Qualcosa non ha funzionato. Riprova.";
}

export function PasswordSection({ settings, recentLogin }: PasswordSectionProps) {
  const { t: tr } = useLocalization();
  const { auth } = useInstance();
  const queryClient = useQueryClient();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const kind = settings.passwordSet ? "change" : "set";

  if (!auth.password) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const failure = await savePassword(kind, current, next);
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setCurrent("");
    setNext("");
    setSaved(true);
    track("password_changed", { kind });
    await queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    await queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
  }

  return (
    <SettingsSection
      id="impostazioni-password"
      title={tr("Password")}
      icon={KeyRound}
      description={settings.passwordSet ? tr("Cambiandola, le sessioni sugli altri dispositivi si chiudono.") : tr("Aggiungi una password per entrare anche senza il link via email.")}
    >
      {kind === "set" && !recentLogin ? (
        <ReauthPanel email={settings.email} googleLinked={settings.googleLinked} passwordSet={settings.passwordSet} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {kind === "change" && (
            <SettingsRow label={tr("Password attuale")} htmlFor="settings-current-password">
              <Input id="settings-current-password" type="password" className="sm:w-72" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" disabled={pending} />
            </SettingsRow>
          )}
          <SettingsRow label={tr("Nuova password")} hint={tr("Almeno {0} caratteri.", { 0: PASSWORD_MIN_LENGTH })} htmlFor="settings-new-password">
            <Input id="settings-new-password" type="password" className="sm:w-72" value={next} onChange={(e) => setNext(e.target.value)} required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" disabled={pending} />
          </SettingsRow>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {saved && (
              <p className="flex items-center gap-1 text-xs text-pos" role="status">
                <Check className="size-3.5" aria-hidden="true" />{tr("Password salvata")}
              </p>
            )}
            {error && (
              <p className="text-xs text-neg" role="alert">
                {tr(error)}
              </p>
            )}
            <Button type="submit" variant="outline" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {kind === "change" ? tr("Cambia password") : tr("Imposta la password")}
            </Button>
          </div>
        </form>
      )}
    </SettingsSection>
  );
}
