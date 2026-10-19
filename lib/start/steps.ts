/** Panoramica first steps: checklist step definitions and pure visibility rules (no DB or UI dependency). */

export const START_STEP_IDS = ["conto", "import", "investimento", "debito", "pensione", "obiettivo"] as const;
export type StartStepId = (typeof START_STEP_IDS)[number];

/** What the user wants to keep an eye on, chosen at the end of onboarding: it decides which steps the checklist asks for. */
export const START_FOCUS_IDS = ["spese", "investimenti", "debiti", "pensione"] as const;
export type StartFocus = (typeof START_FOCUS_IDS)[number];

/** One answer of «Cosa vuoi tenere sotto controllo?» (texts are Italian source strings, translated by the UI). */
export interface StartFocusOption {
  id: StartFocus;
  title: string;
  description: string;
}

export const START_FOCUS_OPTIONS: readonly StartFocusOption[] = [
  { id: "spese", title: "Spese e conti", description: "Dove vanno i soldi ogni mese, per categoria." },
  { id: "investimenti", title: "Investimenti", description: "ETF, azioni, BTP e crypto, con rendimento e tasse." },
  { id: "debiti", title: "Mutuo e prestiti", description: "Rate, interessi e quando finisci di pagare." },
  { id: "pensione", title: "Fondo pensione", description: "Quanto hai da parte e quanto rende." },
];

/** The answers available in a product country: the pension one only where the pension section exists. */
export function focusOptionsFor(pensionAvailable: boolean): readonly StartFocusOption[] {
  return pensionAvailable ? START_FOCUS_OPTIONS : START_FOCUS_OPTIONS.filter((o) => o.id !== "pensione");
}

/** Steps asked when the user picked nothing (or signed up before the question existed): the original four. */
export const DEFAULT_START_STEP_IDS: readonly StartStepId[] = ["conto", "import", "investimento", "obiettivo"];

/** Step that each focus adds to the checklist. */
const FOCUS_STEP: Record<StartFocus, StartStepId> = { spese: "import", investimenti: "investimento", debiti: "debito", pensione: "pensione" };

/**
 * Steps for this user, in a fixed order: the account always comes first and the target last, the others follow the
 * focus. `pensionAvailable` is false where the pension section is hidden (Germany), so the step never points to it.
 */
export function startStepsFor(focus: readonly StartFocus[] | null | undefined, options: { pensionAvailable: boolean }): StartStepId[] {
  const wanted = new Set<StartStepId>(focus && focus.length > 0 ? ["conto", ...focus.map((f) => FOCUS_STEP[f]), "obiettivo"] : DEFAULT_START_STEP_IDS);
  if (!options.pensionAvailable) wanted.delete("pensione");
  return START_STEP_IDS.filter((id) => wanted.has(id));
}

export interface StartStepDef {
  id: StartStepId;
  title: string;
  description: string;
  /** Dove porta il passo (route reale dell'app). */
  href: string;
  /** Testo del collegamento d'azione. */
  cta: string;
  /** What is said once the step is done (toast and the line above the next step). */
  done: string;
}

/** Link che apre subito il dialog «Nuovo conto» in Liquidità · Conti. */
export const NEW_ACCOUNT_HREF = "/liquidita/conti?nuovo=1";

/** Parametro che apre «Il tuo traguardo» in Analitiche. */
export const GOAL_PARAM = "traguardo";
/** Link che apre subito «Il tuo traguardo» in Analitiche. */
export const GOAL_HREF = `/analitiche?${GOAL_PARAM}=1`;

