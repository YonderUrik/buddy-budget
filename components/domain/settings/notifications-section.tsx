"use client";

/**
 * Sezione «Notifiche»: sceglie quali email non di servizio ricevere (riepilogo, avvisi su budget e scadenze) e ogni
 * quanto. Tutto parte spento: queste email arrivano solo dopo una scelta esplicita e ogni email porta il link per disattivarle.
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
import { SettingsRow, SettingsSection } from "./settings-section";

const FREQUENCY_LABEL: Record<DigestFrequency, string> = { settimanale: "Ogni settimana (lunedì)", mensile: "Ogni mese (primi giorni)" };
const FIELD_BY_KIND = { digest: "digestEnabled", budget: "budgetAlertsEnabled", deadlines: "deadlineAlertsEnabled" } as const satisfies Record<
  NotificationKind,
  keyof NotificationPreferences
>;
const KINDS: readonly NotificationKind[] = ["digest", "budget", "deadlines"];

export function NotificationsSection({ email }: { email: string }) {
  const { data: preferences, isLoading, isError } = useNotificationPreferencesQuery();
  const update = useUpdateNotificationPreferencesMutation();
  const example = useSendNotificationExampleMutation();

  return (
    <SettingsSection
      id="impostazioni-notifiche"
      title="Notifiche"
      description={`Email di riepilogo e di avviso a ${email}. Sono facoltative e partono spente; ognuna ha il link per disattivarla. Le email di servizio (link di accesso, sicurezza, account) non si possono disattivare.`}
    >
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : isError || !preferences ? (
        <p className="text-sm text-neg" role="alert">
          Impossibile caricare le preferenze sulle notifiche.
        </p>
      ) : (
        <>
          {KINDS.map((kind) => {
            const info = NOTIFICATION_KIND_INFO[kind];
            const field = FIELD_BY_KIND[kind];
            return (
              <SettingsRow key={kind} label={info.label} hint={info.hint} htmlFor={`notifiche-${kind}`}>
                <Switch
                  id={`notifiche-${kind}`}
                  checked={preferences[field]}
                  disabled={update.isPending}
                  onCheckedChange={(checked) =>
                    update.mutate({ [field]: checked }, { onSuccess: () => track("notifications_toggled", { kind, enabled: checked }) })
                  }
                  aria-label={info.label}
                />
              </SettingsRow>
            );
          })}
          {preferences.digestEnabled && (
            <SettingsRow label="Frequenza del riepilogo" hint="Il riepilogo parla dell'ultimo periodo concluso." htmlFor="notifiche-frequenza">
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
                <SelectTrigger id="notifiche-frequenza" className="w-full sm:w-56" aria-label="Frequenza del riepilogo">
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
          <SettingsRow label="Vedi un esempio" hint="Ti mandiamo il riepilogo dell'ultimo mese con i tuoi dati, per capire che cosa riceverai. Non attiva nulla.">
            <Button
              variant="outline"
              disabled={example.isPending}
              onClick={() => example.mutate(undefined, { onSuccess: () => track("notifications_test_sent") })}
            >
              {example.isPending ? "Invio…" : "Mandami un esempio"}
            </Button>
            {example.isSuccess && <p className="text-xs text-muted-foreground">Inviato: controlla la posta.</p>}
            {example.isError && (
              <p className="text-xs text-neg" role="alert">
                {example.error.message}
              </p>
            )}
          </SettingsRow>
          {update.isError && (
            <p className="text-sm text-neg" role="alert">
              {update.error.message}
            </p>
          )}
        </>
      )}
    </SettingsSection>
  );
}
