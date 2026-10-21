"use client";

import { useEmailAvailable } from "@/components/local-mode-provider";

/**
 * Onboarding: valuta principale (EUR preselezionato), categorie proposte (confermabili con un tocco o da personalizzare),
 * assistente per le categorie (se il servizio c'è, spento di default e spiegato), email facoltative (tutte spente: si
 * accendono solo per scelta), conferme legali; infine Panoramica.
 */

import { useState } from "react";
import { LocaleFields } from "@/components/domain/settings/locale-fields";
import { useLocalization } from "@/lib/localization/provider";
import { CurrencyPicker, LegalConsentFields, useLegalConsent } from "@/components/domain/auth";
import { CategorySetupStep, useCategorySetup } from "@/components/domain/categories";
import { InboxPreview, NotificationChoices, ONBOARDING_NOTIFICATION_INFO } from "@/components/domain/notifications";
import { StepActions, StepHeading, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { Switch } from "@/components/ui/switch";
import { useAiCategorizationQuery } from "@/lib/queries/notifications";
import { DEFAULT_AFTER_LOGIN_PATH } from "@/lib/auth/constants";
import { DEFAULT_CURRENCY, type SupportedCurrency } from "@/lib/validation/currency";
import { track } from "@/lib/analytics";
import { summarizeCategorySetup } from "@/lib/categories/setup";
import { NOTIFICATION_DEFAULTS, type NotificationPreferences } from "@/lib/notifications";

type OnboardingStep = "valuta" | "categorie" | "assistente" | "notifiche" | "conferme";

export default function OnboardingPage() {
  const { t: tr } = useLocalization();
  const { productCountry, language, setProfile } = useLocalization();
  const [currency, setCurrency] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const { consent, setConsent, complete, payload } = useLegalConsent();
  // Consenso al trattamento con AI: spento finché l'utente non lo accende (art. 7 GDPR, nessuna casella pre-selezionata).
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const { data: assistant } = useAiCategorizationQuery();
  const categorySetup = useCategorySetup();
  const [notifications, setNotifications] = useState<NotificationPreferences>({ ...NOTIFICATION_DEFAULTS });
  const emailAvailable = useEmailAvailable();
  const steps: OnboardingStep[] = ["valuta", "categorie", ...(assistant?.available ? ["assistente" as const] : []), ...(emailAvailable ? ["notifiche" as const] : []), "conferme"];
  const flow = useStepFlow(steps.length);
  const step = steps[flow.index];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!flow.isLast) {
      track("form_step_completed", { flow: "onboarding", step: flow.index + 1 });
      flow.next();
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency, productCountry, language,
          legal: payload,
          notifications,
          ...(categorySetup.payload ? { categories: categorySetup.payload } : {}),
          ...(assistant?.available ? { aiCategorization: assistantEnabled } : {}),
        }),
      });

      if (response.ok) {
        track("onboarding_completed", { currency });
        if (assistant?.available) track("ai_categorization_toggled", { enabled: assistantEnabled });
        track("terms_accepted", { context: "onboarding" });
        track("onboarding_categories_chosen", {
          customized: Boolean(categorySetup.payload),
          ...summarizeCategorySetup(categorySetup.payload ?? categorySetup.items),
        });
        track("onboarding_notifications_chosen", {
          digest: notifications.digestEnabled ? notifications.digestFrequency : "off",
          budget: notifications.budgetAlertsEnabled,
          deadlines: notifications.deadlineAlertsEnabled,
        });
        window.location.assign(DEFAULT_AFTER_LOGIN_PATH);
        return;
      }
      setError(tr("Non siamo riusciti a salvare la valuta. Riprova."));
    } catch {
      setError(tr("Connessione non riuscita. Controlla la rete e riprova."));
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">{tr("Ti diamo il benvenuto")}</h1>
        <StepProgress index={flow.index} count={flow.count} label={tr("Passi dell'onboarding")} className="mt-3" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <StepStage stepKey={flow.index} direction={flow.direction} className="flex flex-col gap-5">
          {step === "valuta" ? (
            <>
              <StepHeading title={tr("In che valuta vuoi vedere i tuoi soldi?")} description={tr("Vale per saldi, transazioni e investimenti.")} />
              <LocaleFields value={{ productCountry, language }} onChange={setProfile} disabled={loading} />
              <CurrencyPicker value={currency} onChange={setCurrency} disabled={loading} />
            </>
          ) : step === "categorie" ? (
            <CategorySetupStep setup={categorySetup} disabled={loading} />
          ) : step === "assistente" ? (
            <>
              <StepHeading title={tr("Vuoi un aiuto a categorizzare?")} description={tr("Puoi cambiare idea quando vuoi in Impostazioni.")} />
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <p>{tr("Quando arrivano movimenti nuovi dalla banca o da un file, un assistente basato su intelligenza artificiale propone una categoria per ogni esercente.")}</p>
                <p>{tr("Quando l'app è quasi certa mette la categoria da sola, e la ritrovi in Categorizza, sotto «Messe dall'app», dove puoi cambiarla. Le altre le scegli tu, una carta alla volta. Se preferisci scegliere sempre tu, lo spegni in Impostazioni.")}</p>
                <p>{tr("Per farlo inviamo a un servizio esterno solo il nome pulito dell'esercente (mai importi, date, IBAN, note o nomi di persone), con richiesta di non conservare i dati.")}</p>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border p-4 text-sm font-medium text-foreground">{tr("Proponi le categorie")}<Switch checked={assistantEnabled} onCheckedChange={setAssistantEnabled} disabled={loading} aria-label={tr("Proponi le categorie")} />
              </label>
            </>
          ) : step === "notifiche" ? (
            <>
              <StepHeading title={tr("Quali email vuoi ricevere?")} description={tr("Partono tutte spente. Ognuna ha il link per disattivarla e le ritrovi in Impostazioni.")} />
              <NotificationChoices value={notifications} onChange={setNotifications} disabled={loading} info={ONBOARDING_NOTIFICATION_INFO} />
              <InboxPreview preferences={notifications} />
            </>
          ) : (
            <>
              <StepHeading title={tr("Ultima cosa: le conferme")} description={tr("Servono per usare l'app. Le trovi sempre in Impostazioni.")} />
              <LegalConsentFields value={consent} onChange={setConsent} disabled={loading} />
            </>
          )}
        </StepStage>

        {error && (
          <p className="rounded-lg bg-neg-soft p-3 text-sm text-neg" role="alert">
            {tr(error)}
          </p>
        )}

        <StepActions
          backLabel={flow.isFirst ? undefined : tr("Indietro")}
          onBack={() => {
            track("form_step_back", { flow: "onboarding", step: flow.index + 1 });
            setError(null);
            flow.back();
          }}
          primaryLabel={flow.isLast ? (loading ? "Salvataggio in corso…" : "Inizia") : step === "categorie" && !categorySetup.customized ? tr("Continua con queste") : tr("Continua")}
          pending={loading}
          disabled={flow.isLast && !complete}
          className="[&_button]:w-full sm:[&_button]:w-auto"
        />
      </form>
    </div>
  );
}
