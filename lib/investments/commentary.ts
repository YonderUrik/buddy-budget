/**
 * Commento opzionale sul titolo scritto da un modello locale (Ollama), Fase 6. Il modello riceve solo dati pubblici
 * dello strumento (nome, tipo, statistiche di prezzo, numeri chiave): mai quantità, importi o altro dell'utente. Senza
 * `OLLAMA_BASE_URL` il commento semplicemente non c'è. Qualunque problema (connessione, timeout, risposta vuota)
 * diventa `null`, mai un errore.
 */

import type { InstrumentType } from "@/lib/db/schema/investments";
import type { TitleFundamentals } from "@/lib/market-data/fundamentals";
import type { TitleStats } from "./title-stats";

const TIMEOUT_MS = 45_000;
/** Lunghezza massima del commento mostrato. */
export const COMMENTARY_MAX_CHARS = 1500;
/** Un commento vale mezza giornata: i dati sotto cambiano al più una volta al giorno. */
export const COMMENTARY_CACHE_TTL_SECONDS = 12 * 60 * 60;

export interface CommentaryInput {
  name: string;
  type: InstrumentType;
  currency: string;
  stats: TitleStats;
  fundamentals: TitleFundamentals | null;
}

const TYPE_LABELS: Record<InstrumentType, string> = {
  etf: "ETF",
  azione: "azione",
  obbligazione: "obbligazione",
  fondo: "fondo",
  crypto: "criptovaluta",
  etc: "ETC",
};

function pct(value: number | null | undefined, digits = 1): string | null {
  return value === null || value === undefined ? null : `${(value * 100).toFixed(digits)}%`;
}

/** Elenco "etichetta: valore" delle sole voci disponibili. */
function lines(entries: [string, string | null][]): string[] {
  return entries.filter((e): e is [string, string] => e[1] !== null).map(([k, v]) => `- ${k}: ${v}`);
}

/** Prompt in un solo blocco con i dati del titolo e le regole di tono. Puro, per poterlo testare. */
export function buildCommentaryPrompt(input: CommentaryInput): string {
  const { stats, fundamentals: f } = input;
  const num = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? null : v.toFixed(digits));
  const data = lines([
    ["Ultima chiusura", `${stats.lastClose.toFixed(2)} ${input.currency} (${stats.lastDate})`],
    ["Variazione ultimo giorno", pct(stats.dayChange, 2)],
    ["Ultimo mese", pct(stats.returns["1M"])],
    ["Ultimi 3 mesi", pct(stats.returns["3M"])],
    ["Ultimi 6 mesi", pct(stats.returns["6M"])],
    ["Ultimo anno", pct(stats.returns["1A"])],
    ["Da inizio anno", pct(stats.returns.YTD)],
    ["Distanza dal massimo a 52 settimane", pct(stats.fromHigh)],
    ["Volatilità annua", pct(stats.volatility)],
    ["Caduta massima nell'ultimo anno", pct(stats.maxDrawdown)],
    ["P/E", num(f?.trailingPE, 1)],
    ["P/E atteso", num(f?.forwardPE, 1)],
    ["Rendimento da dividendo", pct(f?.dividendYield, 2)],
    ["Margine di profitto", pct(f?.profitMargin)],
    ["Crescita dei ricavi", pct(f?.revenueGrowth)],
    ["Costo annuo (TER)", pct(f?.expenseRatio, 2)],
  ]);
  return [
    `Scrivi in italiano un breve commento (al massimo 6 frasi) su questo strumento: ${input.name} (${TYPE_LABELS[input.type]}).`,
    "Usa solo i dati sotto. Descrivi com'è andato di recente, quanto è stato volatile e, se ci sono, cosa dicono i numeri chiave.",
    "Tono neutro e prudente. Non dare consigli di acquisto o vendita, non fare previsioni, non inventare dati mancanti.",
    "Ricorda che il passato non garantisce i risultati futuri, ma dillo una volta sola e in breve.",
    "",
    "Dati:",
    ...data,
  ].join("\n");
}

/** Generatore di commenti basato su un'istanza Ollama raggiungibile via HTTP. */
export interface Commentator {
  comment(prompt: string): Promise<string | null>;
}

export function createOllamaCommentator(baseUrl: string, model: string): Commentator {
  return {
    async comment(prompt) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt, stream: false }),
          signal: controller.signal,
        });
        if (!response.ok) return null;
        const body = (await response.json()) as { response?: string };
        const text = body.response?.trim();
        return text ? text.slice(0, COMMENTARY_MAX_CHARS) : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

/** Generatore configurato dall'ambiente, o null se `OLLAMA_BASE_URL` non c'è (stato normale, non un guasto). */
export function commentatorFromEnv(env: Record<string, string | undefined> = process.env): Commentator | null {
  const baseUrl = env.OLLAMA_BASE_URL?.trim();
  if (!baseUrl) return null;
  return createOllamaCommentator(baseUrl, env.OLLAMA_MODEL?.trim() || "llama3.2");
}
