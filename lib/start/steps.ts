/** Primi passi della Panoramica: definizione dei passi della checklist e regole pure di visibilità (nessuna dipendenza da DB o UI). */

export const START_STEP_IDS = ["conto", "import", "investimento", "obiettivo"] as const;
export type StartStepId = (typeof START_STEP_IDS)[number];

export interface StartStepDef {
  id: StartStepId;
  title: string;
  description: string;
  /** Dove porta il passo (route reale dell'app). */
  href: string;
  /** Testo del collegamento d'azione. */
  cta: string;
}

/** Link che apre subito il dialog «Nuovo conto» in Liquidità · Conti. */
export const NEW_ACCOUNT_HREF = "/liquidita/conti?nuovo=1";

export const START_STEPS: readonly StartStepDef[] = [
  {
    id: "conto",
    title: "Crea un conto",
    description: "Un conto manuale basta: nome e saldo di oggi.",
    href: NEW_ACCOUNT_HREF,
    cta: "Crea un conto",
  },
  {
    id: "import",
    title: "Importa i movimenti",
    description: "Carica il CSV o l'estratto conto della tua banca, oppure collega la banca.",
    href: "/importazioni",
    cta: "Importa un file",
  },
  {
    id: "investimento",
    title: "Aggiungi un investimento",
    description: "Registra un acquisto o importa il rendiconto del tuo broker.",
    href: "/investimenti",
    cta: "Vai agli investimenti",
  },
  {
    id: "obiettivo",
    title: "Imposta un obiettivo",
    description: "Scegli le ipotesi del tuo piano in Analitiche o un budget per categoria.",
    href: "/analitiche",
    cta: "Vai alle analitiche",
  },
];

/** Stato dei primi passi come lo restituisce `GET /api/start`. */
export interface StartStatus {
  steps: Record<StartStepId, boolean>;
  /** L'utente ha chiuso la checklist. */
  dismissed: boolean;
  /** Tutti i passi sono fatti. */
  completed: boolean;
  /** Ci sono conti di esempio nell'account. */
  demoActive: boolean;
  /** Prima volta che l'API vede la checklist completa (serve a registrare l'evento una sola volta). */
  justCompleted?: boolean;
}

export function countDoneSteps(steps: Record<StartStepId, boolean>): number {
  return START_STEP_IDS.filter((id) => steps[id]).length;
}

/** La checklist si vede finché non è chiusa né completa, e mai durante l'esplorazione con dati d'esempio. */
export function shouldShowChecklist(status: Pick<StartStatus, "dismissed" | "completed" | "demoActive">): boolean {
  return !status.dismissed && !status.completed && !status.demoActive;
}
