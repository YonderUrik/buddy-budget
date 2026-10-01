"use client";

/** Primo passo di "Aggiungi debito": nuovo o già in corso, con la spiegazione di ciascuna strada. */

import type { DebtStartMode } from "@/lib/db/schema/debts";

export interface StartOption {
  mode: DebtStartMode;
  title: string;
  description: string;
}

/** Le tre strade, con ciò che l'utente deve sapere per sceglierne una. */
export const START_OPTIONS: readonly StartOption[] = [
  {
    mode: "nuovo",
    title: "Inizia da oggi",
    description: "Il finanziamento parte adesso o l'hai appena firmato. Il piano è tutto da pagare.",
  },
  {
    mode: "origine",
    title: "Già in corso: ho i dati del contratto",
    description:
      "Inserisci capitale, tasso e rate di quando l'hai preso. Ricostruiamo il piano e vedi quante rate sono già passate: poi confermi quelle che hai pagato. Adatto se hai il contratto sotto mano.",
  },
  {
    mode: "fotografia",
    title: "Già in corso: parto da com'è oggi",
    description:
      "Inserisci quanto devi ancora restituire, la rata e le rate rimaste. Il piano parte da oggi, senza storico. Adatto se non hai più il contratto o è stato rinegoziato.",
  },
];

export interface AddDebtStartStepProps {
  onChoose: (mode: DebtStartMode) => void;
}

export function AddDebtStartStep({ onChoose }: AddDebtStartStepProps) {
  return (
    <ul className="flex flex-col gap-2">
      {START_OPTIONS.map((option) => (
        <li key={option.mode}>
          <button
            type="button"
            onClick={() => onChoose(option.mode)}
            className="flex w-full flex-col gap-1 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none"
          >
            <span className="font-medium text-foreground">{option.title}</span>
            <span className="text-sm text-muted-foreground">{option.description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
