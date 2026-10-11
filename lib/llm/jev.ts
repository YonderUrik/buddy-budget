import type { CategoryType } from "@/lib/categories/groups";

/** Endpoint Decisions di OpenRouter (alpha): Jev risponde con un'opzione e una probabilità per ciascuna. */
export const JEV_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
export const JEV_DEFAULT_MODEL = "typesafe/jev-1.13";
/** Esercenti per richiesta: tiene stato ed esempi molto sotto la finestra di 32.000 token. */
export const JEV_BATCH_SIZE = 20;
const JEV_TIMEOUT_MS = 30_000;

export interface JevCategory {
  name: string;
  type: CategoryType;
}

export interface JevMerchant {
  /** Identificatore locale, restituito invariato nel risultato. */
  id: string;
  /** Nome pulito dell'esercente: l'unico testo della transazione che lascia il server. */
  name: string;
  mcc: string | null;
  isIncome: boolean;
}

export interface JevExample {
  name: string;
  category: string;
}

export interface JevDecision {
  id: string;
  categoryName: string;
  /** Probabilità dell'opzione scelta (0-1). */
  confidence: number;
  probabilities: Record<string, number>;
}

export interface JevRequestInput {
  merchants: JevMerchant[];
  categories: JevCategory[];
  examples?: JevExample[];
  model?: string;
}

/** Categorie ammesse per un esercente: le entrate solo per importi positivi, le altre solo per i negativi. */
export function categoriesFor(merchant: JevMerchant, categories: JevCategory[]): JevCategory[] {
  return categories.filter((category) => (category.type === "entrata") === merchant.isIncome);
}

/**
 * Corpo della richiesta Decisions: una domanda a scelta per esercente, con le sole categorie dell'utente
 * compatibili con la direzione. Niente importi, date, conti né identificativi utente nello stato; la
 * richiesta pretende ZDR e nessuna raccolta dati dal fornitore.
 */
export function buildCategorizationRequest(input: JevRequestInput) {
  const questions: Record<string, unknown> = {};
  input.merchants.forEach((merchant, index) => {
    const criteria: Record<string, null> = {};
    for (const category of categoriesFor(merchant, input.categories)) criteria[category.name] = null;
    questions[`m${index}`] = {
      type: "choice",
      instructions: `In quale categoria di spesa o entrata rientra l'esercente con id "${merchant.id}" in state.merchants? Usa gli esempi dell'utente come riferimento per il suo modo di classificare.`,
      criteria,
    };
  });

  return {
    model: input.model ?? JEV_DEFAULT_MODEL,
    state: {
      examples: input.examples ?? [],
      merchants: input.merchants.map(({ id, name, mcc, isIncome }) => ({ id, name, mcc, isIncome })),
    },
    questions,
    provider: { zdr: true, data_collection: "deny" },
  };
}

interface DecisionsResponse {
  answers?: Record<string, { type?: string; choice?: string; confidence?: number; probabilities?: Record<string, number> }>;
  usage?: { input_tokens?: number; output_tokens?: number; cost?: number };
}

/** Decisioni valide dalla risposta: scarta le risposte mancanti e le categorie fuori dalla lista ammessa. */
export function parseDecisions(
  response: DecisionsResponse,
  input: Pick<JevRequestInput, "merchants" | "categories">
): JevDecision[] {
  const decisions: JevDecision[] = [];
  input.merchants.forEach((merchant, index) => {
    const answer = response.answers?.[`m${index}`];
    if (!answer || answer.type !== "choice" || typeof answer.choice !== "string") return;
    const allowed = new Set(categoriesFor(merchant, input.categories).map((category) => category.name));
    if (!allowed.has(answer.choice)) return;
    const confidence =
      typeof answer.confidence === "number" ? answer.confidence : answer.probabilities?.[answer.choice] ?? 0;
    decisions.push({
      id: merchant.id,
      categoryName: answer.choice,
      confidence,
      probabilities: answer.probabilities ?? {},
    });
  });
  return decisions;
}

export interface JevResult {
  decisions: JevDecision[];
  inputTokens: number;
  costUsd: number | null;
}

export interface JevClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  url?: string;
}

/**
 * Classifica un lotto di esercenti con Jev. Qualunque problema (HTTP non ok, timeout, risposta non
 * conforme) lancia un errore: chi chiama decide se ritentare o lasciare i movimenti da categorizzare.
 */
export async function classifyWithJev(input: JevRequestInput, options: JevClientOptions): Promise<JevResult> {
  const response = await (options.fetchImpl ?? fetch)(options.url ?? JEV_DECISIONS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildCategorizationRequest(input)),
    signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Jev non disponibile (HTTP ${response.status})`);

  const body = (await response.json()) as DecisionsResponse;
  return {
    decisions: parseDecisions(body, input),
    inputTokens: body.usage?.input_tokens ?? 0,
    costUsd: typeof body.usage?.cost === "number" ? body.usage.cost : null,
  };
}
