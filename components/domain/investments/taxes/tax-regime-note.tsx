"use client";

/**
 * Nota in fondo alla scheda Tasse: avvertenza sulle stime e scelta compatta del regime (amministrato o dichiarativo),
 * che cambia come si compensano le minusvalenze nell'anno e quando si contano le imposte.
 */

import { InfoHint, SegmentedControl } from "@/components/domain/shared";
import type { TaxRegime } from "@/lib/db/schema/investments";

const OPTIONS = [
  { value: "amministrato", label: "Amministrato" },
  { value: "dichiarativo", label: "Dichiarativo" },
] as const;

const REGIME_HINT =
  "Amministrato (quasi tutti i broker italiani): il broker trattiene le tasse a ogni vendita e una minusvalenza compensa solo le plusvalenze che realizzi dopo. Dichiarativo (di solito i broker esteri, come IBKR o DEGIRO): paghi in dichiarazione e nell'anno si sommano tutte. Le crypto seguono sempre la dichiarazione.";

export interface TaxRegimeNoteProps {
  regime: TaxRegime;
  onChange: (regime: TaxRegime) => void;
  saving: boolean;
}

export function TaxRegimeNote({ regime, onChange, saving }: TaxRegimeNoteProps) {
  return (
    <div className="flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-prose">
        Sono stime secondo le regole italiane, non un calcolo fiscale: per la dichiarazione fai riferimento al broker o a un commercialista.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <span>Regime</span>
        <InfoHint label="Cos'è: regime">{REGIME_HINT}</InfoHint>
        <SegmentedControl
          options={OPTIONS}
          value={regime}
          onChange={(value) => !saving && value !== regime && onChange(value)}
          ariaLabel="Regime fiscale del portafoglio"
        />
      </div>
    </div>
  );
}
