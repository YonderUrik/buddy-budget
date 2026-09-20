import type { Category } from "@/lib/db/schema/categories";
import { createOllamaSuggester } from "./ollama";

export interface SuggestInput {
  index: number;
  description: string;
  amount: number;
}

export interface LlmSuggestion {
  index: number;
  categoryName: string;
  confidence: number;
}

export interface CategorySuggester {
  suggest(input: SuggestInput[], categories: Category[]): Promise<LlmSuggestion[]>;
}

/**
 * Suggeritore configurato, oppure `null` se nessun modello è collegato. Un modello assente è uno
 * stato normale del prodotto, non un guasto: chi chiama salta semplicemente il livello, senza
 * errori né avvisi all'utente.
 */
export function getSuggester(): CategorySuggester | null {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim();
  if (!baseUrl) return null;
  return createOllamaSuggester(baseUrl, process.env.OLLAMA_MODEL?.trim() || "llama3.2");
}
