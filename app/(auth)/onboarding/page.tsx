"use client";

/**
 * Onboarding: valuta principale (EUR preselezionato), categorie proposte (confermabili con un tocco o da personalizzare),
 * assistente per le categorie (se il servizio c'è, acceso di default e spiegato), email facoltative (tutte spente: si
 * accendono solo per scelta), conferme legali; infine Panoramica.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [currency, setCurrency] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const { consent, setConsent, complete, payload } = useLegalConsent();
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const { data: assistant } = useAiCategorizationQuery();
  const categorySetup = useCategorySetup();
  const [notifications, setNotifications] = useState<NotificationPreferences>({ ...NOTIFICATION_DEFAULTS });
  const steps: OnboardingStep[] = assistant?.available
    ? ["valuta", "categorie", "assistente", "notifiche", "conferme"]
    : ["valuta", "categorie", "notifiche", "conferme"];
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
          currency,
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
        router.replace(DEFAULT_AFTER_LOGIN_PATH);
        router.refresh();
        return;
      }
      setError("Non siamo riusciti a salvare la valuta. Riprova.");
    } catch {
      setError("Connessione non riuscita. Controlla la rete e riprova.");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">Ti diamo il benvenuto</h1>
        <StepProgress index={flow.index} count={flow.count} label="Passi dell'onboarding" className="mt-3" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <StepStage stepKey={flow.index} direction={flow.direction} className="flex flex-col gap-5">
          {step === "valuta" ? (
            <>
              <StepHeading title="In che valuta vuoi vedere i tuoi soldi?" description="Vale per saldi, transazioni e investimenti." />
              <CurrencyPicker value={currency} onChange={setCurrency} disabled={loading} />
            </>
          ) : step === "categorie" ? (
            <CategorySetupStep setup={categorySetup} disabled={loading} />
          ) : step === "assistente" ? (
            <>
              <StepHeading title="Vuoi un aiuto a categorizzare?" description="Puoi cambiare idea quando vuoi in Impostazioni." />
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <p>Quando arrivano movimenti nuovi dalla banca o da un file, un assistente basato su intelligenza artificiale propone una categoria per ogni esercente.</p>
                <p>Le proposte non si applicano mai da sole: le confermi tu, una carta alla volta. Una scelta diventa una regola solo se lo chiedi.</p>
                <p>Per farlo inviamo a un servizio esterno solo il nome pulito dell&apos;esercente (mai importi, date, IBAN, note o nomi di persone), con richiesta di non conservare i dati.</p>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border p-4 text-sm font-medium text-foreground">
                Proponi le categorie
                <Switch checked={assistantEnabled} onCheckedChange={setAssistantEnabled} disabled={loading} aria-label="Proponi le categorie" />
              </label>
            </>
          ) : step === "notifiche" ? (
            <>
              <StepHeading title="Quali email vuoi ricevere?" description="Partono tutte spente. Ognuna ha il link per disattivarla e le ritrovi in Impostazioni." />
              <NotificationChoices value={notifications} onChange={setNotifications} disabled={loading} info={ONBOARDING_NOTIFICATION_INFO} />
              <InboxPreview preferences={notifications} />
            </>
          ) : (
            <>
              <StepHeading title="Ultima cosa: le conferme" description="Servono per usare l'app. Le trovi sempre in Impostazioni." />
              <LegalConsentFields value={consent} onChange={setConsent} disabled={loading} />
            </>
          )}
        </StepStage>

        {error && (
          <p className="rounded-lg bg-neg-soft p-3 text-sm text-neg" role="alert">
            {error}
          </p>
        )}

        <StepActions
          backLabel={flow.isFirst ? undefined : "Indietro"}
          onBack={() => {
            track("form_step_back", { flow: "onboarding", step: flow.index + 1 });
            setError(null);
            flow.back();
          }}
          primaryLabel={flow.isLast ? (loading ? "Salvataggio in corso…" : "Inizia") : step === "categorie" && !categorySetup.customized ? "Continua con queste" : "Continua"}
          pending={loading}
          disabled={flow.isLast && !complete}
          className="[&_button]:w-full sm:[&_button]:w-auto"
        />
      </form>
    </div>
  );
}
