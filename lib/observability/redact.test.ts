import { describe, expect, it } from "vitest";
import { MAX_ERROR_MESSAGE_LENGTH, redactText } from "./redact";

describe("redactText", () => {
  it("oscura email", () => {
    expect(redactText("invio a mario.rossi@example.com fallito")).toBe("invio a [email] fallito");
  });

  it("oscura IBAN", () => {
    expect(redactText("conto IT60X0542811101000000123456 non trovato")).toBe("conto [iban] non trovato");
  });

  it("oscura bearer token e parametri segreti in URL", () => {
    expect(redactText("Authorization: Bearer abc.def-123")).toBe("Authorization: Bearer [redacted]");
    expect(redactText("GET /cb?code=xyz&state=1&token=t0k")).toBe("GET /cb?code=[redacted]&state=1&token=[redacted]");
  });

  it("oscura UUID", () => {
    expect(redactText("/accounts/3f2b8c1e-9a4d-4e5f-8a1b-2c3d4e5f6a7b/transactions/")).toBe("/accounts/[id]/transactions/");
  });

  it("toglie i parametri di una query fallita (DrizzleQueryError)", () => {
    const message = 'Failed query: insert into "transactions" ("description") values ($1)\nparams: Cena da Mario,42.50';
    expect(redactText(message)).toBe('Failed query: insert into "transactions" ("description") values ($1)\nparams: [redacted]');
  });

  it("tronca i testi troppo lunghi", () => {
    const out = redactText("x".repeat(MAX_ERROR_MESSAGE_LENGTH + 50));
    expect(out).toHaveLength(MAX_ERROR_MESSAGE_LENGTH + 1);
    expect(out.endsWith("…")).toBe(true);
  });

  it("lascia invariato un testo innocuo", () => {
    expect(redactText("connessione rifiutata (ECONNREFUSED)")).toBe("connessione rifiutata (ECONNREFUSED)");
  });
});
