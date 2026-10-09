/**
 * Percorso di un import da CSV personale in quattro passi, con quello in corso evidenziato: spiega a colpo d'occhio
 * cosa succede al file e dove si trova il suo, nello stile aperto della Panoramica (niente riquadri).
 */

import { CheckIcon, FileUpIcon, ScanSearchIcon, ShieldCheckIcon, SparklesIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImportStep {
  title: string;
  text: string;
  icon: LucideIcon;
  /** Token CSS del colore del passo. */
  color: string;
}

/** Passi di default dell'import da CSV personale. */
export const PERSONAL_IMPORT_STEPS: ImportStep[] = [
  { title: "Carichi il file", text: "Un CSV della tua banca o del tuo broker, fino a 25 MB.", icon: FileUpIcon, color: "var(--swatch-teal)" },
  { title: "Lo analizziamo", text: "L'AI riconosce le colonne e ne ricava un formato tutto tuo.", icon: SparklesIcon, color: "var(--swatch-indigo)" },
  { title: "Controlliamo", text: "Verifichiamo importi, date e doppioni prima di salvare.", icon: ScanSearchIcon, color: "var(--swatch-amber)" },
  { title: "Trovi i dati", text: "Movimenti e operazioni compaiono in Liquidità e Investimenti.", icon: ShieldCheckIcon, color: "var(--swatch-green)" },
];

export interface ImportStepsProps {
  /** Indice (da 0) del passo in corso; i precedenti risultano completati, `steps.length` = tutto fatto. */
  current: number;
  steps?: ImportStep[];
  className?: string;
}

export function ImportSteps({ current, steps = PERSONAL_IMPORT_STEPS, className }: ImportStepsProps) {
  return (
    <ol className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)} aria-label="Come funziona l'importazione">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const Icon = done ? CheckIcon : step.icon;
        return (
          <li key={step.title} aria-current={active ? "step" : undefined} className={cn("flex gap-3", !done && !active && "opacity-60")}>
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `color-mix(in oklab, ${step.color} ${active ? 24 : 14}%, transparent)`, color: step.color }}
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                <span className="text-muted-foreground">{index + 1}. </span>{step.title}
              </span>
              <span className="block text-xs text-muted-foreground">{step.text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Passo in corso per lo stato di un job (`undefined` = nessun file scelto: si parte dal caricamento). */
export function personalImportStep(status: string | undefined): number {
  if (status === "queued" || status === "processing") return 1;
  if (status === "ready" || status === "review_failed") return 2;
  if (status === "imported") return 4;
  return 0;
}
