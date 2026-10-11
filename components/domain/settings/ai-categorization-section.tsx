"use client";

/**
 * Sezione «Assistente per le categorie»: consenso esplicito (spento di default) a inviare il nome pulito degli
 * esercenti a un servizio esterno per ricevere proposte di categoria. Le proposte non si applicano mai da sole.
 */

import { AiCategorizationInstructions } from "./ai-categorization-instructions";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import { useAiCategorizationQuery, useUpdateAiCategorizationMutation } from "@/lib/queries/notifications";
import { Sparkles } from "lucide-react";
import { CategoryProposalPreview } from "./settings-preview";
import { SettingsRow, SettingsSection } from "./settings-section";

export function AiCategorizationSection() {
  const { data, isLoading, isError } = useAiCategorizationQuery();
  const update = useUpdateAiCategorizationMutation();

  return (
    <SettingsSection
      id="impostazioni-assistente-categorie"
      title="Assistente per le categorie"
      icon={Sparkles}
      preview={<CategoryProposalPreview />}
      description="Propone una categoria per i movimenti nuovi di sincronizzazioni e importazioni. Sei sempre tu a confermare: nulla viene categorizzato da solo."
    >
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : isError || !data ? (
        <p className="text-sm text-neg" role="alert">
          Impossibile caricare l&apos;impostazione.
        </p>
      ) : (
        <SettingsRow
          label="Proponi le categorie"
          hint={
            data.available
              ? "Se attivo, il nome pulito dell'esercente (mai importi, date, IBAN, note o nomi di persone) viene inviato a un servizio esterno insieme alle categorie e alle tue eventuali istruzioni, con conservazione dei dati disattivata. Puoi revocare in ogni momento."
              : "Il servizio non è configurato su questo server."
          }
          htmlFor="assistente-categorie"
        >
          <Switch
            id="assistente-categorie"
            checked={data.enabled}
            disabled={update.isPending || !data.available}
            onCheckedChange={(checked) =>
              update.mutate(checked, { onSuccess: () => track("ai_categorization_toggled", { enabled: checked }) })
            }
            aria-label="Proponi le categorie"
          />
        </SettingsRow>
      )}
      {data && <AiCategorizationInstructions saved={data.instructions ?? ""} />}
      {update.isError && (
        <p className="text-sm text-neg" role="alert">
          {update.error.message}
        </p>
      )}
    </SettingsSection>
  );
}
