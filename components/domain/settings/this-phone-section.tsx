"use client";

/**
 * «Questo telefono» section, only in the phone app: unlock with Face ID / fingerprint. The choice belongs to this phone
 * (localStorage), like the theme; turning it on asks Face ID once, so nobody locks themselves out by mistake.
 */

import * as React from "react";
import { Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useBiometricLockChoice } from "@/components/domain/native";
import { track } from "@/lib/analytics";
import { useNativePlatform } from "@/lib/hooks/use-native-platform";
import { useLocalization } from "@/lib/localization/provider";
import { biometricAvailability, verifyWithBiometrics, type BiometricKind } from "@/lib/native";
import { SettingsRow, SettingsSection } from "./settings-section";

const LOCK_LABEL: Record<BiometricKind, string> = {
  face: "Sblocca con Face ID",
  fingerprint: "Sblocca con l'impronta",
  other: "Sblocca con il riconoscimento del telefono",
};

export function ThisPhoneSection() {
  const { t: tr } = useLocalization();
  const native = useNativePlatform();
  const [enabled, setEnabled] = useBiometricLockChoice();
  const [kind, setKind] = React.useState<BiometricKind | null | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!native) return;
    let active = true;
    void biometricAvailability().then((result) => {
      if (active) setKind(result);
    });
    return () => {
      active = false;
    };
  }, [native]);

  if (!native) return null;

  async function toggle(checked: boolean) {
    if (checked) {
      setBusy(true);
      const verified = await verifyWithBiometrics({ reason: tr("Conferma per attivare il blocco"), cancel: tr("Annulla") });
      setBusy(false);
      if (!verified) return;
    }
    setEnabled(checked);
    track("biometric_lock_toggled", { enabled: checked });
  }

  const label = tr(LOCK_LABEL[kind ?? "other"]);
  return (
    <SettingsSection id="impostazioni-questo-telefono" title={tr("Questo telefono")} icon={Smartphone} description={tr("Scelte che valgono solo per l'app su questo telefono.")}>
      <SettingsRow
        label={label}
        hint={kind === null ? tr("Imposta Face ID, l'impronta o un codice nelle impostazioni del telefono per usare il blocco.") : tr("All'apertura e quando torni dopo almeno 30 secondi, l'app chiede di sbloccarla. Nel frattempo copre i tuoi conti nell'elenco delle app aperte.")}
        htmlFor="questo-telefono-blocco"
      >
        <Switch id="questo-telefono-blocco" checked={enabled} disabled={busy || !kind} onCheckedChange={(checked) => void toggle(checked)} aria-label={label} />
      </SettingsRow>
    </SettingsSection>
  );
}
