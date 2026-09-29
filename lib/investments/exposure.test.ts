import { describe, expect, it } from "vitest";
import { isAreaKey } from "./exposure-keys";
import {
  aggregateExposure,
  areaInsight,
  completeWeights,
  resolveInstrumentExposure,
  sectorInsight,
  type ExposureInstrument,
  type ExposureProfile,
} from "./exposure";
import { matchIndexProfile } from "./index-profiles";

function instrument(values: Partial<ExposureInstrument> & Pick<ExposureInstrument, "type">): ExposureInstrument {
  return { id: values.id ?? values.type, name: values.name ?? "Strumento", isin: values.isin ?? null, type: values.type };
}

function profile(values: Partial<ExposureProfile>): ExposureProfile {
  return { instrumentId: "x", symbol: null, sectors: null, assetMix: null, holdings: null, sector: null, country: null, ...values };
}

function sum(weights: Record<string, number | undefined>): number {
  return Object.values(weights).reduce<number>((s, v) => s + (v ?? 0), 0);
}

describe("completeWeights", () => {
  it("scarta chiavi sconosciute e valori non positivi, mette il resto in non classificato", () => {
    expect(completeWeights({ europa: 0.6, marte: 0.3, italia: -1 }, isAreaKey)).toEqual({ europa: 0.6, non_classificato: 0.4 });
  });

  it("riscala se la somma supera 1", () => {
    const result = completeWeights({ europa: 0.8, italia: 0.4 }, isAreaKey);
    expect(result.europa).toBeCloseTo(2 / 3);
    expect(sum(result)).toBeCloseTo(1);
  });
});

describe("matchIndexProfile", () => {
  it("riconosce gli indici più diffusi dal nome", () => {
    expect(matchIndexProfile("Vanguard FTSE All-World UCITS ETF (Acc)")?.profile.id).toBe("all_world");
    expect(matchIndexProfile("iShares Core MSCI World UCITS ETF USD (Acc)")?.profile.id).toBe("world");
    expect(matchIndexProfile("iShares Core MSCI EM IMI UCITS ETF")?.profile.id).toBe("emerging");
    expect(matchIndexProfile("iShares Core S&P 500 UCITS ETF")?.profile.id).toBe("sp500");
    expect(matchIndexProfile("Invesco EQQQ Nasdaq-100 UCITS ETF")?.profile.id).toBe("nasdaq100");
    expect(matchIndexProfile("Amundi Stoxx Europe 600 UCITS ETF")?.profile.id).toBe("europe");
  });

  it("ignora gli ETF settoriali e usa solo le aree per quelli fattoriali", () => {
    expect(matchIndexProfile("Xtrackers MSCI World Information Technology UCITS ETF")).toBeNull();
    expect(matchIndexProfile("iShares Core Global Aggregate Bond UCITS ETF")).toBeNull();
    const small = matchIndexProfile("iShares MSCI World Small Cap UCITS ETF");
    expect(small).toMatchObject({ useSectors: false, broad: false });
    expect(small?.profile.id).toBe("world");
    expect(matchIndexProfile("Qualcosa di sconosciuto")).toBeNull();
  });

  it("aree e settori di ogni indice sommano a 1", () => {
    for (const name of ["FTSE All-World", "MSCI World", "S&P 500", "Nasdaq-100", "MSCI Emerging Markets", "MSCI Europe"]) {
      const match = matchIndexProfile(name)!;
      expect(sum(match.profile.areas)).toBeCloseTo(1, 6);
      if (match.profile.sectors) expect(sum(match.profile.sectors)).toBeCloseTo(1, 6);
    }
  });
});

