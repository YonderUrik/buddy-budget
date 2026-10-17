import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "./llms";
import { ITALY } from "./home";
import { PAGE_PAIRS } from "./locales";
import { FAQ, SITE_URL } from "./site";

describe("llms.txt", () => {
  const txt = buildLlmsTxt();

  it("segue il formato llmstxt.org: titolo H1 e riassunto in citazione", () => {
    expect(txt.startsWith("# BuddyBudget\n\n> ")).toBe(true);
  });

  it("riporta tutte le domande frequenti e tutte le regole italiane della pagina", () => {
    for (const q of FAQ) expect(txt).toContain(q.question);
    for (const r of ITALY.rules) expect(txt).toContain(r.rule);
  });

  it("has an English section that links every English page", () => {
    expect(txt).toContain("## In English");
    for (const p of PAGE_PAIRS) expect(txt).toContain(`${SITE_URL}${p.en}`);
  });

  it("non contiene link relativi", () => {
    expect(txt).not.toMatch(/\]\(\//);
  });
});
