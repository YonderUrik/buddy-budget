import { z } from "zod";

/** Lunghezza minima del segreto condiviso con chi chiama gli endpoint cron. */
export const CRON_SECRET_MIN_LENGTH = 32;

/**
 * Variabili d'ambiente richieste dal server. OLLAMA_* sono opzionali: se assenti il livello
 * assistente della categorizzazione è semplicemente spento (stato normale, non un guasto).
 */
export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  // Solo http/https: z.url() da solo accetterebbe "localhost:3000" (schema "localhost:") o "ftp://x",
  // refusi plausibili che romperebbero in silenzio i redirect (GoCardless, magic link).
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  APP_URL: z.url({ protocol: /^https?$/ }),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM: z.string().min(1),
  GOCARDLESS_SECRET_ID: z.string().min(1),
  GOCARDLESS_SECRET_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(CRON_SECRET_MIN_LENGTH),
  OLLAMA_BASE_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Valida l'env del server. In caso di errore lancia elencando solo i NOMI delle variabili
 * mancanti o non valide (mai i valori, che possono essere segreti e finire nei log).
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))].sort();
  throw new Error(`Variabili d'ambiente mancanti o non valide: ${names.join(", ")}`);
}

/** URL pubblico dell'app letto a runtime (non inlined in build), senza slash finali. */
export function getAppUrl(): string {
  const value = process.env.APP_URL;
  if (!value) {
    throw new Error("APP_URL non è definita.");
  }
  return value.replace(/\/+$/, "");
}
