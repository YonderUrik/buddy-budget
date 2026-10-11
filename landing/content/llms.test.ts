import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "./llms";
import { ITALY } from "./home";
import { FAQ } from "./site";

describe("llms.txt", () => {
  const txt = buildLlmsTxt();

  it("segue il formato llmstxt.org: titolo H1 e riassunto in citazione", () => {
    expect(txt.startsWith("# BuddyBudget\n\n> ")).toBe(true);
  });

  it("riporta tutte le domande frequenti e tutte le regole italiane della pagina", () => {
    for (const q of FAQ) expect(txt).toContain(q.question);
    for (const r of ITALY.rules) expect(txt).toContain(r.rule);
  });

  it("non contiene link relativi", () => {
    expect(txt).not.toMatch(/\]\(\//);
  });
});
