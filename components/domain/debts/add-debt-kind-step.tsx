"use client";

/** Primo passo di "Aggiungi debito": finanziamento con rate o linea di credito con utilizzo variabile. */

export type AddDebtKind = "loan" | "credit_line";

export interface KindOption {
  kind: AddDebtKind;
  title: string;
  description: string;
}

export const KIND_OPTIONS: readonly KindOption[] = [
  {
    kind: "loan",
    title: "Finanziamento con rate",
    description: "Mutuo, prestito personale o auto: capitale, tasso e un piano di rate da pagare.",
  },
  {
    kind: "credit_line",
    title: "Linea di credito",
    description: "Credit Lombard, fido o scoperto: un massimale che usi quando serve, con interessi che maturano sul saldo di ogni giorno.",
  },
];

export interface AddDebtKindStepProps {
  onChoose: (kind: AddDebtKind) => void;
}

export function AddDebtKindStep({ onChoose }: AddDebtKindStepProps) {
  return (
    <ul className="flex flex-col gap-2">
      {KIND_OPTIONS.map((option) => (
        <li key={option.kind}>
          <button
            type="button"
            onClick={() => onChoose(option.kind)}
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
