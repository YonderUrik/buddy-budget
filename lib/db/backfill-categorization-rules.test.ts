import { describe, expect, it } from "vitest";
import { buildRulesFromHistory } from "./backfill-categorization-rules";

function makeTx(description: string, categoryId: string, date: string, amount = "-10.00", excludedAmount = "0.00") {
  return { description, categoryId, date, amount, excludedAmount };
}

describe("buildRulesFromHistory", () => {
  it("crea una regola per chiave merchant con la categoria più frequente", () => {
    const rules = buildRulesFromHistory([
      makeTx("ESSELUNGA VIA ROMA", "cat-spesa", "2026-01-01"),
      makeTx("PAGAMENTO POS ESSELUNGA VIA ROMA 998", "cat-spesa", "2026-02-01"),
      makeTx("ESSELUNGA VIA ROMA", "cat-altro", "2026-03-01"),
    ]);
    expect(rules).toEqual([{ pattern: "esselunga via roma", categoryId: "cat-spesa", splitPercentage: null }]);
  });

  it("a parità di frequenza sceglie la categoria della transazione più recente", () => {
    const rules = buildRulesFromHistory([
      makeTx("NETFLIX", "cat-vecchia", "2026-01-01"),
      makeTx("NETFLIX", "cat-recente", "2026-06-01"),
    ]);
    expect(rules[0].categoryId).toBe("cat-recente");
  });

  it("propone lo split solo quando tutte le transazioni della categoria vincente hanno la stessa quota", () => {
    const coerenti = buildRulesFromHistory([
      makeTx("AFFITTO", "cat-casa", "2026-01-01", "-100.00", "-50.00"),
      makeTx("AFFITTO", "cat-casa", "2026-02-01", "-200.00", "-100.00"),
    ]);
    expect(coerenti[0].splitPercentage).toBe(0.5);

    const incoerenti = buildRulesFromHistory([
      makeTx("AFFITTO", "cat-casa", "2026-01-01", "-100.00", "-50.00"),
      makeTx("AFFITTO", "cat-casa", "2026-02-01", "-100.00", "-10.00"),
    ]);
    expect(incoerenti[0].splitPercentage).toBeNull();
  });

  it("ignora le transazioni con chiave merchant vuota", () => {
    expect(buildRulesFromHistory([makeTx("   ", "cat-spesa", "2026-01-01")])).toEqual([]);
  });

  it("ritorna un array vuoto senza transazioni", () => {
    expect(buildRulesFromHistory([])).toEqual([]);
  });
});
