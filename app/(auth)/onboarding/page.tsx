"use client";

import { useEmailAvailable } from "@/components/local-mode-provider";

/**
 * Onboarding: main currency (EUR preselected), what to keep an eye on (decides the first steps in Panoramica, can be
 * skipped), proposed categories (confirm with one tap or customise), category assistant (only if the service exists, off
 * by default and explained), optional emails (all off), legal confirmations; then Panoramica.
 */

import { useState } from "react";
import { LocaleFields } from "@/components/domain/settings/locale-fields";
import { useLocalization } from "@/lib/localization/provider";
import { useInstance } from "@/lib/instance/provider";
import { AUTH_TITLE, CurrencyPicker, LegalConsentFields, useLegalConsent } from "@/components/domain/auth";
import { CategorySetupStep, useCategorySetup } from "@/components/domain/categories";
import { FocusPicker } from "@/components/domain/start";
import { focusOptionsFor, type StartFocus } from "@/lib/start";
import { isCountryPathAvailable } from "@/lib/localization/config";
import { InboxPreview, NotificationChoices, ONBOARDING_NOTIFICATION_INFO } from "@/components/domain/notifications";
import { StepActions, StepHeading, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { Switch } from "@/components/ui/switch";
import { useAiCategorizationQuery } from "@/lib/queries/notifications";
import { DEFAULT_AFTER_LOGIN_PATH } from "@/lib/auth/constants";
import { DEFAULT_CURRENCY, type SupportedCurrency } from "@/lib/validation/currency";
import { track } from "@/lib/analytics";
import { summarizeCategorySetup } from "@/lib/categories/setup";
import { NOTIFICATION_DEFAULTS, type NotificationPreferences } from "@/lib/notifications";
import { loadAttribution } from "@/lib/analytics/attribution";

type OnboardingStep = "valuta" | "interessi" | "categorie" | "assistente" | "notifiche" | "conferme";

export default function OnboardingPage() {
  const { t: tr } = useLocalization();
  const { productCountry, language, setProfile } = useLocalization();
  // Language proposed on arrival (sign-in choice or browser language): the completion event says whether it was kept.
  const [proposedLanguage] = useState(language);
  const [proposedCountry] = useState(productCountry);
  const [currency, setCurrency] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const { consent, setConsent, complete, payload } = useLegalConsent();
  // Consenso al trattamento con AI: spento finché l'utente non lo accende (art. 7 GDPR, nessuna casella pre-selezionata).
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const { data: assistant } = useAiCategorizationQuery();
  const categorySetup = useCategorySetup();
  const [notifications, setNotifications] = useState<NotificationPreferences>({ ...NOTIFICATION_DEFAULTS });
  const [focus, setFocus] = useState<StartFocus[]>([]);
  const focusOptions = focusOptionsFor(isCountryPathAvailable(productCountry, "/pensione"));
  const { selfHosted } = useInstance();
  const emailAvailable = useEmailAvailable();
  // Self-hosted: no email step without an email service, no acceptance of the hosted service's Terms.
  const steps: OnboardingStep[] = [
    "valuta",
    "interessi",
    "categorie",
    ...(assistant?.available ? (["assistente"] as const) : []),
    ...(emailAvailable ? (["notifiche"] as const) : []),
    ...(selfHosted ? [] : (["conferme"] as const)),
  ];
  const needsConsent = !selfHosted;
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
          ...(needsConsent ? { legal: payload } : {}),
          ...(emailAvailable ? { notifications } : {}),
          // A pension answer left over from a country change is dropped: the checklist must never point to a hidden section.
          focus: focus.filter((f) => focusOptions.some((o) => o.id === f)),
          ...(categorySetup.payload ? { categories: categorySetup.payload } : {}),
          ...(assistant?.available ? { aiCategorization: assistantEnabled } : {}),
        }),
      });

      if (response.ok) {
        track("onboarding_completed", { currency, language, languageKept: language === proposedLanguage, country: productCountry, countryKept: productCountry === proposedCountry, ...loadAttribution() });
        if (assistant?.available) track("ai_categorization_toggled", { enabled: assistantEnabled });
        track("terms_accepted", { context: "onboarding" });
        track("onboarding_categories_chosen", {
          customized: Boolean(categorySetup.payload),
          ...summarizeCategorySetup(categorySetup.payload ?? categorySetup.items),
        });
        const chosen = focus.filter((f) => focusOptions.some((o) => o.id === f));
        track("onboarding_focus_chosen", {
          count: chosen.length,
          spese: chosen.includes("spese"),
          investimenti: chosen.includes("investimenti"),
          debiti: chosen.includes("debiti"),
          pensione: chosen.includes("pensione"),
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
        <h1 className={AUTH_TITLE}>{tr("Ti diamo il benvenuto")}</h1>
        <StepProgress index={flow.index} count={flow.count} label={tr("Passi dell'onboarding")} className="mt-3" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <StepStage stepKey={flow.index} direction={flow.direction} className="flex flex-col gap-5">
          {step === "valuta" ? (
            <>
              <StepHeading title={tr("In che valuta vuoi vedere i tuoi soldi?")} description={tr("Vale per saldi, transazioni e investimenti.")} />
              <CurrencyPicker value={currency} onChange={setCurrency} disabled={loading} />
              <LocaleFields value={{ productCountry, language }} currency={currency} onChange={setProfile} disabled={loading} divided />
            </>
          ) : step === "interessi" ? (
            <>
              <StepHeading title={tr("Cosa vuoi tenere sotto controllo?")} description={tr("Scegli quante cose vuoi: in Panoramica ti diciamo da dove partire. Puoi cambiarle quando vuoi.")} />
              <FocusPicker value={focus} onChange={setFocus} options={focusOptions} disabled={loading} />
            </>
          ) : step === "categorie" ? (
            <CategorySetupStep setup={categorySetup} disabled={loading} />
          ) : step === "assistente" ? (
            <>
              <StepHeading title={tr("Vuoi un aiuto a categorizzare?")} description={tr("Puoi cambiare idea quando vuoi in Impostazioni.")} />
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <p>{tr("Quando arrivano movimenti nuovi dalla banca o da un file, un assistente basato su intelligenza artificiale propone una categoria per ogni esercente.")}</p>
                <p>{tr("Quando l'app è abbastanza sicura mette la categoria da sola, e la ritrovi in Categorizza, sotto «Messe dall'app», dove puoi cambiarla. Le altre le scegli tu, una carta alla volta. Se preferisci scegliere sempre tu, lo spegni in Impostazioni.")}</p>
                <p>{tr("Per farlo inviamo a OpenRouter il nome pulito della controparte, anche se è una persona, per tutti i tipi di movimento (senza importi, date, IBAN o note), in modalità zero data retention: lo ricevono solo fornitori che non conservano i dati e non li usano per l'addestramento.")}</p>
                <p>{tr("Con lo stesso assistente, in «Cerca» puoi chiedere all'AI di leggere una frase che le regole non capiscono: riceve solo quella frase, e solo quando tocchi «Chiedi all'AI».")}</p>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border p-4 text-sm font-medium text-foreground">{tr("Usa l'assistente AI")}<Switch checked={assistantEnabled} onCheckedChange={setAssistantEnabled} disabled={loading} aria-label={tr("Usa l'assistente AI")} />
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
          primaryLabel={flow.isLast ? (loading ? "Salvataggio in corso…" : "Inizia") : step === "categorie" && !categorySetup.customized ? tr("Continua con queste") : step === "interessi" && focus.length === 0 ? tr("Salta") : tr("Continua")}
          pending={loading}
          disabled={flow.isLast && needsConsent && !complete}
          className="[&_button]:w-full sm:[&_button]:w-auto"
        />
      </form>
    </div>
  );
}
