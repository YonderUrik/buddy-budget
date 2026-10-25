"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Assistente AI» section (name quoted by the privacy policy): where the app uses AI (summary), the explicit consent (off
 * by default) to send the cleaned merchant name to an external service for category proposals and, on a tap of «Chiedi
 * all'AI» in «Cerca», the sentence typed there; and the choice to let safe proposals (70% and up, from past choices or
 * from the AI) apply on their own, listed in Categorizza → «Messe dall'app». Only the AI rows carry the «Usa l'AI» tag.
 */

import { AiCategorizationInstructions } from "./ai-categorization-instructions";
import { AiUsageSummary } from "./ai-usage-summary";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import { localizedCategorizationText } from "@/lib/categorization/origin";
import { AUTO_APPLY_THRESHOLD } from "@/lib/categorization/suggest";
import { useAiCategorizationQuery, useUpdateAiCategorizationMutation } from "@/lib/queries/notifications";
import { Sparkles } from "lucide-react";
import { CategoryProposalPreview } from "./settings-preview";
import { SettingsRow, SettingsSection } from "./settings-section";

export function AiCategorizationSection() {
  const { confidencePercent } = localizedCategorizationText(useLocalization().language);

  const { t: tr } = useLocalization();
  const { data, isLoading, isError } = useAiCategorizationQuery();
  const update = useUpdateAiCategorizationMutation();

  return (
    <SettingsSection
      id="impostazioni-assistente-categorie"
      title={tr("Assistente AI")}
      icon={Sparkles}
      preview={<CategoryProposalPreview />}
      description={tr("Propone una categoria per i movimenti nuovi di sincronizzazioni e importazioni e, in «Cerca», legge le frasi che le regole non capiscono quando tocchi «Chiedi all'AI». Le categorie in dubbio le scegli tu; se vuoi, quando è abbastanza sicura l'app la mette da sola e la ritrovi in Categorizza.")}
    >
      <AiUsageSummary />
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : isError || !data ? (
        <p className="text-sm text-neg" role="alert">{tr("Impossibile caricare l'impostazione.")}</p>
      ) : (
        <SettingsRow
          ai
          label={tr("Usa l'assistente AI")}
          hint={
            data.available
              ? tr("Se attivo, per le categorie il nome pulito della controparte, anche se è una persona, per tutti i tipi di movimento (senza importi, date, IBAN o note) viene inviato a OpenRouter insieme alle categorie e alle tue eventuali istruzioni; in «Cerca», solo quando tocchi «Chiedi all'AI», la frase che hai scritto. Solo verso fornitori che non conservano i dati (zero data retention). Puoi revocare in ogni momento.")
              : tr("Il servizio non è configurato su questo server.")
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
            aria-label={tr("Usa l'assistente AI")}
          />
        </SettingsRow>
      )}
      {data && (
        <SettingsRow
          label={tr("Lascia che l'app scelga quando è abbastanza sicura")}
          hint={tr("Non usa l'AI da sola. Le tue regole valgono sempre. Se attivo, l'app mette da sola anche le categorie di cui è abbastanza sicura (almeno al {0}%, dalle tue scelte passate o, se lo hai attivato, dall'assistente). Le ritrovi in Categorizza → «Messe dall'app», dove puoi cambiarle.", {0: confidencePercent(AUTO_APPLY_THRESHOLD)})}
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
            aria-label={tr("Lascia che l'app scelga quando è abbastanza sicura")}
          />
        </SettingsRow>
      )}
      {data && <AiCategorizationInstructions saved={data.instructions ?? ""} />}
      {update.isError && (
        <p className="text-sm text-neg" role="alert">
          {tr(update.error.message)}
        </p>
      )}
    </SettingsSection>
  );
}
