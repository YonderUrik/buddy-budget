"use client";

/** Primo passo di "Aggiungi debito": nuovo o già in corso, con la spiegazione di ciascuna strada. */

import { CameraIcon, ChevronRightIcon, FileTextIcon, PlayIcon, type LucideIcon } from "lucide-react";
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

const MODE_ICONS: Record<DebtStartMode, LucideIcon> = { nuovo: PlayIcon, origine: FileTextIcon, fotografia: CameraIcon };

export interface AddDebtStartStepProps {
  onChoose: (mode: DebtStartMode) => void;
}

export function AddDebtStartStep({ onChoose }: AddDebtStartStepProps) {
  return (
    <ul>
      {START_OPTIONS.map((option) => {
        const Icon = MODE_ICONS[option.mode];
        return (
          <li key={option.mode} className="border-b last:border-b-0">
            <button
              type="button"
              onClick={() => onChoose(option.mode)}
              className="flex w-full items-start gap-3 rounded-lg py-4 text-left transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                <Icon className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium text-foreground">{option.title}</span>
                <span className="text-sm text-muted-foreground">{option.description}</span>
              </span>
              <ChevronRightIcon size={16} className="mt-2.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
