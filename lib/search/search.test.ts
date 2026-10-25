import { describe, expect, it } from "vitest";
import { foldText, matchRanges, matchScore, parseAmountQuery } from "./normalize";
import { searchStatic, staticEntriesOf } from "./static-index";

const same = (key: string) => key;

describe("matching", () => {
  it("ignores case, accents and extra spaces", () => {
    expect(foldText("  Liquidità   Più ")).toBe("liquidita piu");
    expect(matchScore("Liquidità", "liquidita")).toBe(3);
  });

  it("ranks a start over a word over the inside of a word, and needs every word", () => {
    expect(matchScore("Netflix Italia", "net")).toBe(3);
    expect(matchScore("Pagamento Netflix", "net")).toBe(2);
    expect(matchScore("Planetflix", "net")).toBe(1);
    expect(matchScore("Pagamento Netflix", "netflix pag")).toBe(2);
    expect(matchScore("Pagamento Netflix", "netflix spotify")).toBe(0);
  });

  it("highlights the matched words in the original text", () => {
    expect(matchRanges("Caffè Bar", "bar caffe")).toEqual([[0, 5], [6, 9]]);
  });

  it("reads an amount the way people type it", () => {
    expect(parseAmountQuery("45,90")).toBe(45.9);
    expect(parseAmountQuery("45.9 €")).toBe(45.9);
    expect(parseAmountQuery("1.200")).toBe(1200);
    expect(parseAmountQuery("1.200,50")).toBe(1200.5);
    expect(parseAmountQuery("-13,99")).toBe(13.99);
    expect(parseAmountQuery("2024")).toBe(2024);
    expect(parseAmountQuery("netflix")).toBeNull();
    expect(parseAmountQuery("0")).toBeNull();
  });
});

describe("static index", () => {
  it("finds pages and settings by title or by another word people type", () => {
    expect(searchStatic("budget", "IT", same)[0]).toMatchObject({ key: "pagine:budget", href: "/liquidita/budget" });
    expect(searchStatic("dark", "IT", same).map((h) => h.key)).toContain("pagine:tema");
    expect(searchStatic("chiedi all'ai", "IT", same).map((h) => h.key)).toContain("pagine:ai");
  });

  it("matches the translated title too", () => {
    const english = (key: string) => (key === "Budget del mese" ? "Monthly budget" : key);
    expect(searchStatic("monthly", "IT", english)[0]).toMatchObject({ key: "pagine:budget", title: "Monthly budget" });
  });

  it("leaves out pages the country does not have", () => {
    expect(searchStatic("pensione", "IT", same).map((h) => h.key)).toContain("pagine:pensione");
    expect(searchStatic("pensione", "OTHER", same).map((h) => h.key)).not.toContain("pagine:pensione");
    expect(staticEntriesOf("azione", "IT", same).map((h) => h.quickAdd)).toContain("pensione");
    expect(staticEntriesOf("azione", "OTHER", same).map((h) => h.quickAdd)).not.toContain("pensione");
  });

  it("opens «Aggiungi» actions as forms, not as links", () => {
    const actions = staticEntriesOf("azione", "IT", same);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((h) => h.quickAdd && h.href === undefined)).toBe(true);
  });
});