export const START_STEPS: readonly StartStepDef[] = [
  {
    id: "conto",
    title: "Aggiungi il tuo conto",
    description: "Collega la banca oppure crealo a mano: bastano il nome e il saldo di oggi.",
    href: NEW_ACCOUNT_HREF,
    cta: "Aggiungi un conto",
    done: "Conto aggiunto",
  },
  {
    id: "import",
    title: "Importa i movimenti",
    description: "Carica il CSV o l'estratto conto della tua banca, oppure collega la banca.",
    href: "/importazioni",
    cta: "Importa un file",
    done: "Movimenti aggiunti",
  },
  {
    id: "investimento",
    title: "Aggiungi un investimento",
    description: "Registra un acquisto o importa il rendiconto del tuo broker.",
    href: "/investimenti",
    cta: "Vai agli investimenti",
    done: "Primo investimento registrato",
  },
  {
    id: "debito",
    title: "Aggiungi il mutuo o un prestito",
    description: "Importo, tasso e durata: calcoliamo il piano rate, quanto paghi di interessi e quando finisci.",
    href: "/debiti",
    cta: "Aggiungi un finanziamento",
    done: "Finanziamento aggiunto",
  },
  {
    id: "pensione",
    title: "Aggiungi il fondo pensione",
    description: "Bastano i contributi versati e il valore di oggi, dall'area clienti del fondo.",
    href: "/pensione",
    cta: "Aggiungi il fondo",
    done: "Fondo pensione aggiunto",
  },
  {
    id: "obiettivo",
    title: "Fissa il tuo traguardo",
    description: "Dicci quanto ti serve in un anno: calcoliamo il patrimonio che ti basta per vivere di rendita e quando ci arrivi.",
    href: GOAL_HREF,
    cta: "Fissa il traguardo",
    done: "Traguardo fissato",
  },
];

/** Where the target in Analitiche is hidden (Germany), the last step asks for a category budget instead. */
const BUDGET_STEP: Pick<StartStepDef, "title" | "description" | "href" | "cta" | "done"> = {
  title: "Imposta un budget",
  description: "Imposta un budget per categoria.",
  href: "/liquidita/categorie",
  cta: "Vai alle categorie",
  done: "Budget impostato",
};

/** Step texts and links for a product country (`retirementAvailable`: Analitiche is shown). */
export function startStepDefinitionsFor(options: { retirementAvailable: boolean }): StartStepDef[] {
  return START_STEPS.map((step) => (step.id === "obiettivo" && !options.retirementAvailable ? { ...step, ...BUDGET_STEP } : step));
}

/** First-steps state as returned by `GET /api/start`. */
export interface StartStatus {
  /** Which steps are done (all of them, including those this user is not asked for). */
  steps: Record<StartStepId, boolean>;
  /** The steps this user is asked for, in order (from `startStepsFor`). */
  stepIds: StartStepId[];
  /** What the user chose to keep an eye on (`null`: never chosen). */
  focus: StartFocus[] | null;
  /** Steps the user chose to skip («Non mi serve»): they no longer block the end of the checklist. */
  skipped: StartStepId[];
  /** L'utente ha chiuso la checklist. */
  dismissed: boolean;
  /** Tutti i passi sono fatti. */
  completed: boolean;
  /** Ci sono conti di esempio nell'account. */
  demoActive: boolean;
  /** Prima volta che l'API vede la checklist completa (serve a registrare l'evento una sola volta). */
  justCompleted?: boolean;
}

/** How many of `ids` (default: all steps) are done. */
export function countDoneSteps(steps: Record<StartStepId, boolean>, ids: readonly StartStepId[] = START_STEP_IDS): number {
  return ids.filter((id) => steps[id]).length;
}

/** The first step of the list neither done nor skipped (`null` when all are settled). */
export function nextStartStep(steps: Record<StartStepId, boolean>, ids: readonly StartStepId[], skipped: readonly StartStepId[] = []): StartStepId | null {
  return ids.find((id) => !steps[id] && !skipped.includes(id)) ?? null;
}

/** The account is what everything else hangs on: it can be postponed but never skipped. */
export const UNSKIPPABLE_STEPS: readonly StartStepId[] = ["conto"];

/** True when every step asked is done or skipped. */
export function allStepsSettled(steps: Record<StartStepId, boolean>, ids: readonly StartStepId[], skipped: readonly StartStepId[]): boolean {
  return ids.every((id) => steps[id] || skipped.includes(id));
}

/** Steps of `ids` that are done now and were not in `before`: they drive the «done, next» acknowledgement. */
export function newlyDoneSteps(before: Partial<Record<StartStepId, boolean>>, now: Record<StartStepId, boolean>, ids: readonly StartStepId[]): StartStepId[] {
  return ids.filter((id) => now[id] && !before[id]);
}

/** La checklist si vede finché non è chiusa né completa, e mai durante l'esplorazione con dati d'esempio. */
export function shouldShowChecklist(status: Pick<StartStatus, "dismissed" | "completed" | "demoActive">): boolean {
  return !status.dismissed && !status.completed && !status.demoActive;
}
