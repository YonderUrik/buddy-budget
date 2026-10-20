import { z } from "zod";

/** Lunghezza minima del segreto condiviso con chi chiama gli endpoint cron. */
export const CRON_SECRET_MIN_LENGTH = 32;

/** Stringa non vuota facoltativa: `""` (variabile dichiarata ma vuota, tipico di docker compose) vale come assente. */
const optionalSecret = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());

/** Optional true/false switch (also 1/0, yes/no); `""` counts as unset. */
const optionalFlag = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().regex(/^(true|false|1|0|yes|no)$/i, "true or false").optional(),
);

/**
 * Variabili d'ambiente richieste dal server. OLLAMA_*, LOG_LEVEL, METRICS_TOKEN e le chiavi delle fonti prezzi sono opzionali: se assenti il livello
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
  // Integrazioni esterne (opzionali, per il self-hosting): senza Google il pulsante non funziona, senza Resend il
  // magic link finisce nei log del server (vedi lib/auth/magic-link-log.ts) e le altre email non partono, senza
  // GoCardless non si collegano banche (restano conti manuali e import CSV).
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  RESEND_FROM: optionalSecret,
  // Email via any SMTP server (self-hosting), e.g. smtps://user:password@smtp.example.com:465; EMAIL_FROM is the sender.
  SMTP_URL: z.preprocess((value) => (value === "" ? undefined : value), z.url({ protocol: /^smtps?$/ }).optional()),
  EMAIL_FROM: optionalSecret,
  // Self-hosting switches (lib/instance/config.ts): true/false, empty = the default.
  SELF_HOSTED: optionalFlag,
  AUTH_PASSWORD: optionalFlag,
  ALLOW_SIGNUPS: optionalFlag,
  GOCARDLESS_SECRET_ID: optionalSecret,
  GOCARDLESS_SECRET_KEY: optionalSecret,
  // New bank connections (lib/gocardless/capacity.ts): empty = closed when hosted, open when self-hosted.
  BANK_CONNECTIONS_OPEN: optionalFlag,
  CRON_SECRET: z.string().min(CRON_SECRET_MIN_LENGTH),
  OLLAMA_BASE_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),
  // Osservabilità (opzionali): senza METRICS_TOKEN /api/metrics risponde 404 (es. su Vercel).
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  METRICS_TOKEN: z.string().min(CRON_SECRET_MIN_LENGTH).optional(),
  // Fonti prezzi (opzionali): senza chiave la fonte è spenta e la catena passa alla successiva.
  ALPHAVANTAGE_API_KEY: z.string().optional(),
  STOOQ_API_KEY: z.string().optional(),
  TWELVEDATA_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  /** Chiave pubblica (`pk_…`) di Logo.dev per i loghi degli strumenti; assente = solo icone locali. */
  LOGODEV_PUBLISHABLE_KEY: z.string().optional(),
  OPENFIGI_API_KEY: z.string().optional(),
  // Billing (lib/billing/config.ts): `off` (default, everyone has everything), `pilot` (Free/Pro only for the emails in
  // BILLING_PILOT_EMAILS) or `on`. Never active on a self-hosted install. Without the Stripe keys it stays off.
  BILLING_MODE: z.preprocess((value) => (value === "" ? undefined : value), z.enum(["off", "pilot", "on"]).optional()),
  BILLING_PILOT_EMAILS: optionalSecret,
  STRIPE_SECRET_KEY: optionalSecret,
  STRIPE_WEBHOOK_SECRET: optionalSecret,
  STRIPE_PRICE_MONTHLY: optionalSecret,
  STRIPE_PRICE_YEARLY: optionalSecret,
  STRIPE_PORTAL_CONFIGURATION: optionalSecret,
  // Chiave dei campi cifrati nel database (32 byte in base64, vedi lib/crypto/field-encryption.ts). Facoltativa: senza,
  // i campi si scrivono in chiaro come prima. Una volta usata non va più tolta né cambiata, o i dati cifrati non si rileggono.
  DATA_ENCRYPTION_KEY: optionalSecret.refine((value) => value === undefined || Buffer.from(value, "base64").length === 32, "32 byte in base64"),
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
