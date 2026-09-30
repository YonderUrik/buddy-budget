import { describe, expect, it } from "vitest";
import type { InvestmentTransactionInput, PortfolioDailyPoint } from "./investments";
import {
  computeBollo,
  computeRealizedGains,
  computeTaxReport,
  cryptoTaxRate,
  lossesByExpiry,
  simulateSale,
  toBaseEquivalent,
  type TaxInstrument,
} from "./taxes";
import { looksLikeGovernmentBond, resolveTaxSettings } from "@/lib/investments/tax-settings";

const STOCK: TaxInstrument = { id: "s", name: "Enel", type: "azione", currency: "EUR", priceUnit: "unita", taxRate: 0.26, harmonized: true };
const STOCK2: TaxInstrument = { ...STOCK, id: "s2", name: "Eni" };
const ETF: TaxInstrument = { id: "e", name: "VWCE", type: "etf", currency: "EUR", priceUnit: "unita", taxRate: 0.26, harmonized: true };
const BTP: TaxInstrument = { id: "b", name: "BTP 2030", type: "obbligazione", currency: "EUR", priceUnit: "percentuale_nominale", taxRate: 0.125, harmonized: true };
const BTC: TaxInstrument = { id: "c", name: "Bitcoin", type: "crypto", currency: "EUR", priceUnit: "unita", taxRate: 0.26, harmonized: true };
const INSTRUMENTS = [STOCK, STOCK2, ETF, BTP, BTC];

let counter = 0;
function op(
  instrumentId: string,
  type: InvestmentTransactionInput["type"],
  date: string,
  quantity: number,
  price: number,
  extra: Partial<InvestmentTransactionInput> = {}
): InvestmentTransactionInput {
  counter += 1;
  return {
    id: `t${counter}`,
    instrumentId,
    type,
    date,
    quantity: String(quantity),
    price: String(price),
    fxRate: "1",
    fees: "0",
    taxes: "0",
    grossAmount: null,
    ...extra,
  };
}

function year(report: ReturnType<typeof computeTaxReport>, y: number) {
  const found = report.years.find((r) => r.year === y);
  if (!found) throw new Error(`anno ${y} assente`);
  return found;
}

describe("computeRealizedGains", () => {
  it("usa il costo medio ponderato con le commissioni, esclude le imposte trattenute", () => {
    const gains = computeRealizedGains(
      [
        op("s", "acquisto", "2025-01-10", 10, 100, { fees: "10" }),
        op("s", "acquisto", "2025-02-10", 10, 120, { fees: "10" }),
        op("s", "vendita", "2025-03-10", 5, 130, { fees: "5", taxes: "20" }),
      ],
      INSTRUMENTS,
      "2025-12-31"
    );
    // Costo medio: (1010 + 1210) / 20 = 111; costo venduto 555; incasso 650 - 5 = 645.
    expect(gains).toHaveLength(1);
    expect(gains[0].cost).toBeCloseTo(555);
    expect(gains[0].proceeds).toBeCloseTo(645);
    expect(gains[0].gain).toBeCloseTo(90);
    expect(gains[0].withheld).toBe(20);
  });

  it("uno split cambia le quote ma non il costo", () => {
    const gains = computeRealizedGains(
      [op("s", "acquisto", "2025-01-10", 10, 100), op("s", "split", "2025-02-01", 2, 0), op("s", "vendita", "2025-03-01", 20, 60)],
      INSTRUMENTS,
      "2025-12-31"
    );
    expect(gains[0].gain).toBeCloseTo(200);
  });

  it("le obbligazioni in % del nominale", () => {
    const gains = computeRealizedGains(
      [op("b", "acquisto", "2025-01-10", 10000, 95), op("b", "rimborso", "2026-01-10", 10000, 100)],
      INSTRUMENTS,
      "2026-12-31"
    );
    expect(gains[0].gain).toBeCloseTo(500);
    expect(gains[0].category).toBe("diversi");
  });

  it("classifica: ETF in guadagno è reddito di capitale, in perdita è reddito diverso", () => {
    const gains = computeRealizedGains(
      [
        op("e", "acquisto", "2025-01-10", 10, 100),
        op("e", "vendita", "2025-02-10", 5, 120),
        op("e", "vendita", "2025-03-10", 5, 80),
      ],
      INSTRUMENTS,
      "2025-12-31"
    );
    expect(gains.map((g) => g.category)).toEqual(["capitale", "diversi"]);
  });
});

