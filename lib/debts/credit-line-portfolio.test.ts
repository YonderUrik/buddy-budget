import { describe, expect, it } from "vitest";
import { buildCreditLinePortfolioView } from "./credit-line-portfolio";

describe("buildCreditLinePortfolioView", () => {
  it("calcola il rapporto e l'effetto dei cali", () => {
    const view = buildCreditLinePortfolioView(20000, 100000);
    expect(view.ratio).toBeCloseTo(0.2);
    expect(view.drops[0].ratio).toBeCloseTo(20000 / 90000);
    expect(view.drops[2].ratio).toBeCloseTo(20000 / 70000);
    expect(view.breakEvenDrop).toBeCloseTo(0.8);
  });
  it("senza portafoglio non dice nulla", () => {
    expect(buildCreditLinePortfolioView(1000, 0)).toEqual({ ratio: null, drops: [], breakEvenDrop: null });
  });
  it("senza utilizzo non c'è un punto di pareggio", () => {
    expect(buildCreditLinePortfolioView(0, 5000).breakEvenDrop).toBeNull();
  });
});
