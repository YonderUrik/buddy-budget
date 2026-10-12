import { describe, expect, it } from "vitest";
import { buildClientErrorReport, clientErrorArea, clientErrorSchema, CLIENT_ERROR_MESSAGE_MAX } from "./index";

describe("clientErrorArea", () => {
  it("prende solo il primo segmento noto, mai il resto del percorso", () => {
    expect(clientErrorArea("/investimenti/titoli/3f2a9c1e")).toBe("investimenti");
    expect(clientErrorArea("/liquidita")).toBe("liquidita");
  });

  it("restituisce altro per percorsi sconosciuti o vuoti", () => {
    expect(clientErrorArea("/")).toBe("altro");
    expect(clientErrorArea("/qualcosa-di-nuovo/1")).toBe("altro");
  });
});

describe("buildClientErrorReport", () => {
  it("accorcia il messaggio e passa lo schema del server", () => {
    const error = Object.assign(new TypeError("x".repeat(2000)), { digest: "123" });
    const report = buildClientErrorReport(error, "sezione", "/debiti/abc");
    expect(report).toMatchObject({ kind: "sezione", area: "debiti", name: "TypeError", digest: "123" });
    expect(report.message).toHaveLength(CLIENT_ERROR_MESSAGE_MAX);
    expect(clientErrorSchema.safeParse(report).success).toBe(true);
  });

  it("mette un messaggio di ripiego se l'errore non ne ha", () => {
    expect(buildClientErrorReport(new Error(""), "globale", "/").message).toBe("Errore senza messaggio");
  });
});

describe("clientErrorSchema", () => {
  it("rifiuta aree fuori dall'elenco", () => {
    expect(clientErrorSchema.safeParse({ kind: "sezione", area: "/conti/123", message: "x" }).success).toBe(false);
  });
});
