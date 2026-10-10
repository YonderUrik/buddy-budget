import { describe, expect, it } from "vitest";
import { githubIssueUrl, newReportReference, reportEmailContent, reportInputSchema, sanitizePath } from "./index";

const context = { path: "/liquidita", version: "0.38.1", viewport: "390x844", theme: "scuro" as const };

describe("sanitizePath", () => {
  it("toglie query e hash e rifiuta percorsi non relativi", () => {
    expect(sanitizePath("/investimenti/abc?x=1#y")).toBe("/investimenti/abc");
    expect(sanitizePath("https://evil.example")).toBe("/");
  });
});

describe("reportInputSchema", () => {
  it("accetta una segnalazione valida e rifiuta messaggi troppo corti o tipi ignoti", () => {
    expect(reportInputSchema.safeParse({ kind: "problema", message: "Non vedo i movimenti di ieri", context }).success).toBe(true);
    expect(reportInputSchema.safeParse({ kind: "problema", message: "ciao" }).success).toBe(false);
    expect(reportInputSchema.safeParse({ kind: "altro", message: "Un messaggio abbastanza lungo" }).success).toBe(false);
  });
});

describe("newReportReference", () => {
  it("ha il formato SUP-XXXXXX", () => {
    expect(newReportReference()).toMatch(/^SUP-[2-9A-HJ-NP-Z]{6}$/);
  });
});

describe("reportEmailContent", () => {
  it("include contesto e reply-to nel testo, o dice che manca", () => {
    const base = { reference: "SUP-ABC234", userEmail: "a@b.it", userAgent: "UA/1" };
    const withCtx = reportEmailContent({ ...base, input: { kind: "idea", message: "Vorrei un export in PDF", context } });
    expect(withCtx.subject).toContain("[SUP-ABC234] idea");
    expect(withCtx.text).toContain("Pagina: /liquidita");
    expect(withCtx.text).toContain("Browser: UA/1");
    const without = reportEmailContent({ ...base, input: { kind: "idea", message: "Vorrei un export in PDF" } });
    expect(without.text).toContain("non allegato");
  });
});

describe("githubIssueUrl", () => {
  it("usa il template giusto e precompila l'ambiente solo per i problemi", () => {
    const bug = new URL(githubIssueUrl("problema", context));
    expect(bug.searchParams.get("template")).toBe("bug.yml");
    expect(bug.searchParams.get("ambiente")).toContain("0.38.1");
    expect(githubIssueUrl("idea", context)).toContain("template=funzionalita.yml");
  });
});
