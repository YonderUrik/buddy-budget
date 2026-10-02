import { describe, expect, it } from "vitest";
import { buildNetWorthSeries, computeNetWorthChange, excludeClassFromSeries, deriveLiquidityHistory, getNetWorthPeriodRange, toDateKey, type NetWorthSeriesPoint } from "./net-worth";
import type { Account } from "@/lib/db/schema/accounts";
import type { Transaction } from "@/lib/db/schema/transactions";

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: "account-auto",
    userId: "user-1",
    name: "Conto",
    type: "Conto corrente",
    balance: "0.00",
    color: "slate",
    icon: "wallet",
    source: "auto",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    accountId: "account-auto",
    categoryId: "category-1",
    description: "Movimento",
    rawDescription: null,
    note: null,
    amount: "-10.00",
    excludedAmount: "0.00",
    date: "2026-09-10",
    source: "auto",
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const TODAY = new Date(2026, 8, 13); // 13 settembre 2026

function snapshot(date: string, amount: string, source = "snapshot", assetClass = "liquidita") {
  return { date, amount, source, assetClass };
}

function point(date: string, value: number): NetWorthSeriesPoint {
  return { date, label: date, value, byClass: { liquidita: value }, isEstimated: false };
}

describe("toDateKey", () => {
  it("formatta la data locale come YYYY-MM-DD con zero padding", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("deriveLiquidityHistory", () => {
  it("non produce punti se non ci sono movimenti su conti Auto", () => {
    const accounts = [makeAccount({ id: "manual", source: "manuale", balance: "500.00" })];
    const transactions = [makeTransaction({ accountId: "manual", date: "2026-09-10" })];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([]);
  });

  it("ricostruisce il saldo di fine giornata sottraendo i movimenti Auto successivi, fino a ieri", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [
      makeTransaction({ date: "2026-09-11", amount: "-100.00" }),
      makeTransaction({ date: "2026-09-12", amount: "50.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([
      { date: "2026-09-11", amount: 950 },
      { date: "2026-09-12", amount: 1000 },
    ]);
  });

  it("i movimenti datati oggi incidono già sul punto di ieri", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [
      makeTransaction({ date: "2026-09-12", amount: "-20.00" }),
      makeTransaction({ date: "2026-09-13", amount: "30.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([{ date: "2026-09-12", amount: 970 }]);
  });

  it("somma i conti manuali come costante e ignora i loro movimenti", () => {
    const accounts = [
      makeAccount({ balance: "1000.00" }),
      makeAccount({ id: "manual", source: "manuale", balance: "200.00" }),
    ];
    const transactions = [
      makeTransaction({ date: "2026-09-11", amount: "-100.00" }),
      makeTransaction({ date: "2026-09-12", amount: "50.00" }),
      makeTransaction({ accountId: "manual", date: "2026-09-12", amount: "-999.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([
      { date: "2026-09-11", amount: 1150 },
      { date: "2026-09-12", amount: 1200 },
    ]);
  });

  it("usa l'importo pieno anche quando la transazione è divisa", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [
      makeTransaction({ date: "2026-09-11", amount: "-10.00" }),
      makeTransaction({ date: "2026-09-12", amount: "-100.00", excludedAmount: "-60.00" }),
    ];
    expect(deriveLiquidityHistory(accounts, transactions, TODAY)).toEqual([
      { date: "2026-09-11", amount: 1100 },
      { date: "2026-09-12", amount: 1000 },
    ]);
  });

  it("limita la ricostruzione a 24 mesi, dal primo giorno del mese", () => {
    const accounts = [makeAccount({ balance: "1000.00" })];
    const transactions = [makeTransaction({ date: "2023-01-15", amount: "-10.00" })];
    const points = deriveLiquidityHistory(accounts, transactions, TODAY);
    expect(points[0].date).toBe("2024-09-01");
    expect(points[points.length - 1].date).toBe("2026-09-12");
    expect(points.every((p) => p.amount === 1000)).toBe(true);
  });
});

describe("getNetWorthPeriodRange", () => {
  it("3mesi, 1anno e 1mese partono dallo stesso giorno N mesi prima", () => {
    expect(toDateKey(getNetWorthPeriodRange("3mesi", TODAY, null).from)).toBe("2026-06-13");
    expect(toDateKey(getNetWorthPeriodRange("1anno", TODAY, null).from)).toBe("2025-09-13");
    expect(toDateKey(getNetWorthPeriodRange("1mese", TODAY, null).to)).toBe("2026-09-13");
  });

  it("limita il giorno all'ultimo del mese di destinazione", () => {
    expect(toDateKey(getNetWorthPeriodRange("1mese", new Date(2026, 2, 31), null).from)).toBe("2026-02-28");
  });

  it("max parte dalla prima data disponibile, o da oggi se non ce ne sono", () => {
    expect(toDateKey(getNetWorthPeriodRange("max", TODAY, "2024-01-05").from)).toBe("2024-01-05");
    expect(toDateKey(getNetWorthPeriodRange("max", TODAY, null).from)).toBe("2026-09-13");
  });
});

describe("buildNetWorthSeries", () => {
  it("senza snapshot restituisce solo il totale di oggi", () => {
    const series = buildNetWorthSeries([], { liquidita: 140 }, "3mesi", TODAY);
    expect(series.map((p) => [p.date, p.value, p.isEstimated])).toEqual([["2026-09-13", 140, false]]);
  });

  it("serie giornaliera: ripete l'ultimo valore nei giorni mancanti e chiude col totale di oggi", () => {
    const series = buildNetWorthSeries(
      [snapshot("2026-09-10", "100.00"), snapshot("2026-09-12", "130.00")],
      { liquidita: 140 },
      "1mese",
      TODAY
    );
    expect(series.map((p) => [p.date, p.value])).toEqual([
      ["2026-09-10", 100],
      ["2026-09-11", 100],
      ["2026-09-12", 130],
      ["2026-09-13", 140],
    ]);
  });

  it("somma le classi di asset dello stesso giorno", () => {
    const series = buildNetWorthSeries(
      [snapshot("2026-09-12", "100.00"), snapshot("2026-09-12", "50.00", "snapshot", "investimenti")],
      {},
      "1mese",
      TODAY
    );
    expect(series[0]).toMatchObject({ date: "2026-09-12", value: 150, byClass: { liquidita: 100, investimenti: 50 } });
  });

  it("ogni classe ripete il proprio ultimo valore: un giorno con la sola liquidità non azzera gli investimenti", () => {
    const series = buildNetWorthSeries(
      [
        snapshot("2026-09-11", "100.00"),
        snapshot("2026-09-11", "50.00", "derivato", "investimenti"),
        snapshot("2026-09-12", "120.00"),
      ],
      { liquidita: 130, investimenti: 60 },
      "1mese",
      TODAY
    );
    expect(series.map((p) => [p.date, p.value, p.byClass, p.isEstimated])).toEqual([
      ["2026-09-11", 150, { liquidita: 100, investimenti: 50 }, true],
      ["2026-09-12", 170, { liquidita: 120, investimenti: 50 }, true],
      ["2026-09-13", 190, { liquidita: 130, investimenti: 60 }, false],
    ]);
  });

  it("porta dentro il periodo l'ultimo valore precedente all'inizio", () => {
    const series = buildNetWorthSeries([snapshot("2026-01-01", "500.00")], { liquidita: 600 }, "1mese", TODAY);
    expect(series[0]).toMatchObject({ date: "2026-08-13", value: 500 });
    expect(series).toHaveLength(32);
    expect(series[series.length - 1]).toMatchObject({ date: "2026-09-13", value: 600 });
  });

  it("marca come stimati i punti derivati e quelli che ne ripetono il valore, mai il punto di oggi", () => {
    const series = buildNetWorthSeries([snapshot("2026-09-11", "100.00", "derivato")], { liquidita: 120 }, "1mese", TODAY);
    expect(series.map((p) => [p.date, p.isEstimated])).toEqual([
      ["2026-09-11", true],
      ["2026-09-12", true],
      ["2026-09-13", false],
    ]);
  });

  it("1anno e max tengono un punto per mese: l'ultimo giorno del mese, o oggi nel mese corrente", () => {
    const snapshots = [
      snapshot("2026-07-15", "100.00"),
      snapshot("2026-07-31", "120.00"),
      snapshot("2026-08-20", "200.00"),
    ];
    const series = buildNetWorthSeries(snapshots, { liquidita: 250 }, "1anno", TODAY);
    expect(series.map((p) => [p.date, p.value])).toEqual([
      ["2026-07-31", 120],
      ["2026-08-31", 200],
      ["2026-09-13", 250],
    ]);
    expect(buildNetWorthSeries(snapshots, { liquidita: 250 }, "max", TODAY).map((p) => p.date)).toEqual([
      "2026-07-31",
      "2026-08-31",
      "2026-09-13",
    ]);
  });

  it("ignora gli snapshot datati oggi o dopo: l'ultimo punto è sempre il totale corrente", () => {
    const series = buildNetWorthSeries([snapshot("2026-09-13", "999.00")], { liquidita: 140 }, "1mese", TODAY);
    expect(series.map((p) => [p.date, p.value])).toEqual([["2026-09-13", 140]]);
  });
});

describe("excludeClassFromSeries", () => {
  it("toglie la classe dal totale senza toccare byClass", () => {
    const point = { date: "2026-10-01", label: "1 ott", value: 1000, byClass: { liquidita: 600, previdenza: 400 }, isEstimated: false };
    const [result] = excludeClassFromSeries([point], "previdenza");
    expect(result.value).toBe(600);
    expect(result.byClass).toEqual(point.byClass);
  });
});

describe("computeNetWorthChange", () => {
  it("calcola variazione assoluta e percentuale tra primo e ultimo punto", () => {
    expect(computeNetWorthChange([point("a", 100), point("b", 150)])).toEqual({ start: 100, end: 150, delta: 50, deltaPct: 0.5 });
  });

  it("percentuale nulla se il valore iniziale è zero", () => {
    expect(computeNetWorthChange([point("a", 0), point("b", 150)]).deltaPct).toBeNull();
  });

  it("con un solo punto nessuna variazione", () => {
    expect(computeNetWorthChange([point("a", 80)])).toEqual({ start: 80, end: 80, delta: 0, deltaPct: null });
  });

  it("con nessun punto tutto a zero", () => {
    expect(computeNetWorthChange([])).toEqual({ start: 0, end: 0, delta: 0, deltaPct: null });
  });

  it("con patrimonio iniziale negativo la percentuale è sul valore assoluto", () => {
    expect(computeNetWorthChange([point("a", -200), point("b", -100)]).deltaPct).toBe(0.5);
  });
});
