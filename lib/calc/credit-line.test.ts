import { describe, expect, it } from "vitest";
import { balanceOn, buildCreditLinePlan, dayCountBase, isOverAlertThreshold, periodEndFor, type CreditLineTerms } from "./credit-line";

const terms = (overrides: Partial<CreditLineTerms> = {}): CreditLineTerms => ({
  openDate: "2026-01-01",
  creditLimit: 50000,
  initialUsed: 10000,
  indexRate: 3,
  spread: 2,
  frequency: "monthly",
  dayCount: "365",
  capitalize: false,
  fees: [],
  ...overrides,
});

describe("periodEndFor", () => {
  it("restituisce la fine del mese o del trimestre", () => {
    expect(periodEndFor("2026-02-10", "monthly")).toBe("2026-02-28");
    expect(periodEndFor("2028-02-10", "monthly")).toBe("2028-02-29");
    expect(periodEndFor("2026-05-03", "quarterly")).toBe("2026-06-30");
    expect(periodEndFor("2026-12-31", "quarterly")).toBe("2026-12-31");
  });
});

describe("dayCountBase", () => {
  it("usa 360, 365 o i giorni effettivi dell'anno", () => {
    expect(dayCountBase("360", "2026-03-01")).toBe(360);
    expect(dayCountBase("365", "2028-03-01")).toBe(365);
    expect(dayCountBase("actual", "2028-03-01")).toBe(366);
    expect(dayCountBase("actual", "2026-03-01")).toBe(365);
  });
});

