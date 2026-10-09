import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/site";

export const dynamic = "force-static";

/**
 * Crawler degli assistenti AI, ammessi per nome: vogliamo che ChatGPT, Claude, Perplexity, Gemini e Apple Intelligence
 * possano leggere e citare il sito (vedi anche `/llms.txt`). Elencarli rende la scelta esplicita se un giorno cambierà.
 */
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "CCBot",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: [...AI_CRAWLERS], allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