describe("computeTaxReport — amministrato", () => {
  it("una minus compensa plus successive di azioni, non il guadagno di un ETF", () => {
    const report = computeTaxReport({
      regime: "amministrato",
      instruments: INSTRUMENTS,
      todayKey: "2025-12-31",
      transactions: [
        op("s", "acquisto", "2024-01-10", 10, 100),
        op("s", "vendita", "2024-06-10", 10, 80), // -200
        op("e", "acquisto", "2025-01-10", 10, 100),
        op("e", "vendita", "2025-02-10", 10, 130), // +300 capitale
        op("s2", "acquisto", "2025-01-10", 10, 100),
        op("s2", "vendita", "2025-03-10", 10, 115), // +150 diversi
      ],
    });
    expect(year(report, 2024).lossesCreated).toBeCloseTo(200);
    const y2025 = year(report, 2025);
    expect(y2025.taxOnFunds).toBeCloseTo(78);
    expect(y2025.lossesUsed).toBeCloseTo(150);
    expect(y2025.taxOnGains).toBeCloseTo(0);
    expect(report.losses).toHaveLength(1);
    expect(report.losses[0].remaining).toBeCloseTo(50);
    expect(report.losses[0].expiresYear).toBe(2028);
    expect(report.realized.find((r) => r.instrumentId === "s2")?.estimatedTax).toBeCloseTo(0);
  });

  it("una minus non compensa una plus realizzata prima nello stesso anno", () => {
    const report = computeTaxReport({
      regime: "amministrato",
      instruments: INSTRUMENTS,
      todayKey: "2025-12-31",
      transactions: [
        op("s", "acquisto", "2025-01-10", 10, 100),
        op("s", "vendita", "2025-02-10", 10, 110), // +100
        op("s2", "acquisto", "2025-01-10", 10, 100),
        op("s2", "vendita", "2025-03-10", 10, 90), // -100
      ],
    });
    const y = year(report, 2025);
    expect(y.taxOnGains).toBeCloseTo(26);
    expect(lossesByExpiry(report.losses)).toEqual([{ expiresYear: 2029, amount: 100 }]);
  });
});

describe("computeTaxReport — dichiarativo", () => {
  it("nell'anno plus e minus si sommano, indipendentemente dall'ordine", () => {
    const report = computeTaxReport({
      regime: "dichiarativo",
      instruments: INSTRUMENTS,
      todayKey: "2025-12-31",
      transactions: [
        op("s", "acquisto", "2025-01-10", 10, 100),
        op("s", "vendita", "2025-02-10", 10, 110),
        op("s2", "acquisto", "2025-01-10", 10, 100),
        op("s2", "vendita", "2025-03-10", 10, 90),
      ],
    });
    expect(year(report, 2025).estimatedTax).toBeCloseTo(0);
    expect(report.losses).toHaveLength(0);
    expect(report.realized[0].estimatedTax).toBeNull();
  });

  it("le minus di un anno scadono dopo 4 anni", () => {
    const report = computeTaxReport({
      regime: "dichiarativo",
      instruments: INSTRUMENTS,
      todayKey: "2024-12-31",
      transactions: [
        op("s", "acquisto", "2019-01-10", 10, 100),
        op("s", "vendita", "2019-06-10", 10, 50), // -500
        op("s2", "acquisto", "2024-01-10", 10, 100),
        op("s2", "vendita", "2024-06-10", 10, 150), // +500
      ],
    });
    expect(year(report, 2023).lossesExpired).toBeCloseTo(500);
    expect(year(report, 2024).lossesUsed).toBe(0);
    expect(year(report, 2024).taxOnGains).toBeCloseTo(130);
  });
});

