"use client";

/** Sezione Profilo: nome modificabile, email, data di iscrizione e metodi di accesso (con "Collega Google"). */

import * as React from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleIcon } from "@/components/domain/auth";
import { authClient } from "@/lib/auth/client";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/account/constants";
import { formatLongDate } from "@/lib/format";
import { useUpdateUserSettingsMutation, type UserSettings } from "@/lib/queries/user-settings";
import { SettingsRow, SettingsSection } from "./settings-section";

export interface ProfileSectionProps {
  settings: UserSettings;
  /** Pagina su cui tornare dopo il collegamento di Google. */
  returnTo?: string;
}

export function ProfileSection({ settings, returnTo = "/impostazioni" }: ProfileSectionProps) {
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
      setLinkError("Collegamento non riuscito. Riprova.");
      setLinking(false);
    }
  }

  return (
    <SettingsSection id="impostazioni-profilo" title="Profilo">
      <SettingsRow label="Nome" hint="Come ti chiamiamo nell'app." htmlFor="settings-name">
        <form onSubmit={saveName} className="flex w-full gap-2 sm:w-72">
          <Input
            id="settings-name"
            value={name}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            placeholder="Il tuo nome"
            onChange={(event) => {
              setName(event.target.value);
              update.reset();
            }}
            autoComplete="name"
          />
          <Button type="submit" variant="outline" disabled={!dirty || trimmed.length === 0 || update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Salva"}
          </Button>
        </form>
        {update.isSuccess && !dirty && (
          <p className="flex items-center gap-1 text-xs text-pos" role="status">
            <Check className="size-3.5" aria-hidden="true" /> Nome salvato
          </p>
        )}
        {update.isError && (
          <p className="text-xs text-neg" role="alert">
            {update.error.message}
          </p>
        )}
      </SettingsRow>

      <SettingsRow label="Email" hint={`Con BuddyBudget dal ${formatLongDate(new Date(settings.createdAt))}.`}>
        <p className="text-sm text-foreground break-all">{settings.email}</p>
      </SettingsRow>

      <SettingsRow label="Metodi di accesso" hint="Puoi entrare con uno qualsiasi di questi.">
        <ul className="flex flex-col gap-2 text-sm sm:items-end">
          <li className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
            Link via email
            <span className="text-xs text-pos">attivo</span>
          </li>
          <li className="flex items-center gap-2">
            <GoogleIcon className="size-4" />
            Google
            {settings.googleLinked ? (
              <span className="text-xs text-pos">collegato</span>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={linkGoogle} disabled={linking}>
                {linking && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Collega
              </Button>
            )}
          </li>
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
