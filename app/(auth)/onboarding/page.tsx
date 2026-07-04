"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SUPPORTED_CURRENCIES = [
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "USD", label: "Dollaro USA", symbol: "$" },
  { value: "GBP", label: "Sterlina", symbol: "£" },
  { value: "CHF", label: "Franco Sviz.", symbol: "CHF" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currency) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      });

      if (response.ok) {
        router.push("/");
      } else {
        setError("Errore durante il salvataggio. Riprova.");
        setLoading(false);
      }
    } catch {
      setError("Errore di rete. Riprova.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col space-y-2 text-center">
        <div className="mb-2 text-xs font-semibold tracking-wider text-pos uppercase">
          Step 1 di 1
        </div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Benvenuto a bordo</h1>
        <p className="text-sm text-text-2">
          Personalizza la tua esperienza scegliendo la valuta principale per i tuoi conti e le tue transazioni.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-2 gap-4">
          {SUPPORTED_CURRENCIES.map((c) => {
            const isSelected = currency === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCurrency(c.value)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-6 transition-all hover:bg-muted/50",
                  isSelected
                    ? "border-primary bg-pos-soft/30 text-primary shadow-sm"
                    : "border-border bg-card text-foreground"
                )}
              >
                <span className="text-2xl font-bold font-heading">{c.symbol}</span>
                <span className="text-sm font-medium">{c.label}</span>
                <span className="text-xs opacity-70">{c.value}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg bg-neg-soft p-3 text-sm text-neg text-center">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="h-12 w-full text-base"
          disabled={loading || !currency}
        >
          {loading && <Loader2 className="mr-2 size-5 animate-spin" />}
          {loading ? "Salvataggio in corso…" : "Entra in BuddyBudget"}
        </Button>
      </form>
    </div>
  );
}