describe("aliquote diverse", () => {
  it("i titoli di Stato valgono il 48,08% nello zaino e sono tassati al 12,5%", () => {
    expect(toBaseEquivalent(1000, 0.125)).toBeCloseTo(480.77, 2);
    const alone = computeTaxReport({
      regime: "amministrato",
      instruments: INSTRUMENTS,
      todayKey: "2026-12-31",
      transactions: [op("b", "acquisto", "2025-01-10", 10000, 90), op("b", "vendita", "2026-01-10", 10000, 100)],
    });
    expect(year(alone, 2026).taxOnGains).toBeCloseTo(125);

    const withLoss = computeTaxReport({
      regime: "amministrato",
      instruments: INSTRUMENTS,
      todayKey: "2026-12-31",
      transactions: [
        op("s", "acquisto", "2025-01-10", 10, 100),
        op("s", "vendita", "2025-06-10", 10, 50), // -500
        op("b", "acquisto", "2025-01-10", 10000, 90),
        op("b", "vendita", "2026-01-10", 10000, 100), // +1000 al 12,5% = 480,77 base 26%
      ],
    });
    expect(year(withLoss, 2026).taxOnGains).toBeCloseTo(0);
    expect(withLoss.losses[0].remaining).toBeCloseTo(500 - 480.77, 1);
  });

  it("crypto: 33% dal 2026, franchigia di 2.000 € fino al 2024, zaino solo crypto", () => {
    expect(cryptoTaxRate(2025)).toBe(0.26);
    expect(cryptoTaxRate(2026)).toBe(0.33);
    const report = computeTaxReport({
      regime: "amministrato",
      instruments: INSTRUMENTS,
      todayKey: "2026-12-31",
      transactions: [
        op("c", "acquisto", "2024-01-10", 1, 10000),
        op("c", "vendita", "2024-06-10", 0.5, 23000), // costo 5000, incasso 11500 → +6500
        op("s", "acquisto", "2025-01-10", 10, 100),
        op("s", "vendita", "2025-06-10", 10, 50), // -500 azioni: non compensa le crypto
        op("c", "vendita", "2026-06-10", 0.5, 12000), // +1000 al 33%
      ],
    });
    expect(year(report, 2024).taxOnCrypto).toBeCloseTo(6500 * 0.26);
    expect(year(report, 2026).taxOnCrypto).toBeCloseTo(1000 * 0.33);
    expect(lossesByExpiry(report.losses)).toEqual([{ expiresYear: 2029, amount: 500 }]);

    const small = computeTaxReport({
      regime: "dichiarativo",
      instruments: INSTRUMENTS,
      todayKey: "2024-12-31",
      transactions: [op("c", "acquisto", "2024-01-10", 1, 10000), op("c", "vendita", "2024-06-10", 1, 11500)],
    });
    expect(year(small, 2024).taxOnCrypto).toBe(0);
  });
});

describe("minusvalenze pregresse", () => {
  const transactions = [op("s", "acquisto", "2025-01-10", 10, 100), op("s", "vendita", "2025-03-10", 10, 130)];
  it("amministrato: disponibili dal 1° gennaio del loro anno", () => {
    const report = computeTaxReport({ regime: "amministrato", instruments: INSTRUMENTS, todayKey: "2025-12-31", transactions, manualLosses: [{ year: 2025, amount: 100 }] });
    expect(year(report, 2025).taxOnGains).toBeCloseTo(200 * 0.26);
  });
  it("dichiarativo: residuo di quell'anno, utilizzabile dagli anni dopo", () => {
    const report = computeTaxReport({ regime: "dichiarativo", instruments: INSTRUMENTS, todayKey: "2025-12-31", transactions, manualLosses: [{ year: 2025, amount: 100 }] });
    expect(year(report, 2025).taxOnGains).toBeCloseTo(300 * 0.26);
    const earlier = computeTaxReport({ regime: "dichiarativo", instruments: INSTRUMENTS, todayKey: "2025-12-31", transactions, manualLosses: [{ year: 2022, amount: 100 }] });
    expect(year(earlier, 2025).taxOnGains).toBeCloseTo(200 * 0.26);
    expect(earlier.years[0].year).toBe(2022);
  });
});

describe("computeTaxReport — proventi e trattenute", () => {
  it("somma lordo e ritenute di dividendi e cedole e le imposte trattenute sulle vendite", () => {
    const report = computeTaxReport({
      regime: "amministrato",
      instruments: INSTRUMENTS,
      todayKey: "2025-12-31",
      transactions: [
        op("s", "acquisto", "2025-01-10", 10, 100),
        op("s", "dividendo", "2025-05-10", 0, 0, { grossAmount: "50", taxes: "13" }),
        op("s", "vendita", "2025-06-10", 10, 110, { taxes: "26" }),
      ],
    });
    const y = year(report, 2025);
    expect(y.incomeGross).toBeCloseTo(50);
    expect(y.incomeWithheld).toBeCloseTo(13);
    expect(y.withheld).toBeCloseTo(26);
    expect(y.estimatedTax).toBeCloseTo(26);
  });
});