describe("resolveInstrumentExposure", () => {
  it("ETF con settori e mix di attività da Yahoo, aree dalla stima dell'indice", () => {
    const etf = instrument({ type: "etf", name: "Vanguard FTSE All-World UCITS ETF" });
    const result = resolveInstrumentExposure(
      etf,
      profile({ sectors: { tecnologia: 0.5, finanza: 0.5 }, assetMix: { stock: 0.9, bond: 0.05, cash: 0.05, other: 0 } }),
      null
    );
    expect(result.sectorSource).toBe("yahoo");
    expect(result.sectors).toMatchObject({ tecnologia: 0.45, finanza: 0.45, obbligazioni: 0.05, liquidita: 0.05 });
    expect(result.areaSource).toBe("stima_indice");
    expect(result.areas.emergenti).toBeCloseTo(0.12);
  });

  it("ETF senza dati Yahoo: settori e aree dalla stima dell'indice", () => {
    const result = resolveInstrumentExposure(instrument({ type: "etf", name: "iShares Core MSCI World" }), null, null);
    expect(result).toMatchObject({ sectorSource: "stima_indice", areaSource: "stima_indice" });
    expect(sum(result.sectors)).toBeCloseTo(1);
  });

  it("un ETF obbligazionario si descrive dal mix anche senza settori", () => {
    const result = resolveInstrumentExposure(
      instrument({ type: "etf", name: "Un ETF" }),
      profile({ assetMix: { stock: 0, bond: 0.97, cash: 0.03, other: null } }),
      null
    );
    expect(result.sectors).toEqual({ obbligazioni: 0.97, liquidita: 0.03 });
  });

  it("azione: settore e paese da Yahoo, altrimenti paese dall'ISIN", () => {
    expect(resolveInstrumentExposure(instrument({ type: "azione" }), profile({ sector: "tecnologia", country: "US" }), null)).toMatchObject({
      sectors: { tecnologia: 1 },
      sectorSource: "yahoo",
      areas: { nord_america: 1 },
      areaSource: "yahoo",
    });
    expect(resolveInstrumentExposure(instrument({ type: "azione", isin: "IT0003128367" }), null, null)).toMatchObject({
      sectors: { non_classificato: 1 },
      sectorSource: "nessuno",
      areas: { italia: 1 },
      areaSource: "isin",
    });
  });

  it("BTP, crypto ed ETC dal tipo; un ETF non usa il paese dell'ISIN (è il domicilio del fondo)", () => {
    expect(resolveInstrumentExposure(instrument({ type: "obbligazione", isin: "IT0005580094" }), null, null)).toMatchObject({
      sectors: { obbligazioni: 1 },
      areas: { italia: 1 },
    });
    expect(resolveInstrumentExposure(instrument({ type: "crypto" }), null, null)).toMatchObject({ sectors: { crypto: 1 }, areas: { nessuna: 1 } });
    expect(resolveInstrumentExposure(instrument({ type: "etc" }), null, null).sectors).toEqual({ materie_prime: 1 });
    expect(resolveInstrumentExposure(instrument({ type: "etf", isin: "IE00BK5BQT80", name: "Tematico Clean Energy" }), null, null)).toMatchObject({
      areas: { non_classificato: 1 },
      areaSource: "nessuno",
    });
  });

  it("la correzione manuale vince per la sola dimensione corretta", () => {
    const result = resolveInstrumentExposure(
      instrument({ id: "w", type: "etf", name: "MSCI World" }),
      null,
      { instrumentId: "w", sectors: null, areas: { europa: 0.5, italia: 0.3 } }
    );
    expect(result.areaSource).toBe("manuale");
    expect(result.areas).toMatchObject({ europa: 0.5, italia: 0.3 });
    expect(result.areas.non_classificato).toBeCloseTo(0.2);
    expect(result.sectorSource).toBe("stima_indice");
  });
});

describe("aggregateExposure", () => {
  it("somma pesando per il valore, non classificato in fondo, copertura", () => {
    const exposures = new Map([
      ["a", resolveInstrumentExposure(instrument({ id: "a", type: "crypto" }), null, null)],
      ["b", resolveInstrumentExposure(instrument({ id: "b", type: "obbligazione", isin: "IT0005580094" }), null, null)],
      ["c", resolveInstrumentExposure(instrument({ id: "c", type: "azione" }), null, null)],
    ]);
    const areas = aggregateExposure(
      [
        { instrumentId: "a", value: 100 },
        { instrumentId: "b", value: 300 },
        { instrumentId: "c", value: 100 },
      ],
      exposures,
      "areas"
    );
    expect(areas.slices.map((s) => s.key)).toEqual(["italia", "nessuna", "non_classificato"]);
    expect(areas.slices[0].share).toBeCloseTo(0.6);
    expect(areas.classifiedShare).toBeCloseTo(0.8);
    expect(areaInsight(areas)).toBe("60% in Italia.");
  });

  it("frase sul settore azionario prevalente", () => {
    const exposures = new Map([["w", resolveInstrumentExposure(instrument({ id: "w", type: "etf", name: "S&P 500" }), null, null)]]);
    const sectors = aggregateExposure([{ instrumentId: "w", value: 1000 }], exposures, "sectors");
    expect(sectorInsight(sectors)).toBe("Il settore che pesa di più è tecnologia (34% del portafoglio).");
  });
});
