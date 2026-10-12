"use client";

/**
 * Sezione «Assistente per le categorie»: consenso esplicito (spento di default) a inviare il nome pulito degli
 * esercenti a un servizio esterno per ricevere proposte di categoria, e la scelta di far applicare da sole le proposte
 * sicure (dal 90%, dalle scelte passate o dall'AI), che si ritrovano in Categorizza → «Fatte da sole».
 */

import { AiCategorizationInstructions } from "./ai-categorization-instructions";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import { confidencePercent } from "@/lib/categorization/origin";
import { AUTO_APPLY_THRESHOLD } from "@/lib/categorization/suggest";
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
      description="Propone una categoria per i movimenti nuovi di sincronizzazioni e importazioni. Le proposte incerte le confermi tu; quelle sicure, se vuoi, si applicano da sole e le ritrovi in Categorizza."
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
      {data && (
        <SettingsRow
          label="Applica da sole le categorie sicure"
          hint={`Le tue regole si applicano sempre. Se attivo, anche le proposte sicure almeno al ${confidencePercent(AUTO_APPLY_THRESHOLD)}% (dalle tue scelte passate o, se lo hai attivato, dall'assistente) si applicano senza chiederti nulla. Le ritrovi in Categorizza → «Fatte da sole», dove puoi cambiarle.`}
          htmlFor="categorie-sicure-da-sole"
        >
          <Switch
            id="categorie-sicure-da-sole"
            checked={data.autoApply}
            disabled={update.isPending}
            onCheckedChange={(checked) =>
              update.mutate(
                { autoApply: checked },
                { onSuccess: () => track("categorization_auto_apply_toggled", { enabled: checked, from: "impostazioni" }) }
              )
            }
            aria-label="Applica da sole le categorie sicure"
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
