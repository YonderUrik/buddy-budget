import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMetricsRegistry, resetMetricsForTests } from "@/lib/observability";
import {
  EnableBankingError,
  buildJwt,
  deleteSession,
  getAccountTransactions,
  isEnableBankingConfigured,
  parsePrivateKey,
  resetJwtCacheForTests,
  startAuthorization,
} from "./client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("JWT e chiave", () => {
  it("firma un JWT RS256 con kid, issuer e audience di Enable Banking", () => {
    const token = buildJwt("app-123", privateKey, 1_000, 3600);
    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ typ: "JWT", alg: "RS256", kid: "app-123" });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      iss: "enablebanking.com",
      aud: "api.enablebanking.com",
      iat: 1_000,
      exp: 4_600,
    });
    expect(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });

  it("legge la chiave in PEM, con \\n letterali o in base64", () => {
    expect(parsePrivateKey(PEM).asymmetricKeyType).toBe("rsa");
    expect(parsePrivateKey(PEM.replace(/\n/g, "\\n")).asymmetricKeyType).toBe("rsa");
    expect(parsePrivateKey(Buffer.from(PEM).toString("base64")).asymmetricKeyType).toBe("rsa");
  });

  it("è configurato solo con id e chiave", () => {
    expect(isEnableBankingConfigured({ ENABLE_BANKING_APP_ID: "a", ENABLE_BANKING_PRIVATE_KEY: "k" })).toBe(true);
    expect(isEnableBankingConfigured({ ENABLE_BANKING_APP_ID: "a" })).toBe(false);
    expect(isEnableBankingConfigured({})).toBe(false);
  });
});

describe("chiamate all'API", () => {
  beforeEach(() => {
    vi.stubEnv("ENABLE_BANKING_APP_ID", "app-123");
    vi.stubEnv("ENABLE_BANKING_PRIVATE_KEY", PEM);
    vi.stubGlobal("fetch", vi.fn());
    resetJwtCacheForTests();
    resetMetricsForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("avvia l'autorizzazione con banca, scadenza, state e URL di ritorno", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ url: "https://bank.example/auth", authorization_id: "auth-1" }));
    const validUntil = new Date("2027-04-01T00:00:00Z");

    const result = await startAuthorization({
      aspsp: { name: "Banca Test", country: "IT" },
      validUntil,
      redirectUrl: "https://app.example.com/api/bank/callback",
      state: "conn-1",
      language: "it",
    });

    expect(result.url).toBe("https://bank.example/auth");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.enablebanking.com/auth");
    expect((init?.headers as Record<string, string>).Authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    expect(JSON.parse(String(init?.body))).toEqual({
      access: { valid_until: "2027-04-01T00:00:00.000Z" },
      aspsp: { name: "Banca Test", country: "IT" },
      state: "conn-1",
      redirect_url: "https://app.example.com/api/bank/callback",
      psu_type: "personal",
      language: "it",
    });
  });

  it("legge tutte le pagine dei movimenti, con lo storico più lungo al primo import", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ transactions: [{ entry_reference: "a" }], continuation_key: "k2" }))
      .mockResolvedValueOnce(json({ transactions: [{ entry_reference: "b" }], continuation_key: null }));

    const all = await getAccountTransactions("uid-1", null);

    expect(all.map((t) => t.entry_reference)).toEqual(["a", "b"]);
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls[0]).toBe("https://api.enablebanking.com/accounts/uid-1/transactions?transaction_status=BOOK&strategy=longest");
    expect(urls[1]).toContain("continuation_key=k2");
  });

  it("chiede i movimenti da una data quando la conosce", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ transactions: [] }));
    await getAccountTransactions("uid-1", "2026-09-10");
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "https://api.enablebanking.com/accounts/uid-1/transactions?transaction_status=BOOK&date_from=2026-09-10"
    );
  });

  it("un errore porta solo endpoint, status e codice (mai il body), e conta la chiamata", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ error: "EXPIRED_SESSION", message: "IBAN IT60X0542811101000000123456" }, 401));

    const error = await getAccountTransactions("uid-1", null).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EnableBankingError);
    expect((error as EnableBankingError).reason).toBe("expired");
    expect((error as Error).message).toBe("Enable Banking accounts.transactions ha risposto 401 (EXPIRED_SESSION)");
    const text = await getMetricsRegistry().metrics();
    expect(text).toContain('buddybudget_bank_api_requests_total{provider="enablebanking",endpoint="accounts.transactions",status_class="4xx"} 1');
  });

  it("«troppe richieste» della banca diventa rate_limited", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ error: "ASPSP_RATE_LIMIT_EXCEEDED" }, 429));
    const error = await getAccountTransactions("uid-1", null).catch((e: unknown) => e);
    expect((error as EnableBankingError).reason).toBe("rate_limited");
  });

  it("chiudere una sessione già chiusa o sparita non è un errore", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ error: "CLOSED_SESSION" }, 400)).mockResolvedValueOnce(json({}, 404));
    await expect(deleteSession("11111111-2222-3333-4444-555555555555")).resolves.toBeUndefined();
    await expect(deleteSession("11111111-2222-3333-4444-555555555555")).resolves.toBeUndefined();
  });

  it("rifiuta id che potrebbero cambiare il path", async () => {
    await expect(getAccountTransactions("../sessions", null)).rejects.toThrow("segmento di path");
    expect(fetch).not.toHaveBeenCalled();
  });
});
