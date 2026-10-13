"use client";

/** Sezione "Privacy": documenti legali, quando li hai accettati e come esercitare i diritti che non hanno un pulsante in app. */

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { useAnalyticsOptOut } from "@/lib/hooks/use-analytics-opt-out";
import { track } from "@/lib/analytics";
import { formatLongDate } from "@/lib/format";
import { LEGAL_LINKS, PRIVACY_EMAIL, PRIVACY_REQUEST_OPTIONS, buildPrivacyRequestHref } from "@/lib/legal";
import type { UserSettings } from "@/lib/queries/user-settings";
import { ShieldCheck } from "lucide-react";
import { SettingsRow, SettingsSection } from "./settings-section";

/** Store vuoto: la scelta sulle statistiche si conosce solo sul client. */
const subscribeNoop = () => () => {};

const LINK_CLASS = "underline underline-offset-2 hover:text-foreground";

export interface PrivacySectionProps {
  settings: UserSettings;
}

export function PrivacySection({ settings }: PrivacySectionProps) {
  const { legalAcceptedAt, legalAcceptedVersion, email } = settings;
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [optedOut, setOptedOut] = useAnalyticsOptOut();

  return (
    <SettingsSection
      id="impostazioni-privacy"
      title="Privacy"
      icon={ShieldCheck}
      description="Come trattiamo i tuoi dati e come esercitare i tuoi diritti. Scarica e cancella i dati dalle sezioni qui sotto."
    >
      <SettingsRow
        label="Statistiche d'uso anonime"
        hint="Contano le pagine viste e le azioni (mai importi o testi tuoi), senza cookie. Spegnile e non ti misuriamo più su questo dispositivo."
      >
        {mounted ? (
          <Switch
            checked={!optedOut}
            onCheckedChange={(checked) => setOptedOut(!checked)}
            aria-label="Statistiche d'uso anonime"
          />
        ) : (
          <div className="h-[18.4px] w-[32px]" />
        )}
      </SettingsRow>
      <SettingsRow
        label="Documenti"
        hint={
          legalAcceptedAt
            ? `Hai accettato la versione del ${legalAcceptedVersion} il ${formatLongDate(new Date(legalAcceptedAt))}.`
            : "Non risulta un'accettazione registrata."
        }
      >
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {LEGAL_LINKS.map((link) => (
            <li key={link.id}>
              <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </SettingsRow>

      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Per le altre richieste scrivi a{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className={LINK_CLASS}>
            {PRIVACY_EMAIL}
          </a>
          : rispondiamo entro un mese. Questi link aprono una email già compilata.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {PRIVACY_REQUEST_OPTIONS.map((option) => (
            <li key={option.type}>
              <a
                href={buildPrivacyRequestHref(option, email)}
                onClick={() => track("privacy_request_started", { type: option.type })}
                className="flex h-full flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors hover:bg-muted"
              >
                <span className="font-medium text-foreground">{option.label}</span>
                <span className="text-muted-foreground">{option.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </SettingsSection>
  );
}
