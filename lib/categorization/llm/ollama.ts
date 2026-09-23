import { z } from "zod";
import type { Category } from "@/lib/db/schema/categories";
import { CATEGORY_TYPE_LABELS } from "@/lib/categories/groups";
import type { CategorySuggester, LlmSuggestion, SuggestInput } from "./index";

const TIMEOUT_MS = 10_000;

const llmResponseSchema = z.array(
  z.object({
    index: z.number().int().min(0),
    categoryName: z.string(),
    confidence: z.number().min(0).max(1),
  })
);

/** Prompt in un solo blocco: categorie disponibili e transazioni da classificare, senza dati di conto. */
function buildPrompt(input: SuggestInput[], categories: Category[]): string {
  const categoryList = categories
    .filter((category) => !category.isFallback)
    .map((category) => `- ${category.name} (${CATEGORY_TYPE_LABELS[category.type]})`)
    .join("\n");
  const transactionList = input
    .map((item) => `${item.index}. "${item.description}" — importo ${item.amount.toFixed(2)}`)
    .join("\n");

  return [
    "Classifica ogni transazione bancaria nella categoria più adatta fra quelle elencate.",
    "Le categorie di tipo 'entrata' valgono solo per importi positivi, le altre solo per importi negativi.",
    "",
    "Categorie disponibili:",
    categoryList,
    "",
    "Transazioni:",
    transactionList,
    "",
    'Rispondi solo con un array JSON: [{"index": 0, "categoryName": "<nome esatto dalla lista>", "confidence": 0.0-1.0}].',
    "Ometti le transazioni di cui non sei ragionevolmente sicuro. Nessun testo fuori dal JSON.",
  ].join("\n");
}

/**
 * Suggeritore basato su un'istanza Ollama raggiungibile via HTTP. Qualunque problema — connessione
 * rifiutata, timeout, risposta non conforme, categoria inesistente — si traduce in zero proposte,
 * mai in un errore propagato al chiamante: il livello deterministico non deve mai peggiorare
 * per colpa di questo.
 */
export function createOllamaSuggester(baseUrl: string, model: string): CategorySuggester {
  return {
    async suggest(input: SuggestInput[], categories: Category[]): Promise<LlmSuggestion[]> {
      if (input.length === 0) return [];

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt: buildPrompt(input, categories),
            stream: false,
            format: "json",
          }),
          signal: controller.signal,
        });
        if (!response.ok) return [];

        const body = (await response.json()) as { response?: string };
        if (!body.response) return [];

        const parsed = llmResponseSchema.safeParse(JSON.parse(body.response));
        if (!parsed.success) return [];

        const validNames = new Set(
          categories.filter((category) => !category.isFallback).map((category) => category.name)
        );
        const validIndexes = new Set(input.map((item) => item.index));
        return parsed.data.filter(
          (suggestion) => validNames.has(suggestion.categoryName) && validIndexes.has(suggestion.index)
        );
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
