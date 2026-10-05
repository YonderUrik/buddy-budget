"use client";

/** Card del regime fiscale del portafoglio (amministrato o dichiarativo), con cosa cambia e l'avvertenza sulle stime. */

import { SegmentedControl } from "@/components/domain/shared";
import { Card, CardContent } from "@/components/ui/card";
import type { TaxRegime } from "@/lib/db/schema/investments";

const OPTIONS = [
  { value: "amministrato", label: "Amministrato" },
  { value: "dichiarativo", label: "Dichiarativo" },
] as const;

const EXPLANATIONS: Record<TaxRegime, string> = {
  amministrato:
    "Il broker fa da sostituto d'imposta: trattiene le tasse a ogni vendita e tiene lo zaino delle minusvalenze. Una minusvalenza compensa solo le plusvalenze che realizzi dopo.",
  dichiarativo:
    "Le tasse su plus e minusvalenze le paghi tu in dichiarazione: nell'anno si sommano tutte, e le minusvalenze che restano valgono per i 4 anni dopo.",
};

export interface TaxRegimeCardProps {
  regime: TaxRegime;
  onChange: (regime: TaxRegime) => void;
  saving: boolean;
}

export function TaxRegimeCard({ regime, onChange, saving }: TaxRegimeCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 max-w-prose">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regime fiscale</p>
          <p className="mt-1 text-sm text-foreground">{EXPLANATIONS[regime]}</p>
        </div>
        <SegmentedControl
          options={OPTIONS}
          value={regime}
          onChange={(value) => !saving && value !== regime && onChange(value)}
          ariaLabel="Regime fiscale del portafoglio"
          stretch
          className="sm:w-fit sm:shrink-0"
        />
      </CardContent>
    </Card>
  );
}

/** Avvertenza unica della scheda Tasse, in fondo: sono stime, non un calcolo fiscale. */
export function TaxDisclaimer() {
  return (
    <p className="max-w-prose px-1 text-xs text-muted-foreground">
      Le crypto seguono sempre le regole della dichiarazione. Sono stime per capire i numeri secondo le regole italiane, non un calcolo fiscale: per la
      dichiarazione fai riferimento al broker o a un commercialista.
    </p>
  );
}
