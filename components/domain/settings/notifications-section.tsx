"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Notifiche» section: which non-service notifications to receive (summary, budget, due dates, goals), how often, and
 * on which channels (email, and the phone in the app). Everything starts off: they arrive only after an explicit
 * choice, and every email carries the link to turn it off.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import {
  DIGEST_FREQUENCIES,
  NOTIFICATION_KIND_INFO,
  type DigestFrequency,
  type NotificationKind,
  type NotificationPreferences,
} from "@/lib/notifications";
import {
  useNotificationPreferencesQuery,
  useSendNotificationExampleMutation,
  useUpdateNotificationPreferencesMutation,
} from "@/lib/queries/notifications";
import { Mail } from "lucide-react";
import { isCountryPathAvailable } from "@/lib/localization/config";
import { EmailPreview } from "./settings-preview";
import { NotificationChannels } from "./notification-channels";
import { SettingsRow, SettingsSection } from "./settings-section";

const FREQUENCY_LABEL: Record<DigestFrequency, string> = { settimanale: "Ogni settimana (lunedì)", mensile: "Ogni mese (primi giorni)" };
const FIELD_BY_KIND = { digest: "digestEnabled", budget: "budgetAlertsEnabled", deadlines: "deadlineAlertsEnabled", goals: "goalAlertsEnabled" } as const satisfies Record<
  NotificationKind,
  keyof NotificationPreferences
>;
const KINDS: readonly NotificationKind[] = ["digest", "budget", "deadlines", "goals"];
/** Tipi legati a una sezione: si mostrano solo dove la sezione esiste (gli obiettivi stanno in Analitiche). */
const KIND_PATH: Partial<Record<NotificationKind, string>> = { goals: "/analitiche/obiettivi" };

export function NotificationsSection({ email }: { email: string }) {
  const { t: tr, productCountry } = useLocalization();
  const kinds = KINDS.filter((kind) => !KIND_PATH[kind] || isCountryPathAvailable(productCountry, KIND_PATH[kind]));
  const { data: preferences, isLoading, isError } = useNotificationPreferencesQuery();
  const update = useUpdateNotificationPreferencesMutation();
  const example = useSendNotificationExampleMutation();

  return (
    <SettingsSection
      id="impostazioni-notifiche"
      title={tr("Notifiche")}
      icon={Mail}
      preview={<EmailPreview />}
      description={tr("Email di riepilogo e di avviso a {0}. Sono facoltative e partono spente; ognuna ha il link per disattivarla. Le email di servizio (link di accesso, sicurezza, account) non si possono disattivare.", {0: email})}
    >
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : isError || !preferences ? (
        <p className="text-sm text-neg" role="alert">{tr("Impossibile caricare le preferenze sulle notifiche.")}</p>
      ) : (
        <>
          <NotificationChannels preferences={preferences} />
          {kinds.map((kind) => {
            const info = NOTIFICATION_KIND_INFO[kind];
            const field = FIELD_BY_KIND[kind];
            return (
              <SettingsRow key={kind} label={tr(info.label)} hint={tr(info.hint)} htmlFor={`notifiche-${kind}`}>
                <Switch
                  id={`notifiche-${kind}`}
                  checked={preferences[field]}
                  disabled={update.isPending}
                  onCheckedChange={(checked) =>
                    update.mutate({ [field]: checked }, { onSuccess: () => track("notifications_toggled", { kind, enabled: checked }) })
                  }
                  aria-label={tr(info.label)}
                />
              </SettingsRow>
            );
          })}
          {preferences.digestEnabled && (
            <SettingsRow label={tr("Frequenza del riepilogo")} hint={tr("Il riepilogo parla dell'ultimo periodo concluso.")} htmlFor="notifiche-frequenza">
              <Select
                value={preferences.digestFrequency}
                onValueChange={(value) =>
                  value &&
                  value !== preferences.digestFrequency &&
                  update.mutate(
                    { digestFrequency: value as DigestFrequency },
                    { onSuccess: () => track("notifications_frequency_changed", { frequency: value as DigestFrequency }) },
                  )
                }
                disabled={update.isPending}
              >
                <SelectTrigger id="notifiche-frequenza" className="w-full sm:w-56" aria-label={tr("Frequenza del riepilogo")}>
                  <SelectValue>{(value: string | null) => (value ? FREQUENCY_LABEL[value as DigestFrequency] : "")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DIGEST_FREQUENCIES.map((frequency) => (
                    <SelectItem key={frequency} value={frequency}>
                      {FREQUENCY_LABEL[frequency]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          )}
          <SettingsRow label={tr("Vedi un esempio")} hint={tr("Ti mandiamo il riepilogo dell'ultimo mese con i tuoi dati. Non attiva nulla.")}>
            <Button
              variant="outline"
              disabled={example.isPending}
              onClick={() => example.mutate(undefined, { onSuccess: () => track("notifications_test_sent") })}
            >
              {example.isPending ? tr("Invio…") : tr("Mandami un esempio")}
            </Button>
            {example.isSuccess && <p className="text-xs text-muted-foreground">{tr("Inviato: controlla la posta.")}</p>}
            {example.isError && (
              <p className="text-xs text-neg" role="alert">
                {tr(example.error.message)}
              </p>
            )}
          </SettingsRow>
          {update.isError && (
            <p className="text-sm text-neg" role="alert">
              {tr(update.error.message)}
            </p>
          )}
        </>
      )}
    </SettingsSection>
  );
}
