"use client";

/** Card del regime fiscale del portafoglio (amministrato o dichiarativo), con cosa cambia e l'avvertenza sulle stime. */

import { SegmentedControl } from "@/components/domain/shared";
import type { TaxRegime } from "@/lib/db/schema/investments";
import { LandmarkIcon } from "lucide-react";
import { PanelSection } from "../panel-section";

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
    <PanelSection icon={LandmarkIcon} title="Regime fiscale" color="var(--swatch-slate)"
      action={
        <SegmentedControl
          options={OPTIONS}
          value={regime}
          onChange={(value) => !saving && value !== regime && onChange(value)}
          ariaLabel="Regime fiscale del portafoglio"
        />
      }>
      <div className="flex flex-col gap-2 text-sm">
        <p className="max-w-prose text-foreground">{EXPLANATIONS[regime]}</p>
        <p className="max-w-prose text-muted-foreground">
          Le crypto seguono sempre le regole della dichiarazione. Sono stime per capire i numeri secondo le regole italiane, non un
          calcolo fiscale: per la dichiarazione fai riferimento al broker o a un commercialista.
        </p>
      </div>
    </PanelSection>
  );
}
