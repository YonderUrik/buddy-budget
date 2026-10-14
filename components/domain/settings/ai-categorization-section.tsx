"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Sezione «Assistente per le categorie»: consenso esplicito (spento di default) a inviare il nome pulito degli
 * esercenti a un servizio esterno per ricevere proposte di categoria, e la scelta di far applicare da sole le proposte
 * sicure (dal 90%, dalle scelte passate o dall'AI), che si ritrovano in Categorizza → «Messe dall'app».
 */

import { AiCategorizationInstructions } from "./ai-categorization-instructions";
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
      title={tr("Assistente per le categorie")}
      icon={Sparkles}
      preview={<CategoryProposalPreview />}
      description={tr("Propone una categoria per i movimenti nuovi di sincronizzazioni e importazioni. Quelle in dubbio le scegli tu; se vuoi, quando è quasi certa l'app la mette da sola e la ritrovi in Categorizza.")}
    >
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : isError || !data ? (
        <p className="text-sm text-neg" role="alert">{tr("Impossibile caricare l'impostazione.")}</p>
      ) : (
        <SettingsRow
          label={tr("Proponi le categorie")}
          hint={
            data.available
              ? tr("Se attivo, il nome pulito dell'esercente (mai importi, date, IBAN, note o nomi di persone) viene inviato a un servizio esterno insieme alle categorie e alle tue eventuali istruzioni, con conservazione dei dati disattivata. Puoi revocare in ogni momento.")
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
            aria-label={tr("Proponi le categorie")}
          />
        </SettingsRow>
      )}
      {data && (
        <SettingsRow
          label={tr("Lascia che l'app scelga quando è quasi certa")}
          hint={tr("Le tue regole valgono sempre. Se attivo, l'app mette da sola anche le categorie di cui è quasi certa (almeno al {0}%, dalle tue scelte passate o, se lo hai attivato, dall'assistente). Le ritrovi in Categorizza → «Messe dall'app», dove puoi cambiarle.", {0: confidencePercent(AUTO_APPLY_THRESHOLD)})}
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
            aria-label={tr("Lascia che l'app scelga quando è quasi certa")}
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