describe("buildCreditLinePlan", () => {
  it("matura gli interessi giorno per giorno sul saldo e li addebita a fine mese", () => {
    const plan = buildCreditLinePlan(terms(), [], "2026-01-31");
    // 10.000 € al 5% su 365 per 31 giorni
    expect(plan.charges).toHaveLength(1);
    expect(plan.charges[0]).toMatchObject({ periodStart: "2026-01-01", periodEnd: "2026-01-31", estimated: 42.47, charged: 42.47, actual: false });
    expect(plan.interestCharged).toBe(42.47);
    expect(plan.used).toBe(10000);
    expect(plan.currentRate).toBe(5);
    expect(plan.accruedSinceLastCharge).toBe(0);
    expect(plan.nextChargeDate).toBe("2026-02-28");
  });

  it("conta un utilizzo dal giorno in cui avviene", () => {
    const plan = buildCreditLinePlan(terms({ initialUsed: 0 }), [{ type: "draw", date: "2026-01-11", amount: 10000 }], "2026-01-31");
    // 21 giorni (dall'11 al 31 compresi)
    expect(plan.charges[0].estimated).toBe(28.77);
    expect(plan.used).toBe(10000);
  });

  it("un rimborso riduce il saldo dal giorno stesso e non va sotto zero", () => {
    const plan = buildCreditLinePlan(terms(), [{ type: "repay", date: "2026-01-16", amount: 99999 }], "2026-01-31");
    expect(plan.used).toBe(0);
    // 15 giorni a 10.000 €
    expect(plan.charges[0].estimated).toBe(20.55);
  });

  it("senza capitalizzazione il saldo non cresce con gli interessi, con la capitalizzazione sì", () => {
    const plain = buildCreditLinePlan(terms(), [], "2026-02-28");
    const capitalized = buildCreditLinePlan(terms({ capitalize: true }), [], "2026-02-28");
    expect(plain.used).toBe(10000);
    // addebito di gennaio (42,53) sommato dal 1° febbraio; quello di febbraio si somma a fine mese
    expect(capitalized.used).toBeCloseTo(10000 + 42.47 + capitalized.charges[1].charged, 2);
    expect(capitalized.charges[1].estimated).toBeGreaterThan(plain.charges[1].estimated);
  });

  it("l'addebito reale registrato prende il posto della stima", () => {
    const plan = buildCreditLinePlan(terms(), [{ type: "interest_charged", date: "2026-02-03", amount: 40 }], "2026-02-28");
    expect(plan.charges[0]).toMatchObject({ estimated: 42.47, charged: 40, actual: true, date: "2026-02-03" });
    expect(plan.charges[1].actual).toBe(false);
    expect(plan.interestCharged).toBeCloseTo(40 + plan.charges[1].estimated, 2);
  });

  it("l'addebito reale capitalizzato entra nel saldo", () => {
    const plan = buildCreditLinePlan(terms({ capitalize: true }), [{ type: "interest_charged", date: "2026-01-31", amount: 50 }], "2026-02-01");
    expect(plan.used).toBe(10050);
  });

  it("segue il cambio dell'indice dalla data indicata", () => {
    const plan = buildCreditLinePlan(terms(), [{ type: "rate_change", date: "2026-01-16", rate: 4 }], "2026-01-31");
    // 15 giorni al 5% e 16 al 6%
    expect(plan.charges[0].estimated).toBe(round2((10000 * 0.05 * 15) / 365 + (10000 * 0.06 * 16) / 365));
    expect(plan.currentRate).toBe(6);
    expect(plan.indexRate).toBe(4);
  });

  it("la correzione del saldo riallinea l'utilizzato", () => {
    const plan = buildCreditLinePlan(terms(), [{ type: "balance_correction", date: "2026-01-11", amount: 4000 }], "2026-01-20");
    expect(plan.used).toBe(4000);
  });

  it("usa la base 360 e i giorni effettivi", () => {
    const base360 = buildCreditLinePlan(terms({ dayCount: "360" }), [], "2026-01-31");
    expect(base360.charges[0].estimated).toBe(round2((10000 * 0.05 * 31) / 360));
    const leap = buildCreditLinePlan(terms({ openDate: "2028-01-01", dayCount: "actual" }), [], "2028-01-31");
    expect(leap.charges[0].estimated).toBe(round2((10000 * 0.05 * 31) / 366));
  });

  it("con addebito trimestrale chiude i periodi a marzo, giugno, settembre e dicembre", () => {
    const plan = buildCreditLinePlan(terms({ frequency: "quarterly" }), [], "2026-07-15");
    expect(plan.charges.map((c) => c.periodEnd)).toEqual(["2026-03-31", "2026-06-30"]);
    expect(plan.currentPeriodStart).toBe("2026-07-01");
    expect(plan.nextChargeDate).toBe("2026-09-30");
    expect(plan.accruedSinceLastCharge).toBeGreaterThan(0);
  });

  it("stima il periodo in corso e il costo a saldo attuale", () => {
    const plan = buildCreditLinePlan(terms(), [], "2026-01-10");
    expect(plan.accruedSinceLastCharge).toBe(round2((10000 * 0.05 * 10) / 365));
    expect(plan.projectedPeriodInterest).toBe(42.47);
    expect(plan.monthlyCostAtCurrent).toBe(41.67);
    expect(plan.yearlyCostAtCurrent).toBe(500);
    expect(plan.interestToDate).toBe(plan.accruedSinceLastCharge);
  });

  it("calcola commissioni, saldo medio e massimo", () => {
    const plan = buildCreditLinePlan(
      terms({ initialUsed: 0, fees: [{ label: "Apertura", amount: 100, kind: "una_tantum" }, { label: "Tenuta", amount: 5, kind: "per_rata" }] }),
      [
        { type: "draw", date: "2026-01-11", amount: 3000 },
        { type: "repay", date: "2026-01-21", amount: 1000 },
      ],
      "2026-01-31"
    );
    expect(plan.feesPaid).toBe(105);
    expect(plan.peakUsed).toBe(3000);
    expect(plan.averageUsed).toBe(round2((0 * 10 + 3000 * 10 + 2000 * 11) / 31));
    expect(plan.balanceSeries).toEqual([
      { date: "2026-01-01", balance: 0 },
      { date: "2026-01-11", balance: 3000 },
      { date: "2026-01-21", balance: 2000 },
    ]);
  });

  it("segnala lo sforamento del fido", () => {
    const plan = buildCreditLinePlan(terms({ creditLimit: 9000 }), [], "2026-01-02");
    expect(plan.overLimit).toBe(true);
    expect(plan.available).toBe(-1000);
  });

  it("ignora gli eventi dopo oggi e funziona anche prima dell'apertura", () => {
    const future = buildCreditLinePlan(terms(), [{ type: "draw", date: "2026-03-01", amount: 5000 }], "2026-01-31");
    expect(future.used).toBe(10000);
    const before = buildCreditLinePlan(terms(), [], "2025-12-01");
    expect(before.used).toBe(10000);
    expect(before.charges).toEqual([]);
  });
});

describe("balanceOn", () => {
  it("legge l'ultimo scalino noto alla data", () => {
    const series = [
      { date: "2026-01-01", balance: 0 },
      { date: "2026-01-11", balance: 3000 },
    ];
    expect(balanceOn(series, "2026-01-10")).toBe(0);
    expect(balanceOn(series, "2026-01-11")).toBe(3000);
    expect(balanceOn(series, "2026-06-01")).toBe(3000);
  });
});

describe("isOverAlertThreshold", () => {
  it("confronta con la percentuale del fido o con l'importo", () => {
    expect(isOverAlertThreshold(40000, 50000, { type: "percent", value: 80 })).toBe(true);
    expect(isOverAlertThreshold(39999, 50000, { type: "percent", value: 80 })).toBe(false);
    expect(isOverAlertThreshold(15000, 50000, { type: "amount", value: 15000 })).toBe(true);
    expect(isOverAlertThreshold(15000, 50000, null)).toBe(false);
  });
});

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