describe("simulateSale", () => {
  const transactions = [
    op("s", "acquisto", "2025-01-10", 10, 100),
    op("s", "vendita", "2025-02-10", 5, 60), // -200 nello zaino
    op("s2", "acquisto", "2025-01-10", 10, 100),
    op("e", "acquisto", "2025-01-10", 10, 100),
  ];
  it("una plus di azioni usa lo zaino", () => {
    const sim = simulateSale({ regime: "amministrato", instruments: INSTRUMENTS, transactions, todayKey: "2025-09-30", instrumentId: "s2", quantity: 10, price: 130, fxRate: 1 });
    expect(sim?.gain).toBeCloseTo(300);
    expect(sim?.lossesUsed).toBeCloseTo(200);
    expect(sim?.taxDelta).toBeCloseTo(26);
    expect(sim?.net).toBeCloseTo(1300 - 26);
  });
  it("un ETF in guadagno paga tutto e non tocca lo zaino", () => {
    const sim = simulateSale({ regime: "amministrato", instruments: INSTRUMENTS, transactions, todayKey: "2025-09-30", instrumentId: "e", quantity: 10, price: 130, fxRate: 1 });
    expect(sim?.category).toBe("capitale");
    expect(sim?.taxDelta).toBeCloseTo(78);
    expect(sim?.lossesUsed).toBe(0);
  });
  it("nel dichiarativo una minus riduce le imposte dell'anno", () => {
    const withGain = [...transactions, op("s2", "vendita", "2025-03-10", 5, 140)]; // +200
    const sim = simulateSale({ regime: "dichiarativo", instruments: INSTRUMENTS, transactions: withGain, todayKey: "2025-09-30", instrumentId: "s", quantity: 5, price: 50, fxRate: 1 });
    // -200 già nell'anno + 200 = 0; con altri -250 il netto va a -250: imposte invariate (0), zaino +250.
    expect(sim?.taxDelta).toBeCloseTo(0);
    expect(sim?.lossesCreated).toBeCloseTo(250);
  });
  it("null senza quantità o prezzo", () => {
    expect(simulateSale({ regime: "amministrato", instruments: INSTRUMENTS, transactions, todayKey: "2025-09-30", instrumentId: "s2", quantity: 0, price: 1, fxRate: 1 })).toBeNull();
  });
});

describe("computeBollo", () => {
  function days(from: string, to: string, value: number): PortfolioDailyPoint[] {
    const out: PortfolioDailyPoint[] = [];
    for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
      out.push({ date: d.toISOString().slice(0, 10), value, invested: 0, bought: 0, income: 0 });
    }
    return out;
  }
  it("0,2% del valore a fine anno, proporzionato ai giorni del primo anno; anno in corso proiettato al 31/12", () => {
    const daily = [...days("2024-07-01", "2024-12-31", 10000), ...days("2025-01-01", "2025-09-30", 20000)];
    const bollo = computeBollo(daily, "2025-09-30");
    expect(bollo[0].year).toBe(2024);
    expect(bollo[0].bollo).toBeCloseTo(10000 * 0.002 * (184 / 366));
    expect(bollo[1].estimate).toBe(true);
    expect(bollo[1].bollo).toBeCloseTo(40);
  });
});

describe("impostazioni fiscali", () => {
  const base = { taxRate: "0.2600", taxHarmonized: null };
  it("riconosce i titoli di Stato dal nome", () => {
    expect(looksLikeGovernmentBond({ type: "obbligazione", name: "BTP 1 MZ 2035 3,85%" })).toBe(true);
    expect(looksLikeGovernmentBond({ type: "obbligazione", name: "Enel 2030 4%" })).toBe(false);
    expect(looksLikeGovernmentBond({ type: "etf", name: "iShares BTP" })).toBe(false);
  });
  it("la correzione dell'utente vince, poi il titolo di Stato, poi lo strumento", () => {
    const btp = { ...base, type: "obbligazione" as const, name: "BTP Italia 2028" };
    expect(resolveTaxSettings(btp, undefined)).toMatchObject({ taxRate: 0.125, taxRateSource: "titolo_di_stato" });
    expect(resolveTaxSettings(btp, { taxRate: "0.26", taxHarmonized: null })).toMatchObject({ taxRate: 0.26, taxRateSource: "manuale" });
    expect(resolveTaxSettings({ ...base, type: "azione", name: "Enel" }, undefined)).toMatchObject({ taxRate: 0.26, taxRateSource: "strumento" });
  });
  it("un ETF si presume armonizzato salvo correzione", () => {
    const etf = { ...base, type: "etf" as const, name: "VWCE" };
    expect(resolveTaxSettings(etf, undefined)).toMatchObject({ harmonized: true, harmonizedSource: "presunto" });
    expect(resolveTaxSettings(etf, { taxRate: null, taxHarmonized: false }).harmonized).toBe(false);
  });
});
