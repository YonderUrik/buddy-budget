"use client";

/**
 * Channels of the «Notifiche» section: email (on by default) and, in the phone app, notifications on this phone. The
 * phone switch shows this phone's state: turning it on asks the system permission and registers the phone, turning it
 * off forgets it (and stops push for the account when no phone is left). In a browser the phone row appears only when
 * the account already has phones, to turn push off from the computer.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import { useNativePlatform } from "@/lib/hooks/use-native-platform";
import { useLocalization } from "@/lib/localization/provider";
import { enablePushOnThisDevice, forgetPushOnThisDevice, hasPushOnThisDevice } from "@/lib/native";
import type { NotificationPreferences } from "@/lib/notifications";
import {
  useInvalidatePushDevices,
  usePushDevicesQuery,
  useSendPushTestMutation,
  useUpdateNotificationPreferencesMutation,
} from "@/lib/queries/notifications";
import { SettingsRow } from "./settings-section";

const DENIED_MESSAGE = "Le notifiche sono bloccate per BuddyBudget: attivale dalle impostazioni del telefono.";
const FAILED_MESSAGE = "Non siamo riusciti ad attivare le notifiche. Riprova tra poco.";

export interface NotificationChannelsProps {
  preferences: NotificationPreferences;
}

export function NotificationChannels({ preferences }: NotificationChannelsProps) {
  const { t: tr } = useLocalization();
  const native = useNativePlatform();
  const update = useUpdateNotificationPreferencesMutation();
  const pushDevices = usePushDevicesQuery();
  const invalidatePushDevices = useInvalidatePushDevices();
  const test = useSendPushTestMutation();
  // Rendered only after the preferences query resolved, so never during server rendering.
  const [thisPhone, setThisPhone] = React.useState(() => typeof window !== "undefined" && hasPushOnThisDevice());
  const [phoneBusy, setPhoneBusy] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);

  const configured = pushDevices.data?.configured ?? false;
  const devices = pushDevices.data?.devices ?? 0;
  const phoneOn = native ? thisPhone && preferences.pushEnabled : preferences.pushEnabled && devices > 0;

  async function togglePhone(checked: boolean) {
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      if (!checked) {
        if (native) {
          await forgetPushOnThisDevice();
          setThisPhone(false);
        }
        const left = native ? Math.max(devices - 1, 0) : 0;
        if (left === 0) await update.mutateAsync({ pushEnabled: false });
        track("push_notifications_toggled", { enabled: false });
        return;
      }
      const result = await enablePushOnThisDevice();
      if (result !== "enabled") {
        setPhoneError(result === "denied" ? DENIED_MESSAGE : FAILED_MESSAGE);
        track("push_notifications_toggled", { enabled: true, result: result === "denied" ? "denied" : "failed" });
        return;
      }
      setThisPhone(true);
      await update.mutateAsync({ pushEnabled: true });
      track("push_notifications_toggled", { enabled: true, result: "enabled" });
    } catch {
      setPhoneError(FAILED_MESSAGE);
    } finally {
      setPhoneBusy(false);
      void invalidatePushDevices();
    }
  }

  const showPhoneRow = configured && (native ? true : devices > 0);

  return (
    <>
      <SettingsRow label={tr("Via email")} hint={tr("Le notifiche scelte qui sotto arrivano per email.")} htmlFor="notifiche-email">
        <Switch
          id="notifiche-email"
          checked={preferences.emailEnabled}
          disabled={update.isPending}
          onCheckedChange={(checked) => update.mutate({ emailEnabled: checked }, { onSuccess: () => track("email_notifications_toggled", { enabled: checked }) })}
          aria-label={tr("Via email")}
        />
      </SettingsRow>
      {showPhoneRow && (
        <SettingsRow
          label={tr("Sul telefono")}
          hint={
            native
              ? tr("Le stesse notifiche arrivano anche su questo telefono, senza importi nel testo.")
              : tr("Attive su {0} telefoni. Spegnile qui per non riceverle più su nessuno.", { 0: devices })
          }
          htmlFor="notifiche-telefono"
        >
          <Switch
            id="notifiche-telefono"
            checked={phoneOn}
            disabled={phoneBusy || update.isPending}
            onCheckedChange={(checked) => void togglePhone(checked)}
            aria-label={tr("Sul telefono")}
          />
          {phoneError && <p className="text-xs text-neg" role="alert">{tr(phoneError)}</p>}
        </SettingsRow>
      )}
      {native && phoneOn && (
        <SettingsRow label={tr("Prova sul telefono")} hint={tr("Ti mandiamo una notifica di prova su questo telefono.")}>
          <Button variant="outline" disabled={test.isPending} onClick={() => test.mutate(undefined, { onSuccess: () => track("push_test_sent") })}>
            {test.isPending ? tr("Invio…") : tr("Manda una prova")}
          </Button>
          {test.isSuccess && <p className="text-xs text-muted-foreground">{tr("Inviata: dovrebbe arrivare tra pochi secondi.")}</p>}
          {test.isError && <p className="text-xs text-neg" role="alert">{tr(test.error.message)}</p>}
        </SettingsRow>
      )}
    </>
  );
}
