import { describe, expect, it } from "vitest";
import { buildNetWorthSeries, computeNetWorthChange, excludeClassFromSeries, restrictSeriesToClasses, getNetWorthPeriodRange, toDateKey, type NetWorthSeriesPoint } from "./net-worth";
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
    expect(series.map((p) => p.label)).toEqual(["lug 26", "ago 26", "set 26"]);
    expect(buildNetWorthSeries(snapshots, { liquidita: 250 }, "1anno", TODAY, "en-GB").map((p) => p.label)).toEqual(["Jul 26", "Aug 26", "Sept 26"]);
    expect(buildNetWorthSeries(snapshots, { liquidita: 250 }, "1anno", TODAY, "de-DE").map((p) => p.label)).toEqual(["Juli 26", "Aug. 26", "Sept. 26"]);
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

describe("restrictSeriesToClasses", () => {
  it("somma solo le classi indicate, senza toccare byClass", () => {
    const point = { date: "2026-10-01", label: "1 ott", value: 800, byClass: { liquidita: 600, investimenti: 300, debiti: -100 }, isEstimated: false };
    const [result] = restrictSeriesToClasses([point], ["liquidita", "investimenti"]);
    expect(result.value).toBe(900);
    expect(result.byClass).toEqual(point.byClass);
    expect(restrictSeriesToClasses([point], ["previdenza"])[0].value).toBe(0);
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
