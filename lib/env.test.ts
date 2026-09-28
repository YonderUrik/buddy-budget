import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppUrl, parseServerEnv } from "./env";

const VALID_ENV = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  RESEND_API_KEY: "re_key",
  RESEND_FROM: "noreply@example.com",
  GOCARDLESS_SECRET_ID: "gc-id",
  GOCARDLESS_SECRET_KEY: "gc-key",
  CRON_SECRET: "c".repeat(32),
};

describe("parseServerEnv", () => {
  it("accetta un env completo e ignora le variabili estranee", () => {
    const env = parseServerEnv({ ...VALID_ENV, PATH: "/usr/bin" });
    expect(env.APP_URL).toBe("http://localhost:3000");
  });

  it("accetta le variabili OLLAMA assenti o vuote (livello assistente spento)", () => {
    expect(() => parseServerEnv(VALID_ENV)).not.toThrow();
    expect(() => parseServerEnv({ ...VALID_ENV, OLLAMA_BASE_URL: "" })).not.toThrow();
  });

  it("accetta LOG_LEVEL e METRICS_TOKEN assenti, rifiuta valori non validi", () => {
    expect(() => parseServerEnv(VALID_ENV)).not.toThrow();
    expect(() => parseServerEnv({ ...VALID_ENV, LOG_LEVEL: "debug", METRICS_TOKEN: "m".repeat(32) })).not.toThrow();
    expect(() => parseServerEnv({ ...VALID_ENV, METRICS_TOKEN: "corto" })).toThrow("METRICS_TOKEN");
    expect(() => parseServerEnv({ ...VALID_ENV, LOG_LEVEL: "verbose" })).toThrow("LOG_LEVEL");
  });

  it("si avvia senza chiavi delle fonti prezzi e le accetta se presenti", () => {
    expect(() => parseServerEnv(VALID_ENV)).not.toThrow();
    const env = parseServerEnv({ ...VALID_ENV, ALPHAVANTAGE_API_KEY: "av", STOOQ_API_KEY: "st" });
    expect(env.ALPHAVANTAGE_API_KEY).toBe("av");
  });

  it("elenca in ordine alfabetico tutte le variabili mancanti", () => {
    const { APP_URL: _a, REDIS_URL: _r, ...rest } = VALID_ENV;
    expect(() => parseServerEnv(rest)).toThrow("Variabili d'ambiente mancanti o non valide: APP_URL, REDIS_URL");
  });

  it("rifiuta CRON_SECRET e BETTER_AUTH_SECRET più corti di 32 caratteri", () => {
    expect(() => parseServerEnv({ ...VALID_ENV, CRON_SECRET: "corto" })).toThrow("CRON_SECRET");
    expect(() => parseServerEnv({ ...VALID_ENV, BETTER_AUTH_SECRET: "corto" })).toThrow("BETTER_AUTH_SECRET");
  });

  it("rifiuta APP_URL che non è un URL", () => {
    expect(() => parseServerEnv({ ...VALID_ENV, APP_URL: "buddybudget" })).toThrow("APP_URL");
  });

  it("rifiuta APP_URL senza schema http/https (es. dimenticato per errore)", () => {
    // z.url() da solo accetta "localhost:3000" (schema "localhost:") o "ftp://x": un refuso plausibile
    // che romperebbe in silenzio i redirect GoCardless se passasse la validazione.
    expect(() => parseServerEnv({ ...VALID_ENV, APP_URL: "localhost:3000" })).toThrow("APP_URL");
    expect(() => parseServerEnv({ ...VALID_ENV, APP_URL: "ftp://buddybudget.example" })).toThrow("APP_URL");
  });

  it("non espone mai i valori nel messaggio d'errore", () => {
    const leaked = "segreto-che-non-deve-comparire";
    try {
      parseServerEnv({ ...VALID_ENV, CRON_SECRET: leaked });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(leaked);
    }
  });
});

describe("getAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("restituisce APP_URL senza slash finali", () => {
    vi.stubEnv("APP_URL", "https://buddybudget.example//");
    expect(getAppUrl()).toBe("https://buddybudget.example");
  });

  it("lancia se APP_URL manca", () => {
    vi.stubEnv("APP_URL", "");
    expect(() => getAppUrl()).toThrow("APP_URL");
  });
});
