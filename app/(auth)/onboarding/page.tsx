"use client";

/** Onboarding in due passi: valuta principale (EUR preselezionato), poi le conferme legali; infine atterraggio in Panoramica. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CurrencyPicker, LegalConsentFields, useLegalConsent } from "@/components/domain/auth";
import { StepActions, StepHeading, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { DEFAULT_AFTER_LOGIN_PATH } from "@/lib/auth/constants";
import { DEFAULT_CURRENCY, type SupportedCurrency } from "@/lib/validation/currency";
import { track } from "@/lib/analytics";

const ONBOARDING_STEPS = 2;

export default function OnboardingPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const { consent, setConsent, complete, payload } = useLegalConsent();
  const flow = useStepFlow(ONBOARDING_STEPS);
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
        body: JSON.stringify({ currency, legal: payload }),
      });

      if (response.ok) {
        track("onboarding_completed", { currency });
        track("terms_accepted", { context: "onboarding" });
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
          {flow.index === 0 ? (
            <>
              <StepHeading title="In che valuta vuoi vedere i tuoi soldi?" description="Vale per saldi, transazioni e investimenti." />
              <CurrencyPicker value={currency} onChange={setCurrency} disabled={loading} />
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
          primaryLabel={flow.isLast ? (loading ? "Salvataggio in corso…" : "Inizia") : "Continua"}
          pending={loading}
          disabled={flow.isLast && !complete}
          className="[&_button]:w-full sm:[&_button]:w-auto"
        />
      </form>
    </div>
  );
}
