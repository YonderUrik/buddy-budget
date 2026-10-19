"use client";

import { useLocalization } from "@/lib/localization/provider";
import type { InstanceCapabilities } from "@/lib/selfhost";
import { SettingsSection } from "./settings-section";

export interface InstanceSectionProps {
  status: InstanceCapabilities;
}

/** Mostra lo stato dell’installazione senza esporre chiavi o permettere modifiche agli utenti ordinari. */
export function InstanceSection({ status }: InstanceSectionProps) {
  const { t: tr } = useLocalization();
  const rows = [
    ["Categorie AI", status.aiCategories],
    ["CSV personali con AI", status.aiCsv],
    ["Email di accesso", status.emailDelivery],
    ["Riepiloghi e avvisi email", status.notifications],
    ["Sincronizzazione bancaria", status.bankSync],
    ["Accesso con Google", status.googleEnabled],
    ["Loghi da Logo.dev", status.logos],
  ] as const;
  return (
    <SettingsSection id="impostazioni-istanza" title={tr("Installazione self-hosted")} description={tr("Servizi configurati dall’amministratore. Questo elenco non verifica la disponibilità dei fornitori.")}>
      {status.localMode && <p className="text-sm text-text-2">{tr("Modalità personale: accesso automatico su questo computer.")}</p>}
      <dl className="divide-y divide-border">
        {rows.filter(([label]) => !status.localMode || !["Email di accesso", "Accesso con Google"].includes(label)).map(([label, configured]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt>{tr(label)}</dt>
            <dd className={configured ? "text-pos" : "text-text-2"}>{tr(configured ? "Configurato" : "Non configurato")}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-text-2">{tr("I prezzi Yahoo e i cambi BCE non richiedono chiavi. AI e notifiche richiedono anche il tuo consenso nelle Impostazioni.")}</p>
      <p className="text-sm text-text-2">{tr("Per modificare le chiavi, l’amministratore rilancia l’installer sul server e poi aggiorna i container.")}</p>
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">./scripts/selfhost-init.sh --start</pre>
    </SettingsSection>
  );
}
