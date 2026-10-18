"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** Sezione Profilo: nome modificabile, email, data di iscrizione e metodi di accesso (con "Collega Google"). */

import * as React from "react";
import { Check, KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleIcon } from "@/components/domain/auth";
import { authClient } from "@/lib/auth/client";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/account/constants";
import { useInstance } from "@/lib/instance/provider";

import { useUpdateUserSettingsMutation, type UserSettings } from "@/lib/queries/user-settings";
import { UserRound } from "lucide-react";
import { SettingsRow, SettingsSection } from "./settings-section";

export interface ProfileSectionProps {
  settings: UserSettings;
  /** Pagina su cui tornare dopo il collegamento di Google. */
  returnTo?: string;
}

export function ProfileSection({ settings, returnTo = "/impostazioni" }: ProfileSectionProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatLongDate } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const { auth } = useInstance();
  const [name, setName] = React.useState(settings.name);
  const [linking, setLinking] = React.useState(false);
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const update = useUpdateUserSettingsMutation();
  const trimmed = name.trim();
  const dirty = trimmed !== settings.name;

  function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty || trimmed.length === 0) return;
    update.mutate({ name: trimmed });
  }

  async function linkGoogle() {
    setLinking(true);
    setLinkError(null);
    const { error } = await authClient.linkSocial({ provider: "google", callbackURL: returnTo }).catch(() => ({
      error: { status: 0 },
    }));
    if (error) {
      setLinkError(tr("Collegamento non riuscito. Riprova."));
      setLinking(false);
    }
  }

  return (
    <SettingsSection id="impostazioni-profilo" title={tr("Profilo")} icon={UserRound}>
      <SettingsRow label={tr("Nome")} hint={tr("Come ti chiamiamo nell'app.")} htmlFor="settings-name">
        <form onSubmit={saveName} className="flex w-full gap-2 sm:w-72">
          <Input
            id="settings-name"
            value={name}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            placeholder={tr("Il tuo nome")}
            onChange={(event) => {
              setName(event.target.value);
              update.reset();
            }}
            autoComplete="name"
          />
          <Button type="submit" variant="outline" disabled={!dirty || trimmed.length === 0 || update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : tr("Salva")}
          </Button>
        </form>
        {update.isSuccess && !dirty && (
          <p className="flex items-center gap-1 text-xs text-pos" role="status">
            <Check className="size-3.5" aria-hidden="true" />{" "}{tr("Nome salvato")}</p>
        )}
        {update.isError && (
          <p className="text-xs text-neg" role="alert">
            {tr(update.error.message)}
          </p>
        )}
      </SettingsRow>

      <SettingsRow label={tr("Email")} hint={tr("Con BuddyBudget dal {0}.", {0: formatLongDate(new Date(settings.createdAt))})}>
        <p className="text-sm text-foreground break-all">{settings.email}</p>
      </SettingsRow>

      <SettingsRow label={tr("Metodi di accesso")} hint={tr("Puoi entrare con uno qualsiasi di questi.")}>
        <ul className="flex flex-col gap-2 text-sm sm:items-end">
          {auth.password && (
            <li className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />{tr("Password")}
              <span className={settings.passwordSet ? "text-xs text-pos" : "text-xs text-text-3"}>{settings.passwordSet ? tr("attiva") : tr("non impostata")}</span>
            </li>
          )}
          {auth.magicLink && (
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" aria-hidden="true" />{tr("Link via email")}<span className="text-xs text-pos">{tr("attivo")}</span>
            </li>
          )}
          {(auth.google || settings.googleLinked) && (
            <li className="flex items-center gap-2">
              <GoogleIcon className="size-4" />{tr("Google")}{settings.googleLinked ? (
                <span className="text-xs text-pos">{tr("collegato")}</span>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={linkGoogle} disabled={linking}>
                  {linking && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{tr("Collega")}</Button>
              )}
            </li>
          )}
        </ul>
        {linkError && (
          <p className="text-xs text-neg" role="alert">
            {linkError}
          </p>
        )}
      </SettingsRow>
    </SettingsSection>
  );
}
