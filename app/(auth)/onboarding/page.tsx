"use client";

/** Onboarding: scelta della valuta principale (EUR preselezionato), poi atterraggio in Panoramica. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CurrencyPicker } from "@/components/domain/auth";
import { Button } from "@/components/ui/button";
import { DEFAULT_AFTER_LOGIN_PATH } from "@/lib/auth/constants";
import { DEFAULT_CURRENCY, type SupportedCurrency } from "@/lib/validation/currency";
import { track } from "@/lib/analytics";

export default function OnboardingPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      });

      if (response.ok) {
        track("onboarding_completed", { currency });
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
        <p className="text-text-2">
          Un&apos;ultima cosa: in che valuta vuoi vedere saldi e transazioni?
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <CurrencyPicker value={currency} onChange={setCurrency} disabled={loading} />

        {error && (
          <p className="rounded-lg bg-neg-soft p-3 text-sm text-neg" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
          {loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {loading ? "Salvataggio in corso…" : "Inizia"}
        </Button>
      </form>
    </div>
  );
}
