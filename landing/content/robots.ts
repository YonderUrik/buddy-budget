import { SITE_URL } from "@/content/site";

/**
 * Crawler degli assistenti AI, ammessi per nome: vogliamo che ChatGPT, Claude, Perplexity, Gemini e Apple Intelligence
 * possano leggere e citare il sito (vedi anche `/llms.txt`). Elencarli rende la scelta esplicita se un giorno cambierà.
 */
export const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "CCBot",
] as const;

/**
 * Preferenze d'uso dei contenuti (contentsignals.org), dichiarate per tutti i crawler. Il sito è pubblico e il progetto
 * open source (AGPL): ricerca, risposte degli assistenti e addestramento sono tutti ammessi, in linea con i crawler
 * elencati sopra. Per vietare l'addestramento basta `ai-train=no` (e togliere dall'elenco i crawler di solo training).
 */
export const CONTENT_SIGNALS = { "ai-train": "yes", search: "yes", "ai-input": "yes" } as const;

/** Testo di `/robots.txt`. Next non sa emettere `Content-Signal` da `robots.ts`, per questo è scritto a mano. */
export function buildRobotsTxt(): string {
  const signal = Object.entries(CONTENT_SIGNALS).map(([k, v]) => `${k}=${v}`).join(", ");
  return [
    "User-agent: *",
    `Content-Signal: ${signal}`,
    "Allow: /",
    "",
    // Un gruppo con User-agent propri non eredita le righe di `*`: il segnale va ripetuto.
    ...AI_CRAWLERS.map((ua) => `User-agent: ${ua}`),
    `Content-Signal: ${signal}`,
    "Allow: /",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}
