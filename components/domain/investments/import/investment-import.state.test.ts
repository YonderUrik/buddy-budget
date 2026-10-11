import { describe, expect, it } from "vitest";
import type { Instrument } from "@/lib/db/schema/investments";
import { describeChoice, type InstrumentChoice } from "./investment-import.state";

const create = (source: "yahoo" | "manuale", confidence: "exact" | "guess"): InstrumentChoice =>
  ({ kind: "create", input: { source, name: "X", isin: "IE00B4L5Y983", currency: "EUR", type: "etf", yahooSymbol: "X.MI" } as never, label: "X", detail: "X", type: "etf", confidence });

describe("describeChoice", () => {
  it("segnala come mancante uno strumento non trovato e uno non raggiungibile con testi diversi", () => {
    const notFound = describeChoice({ kind: "skip", reason: "not_found" });
    const unavailable = describeChoice({ kind: "skip", reason: "unavailable" });
    expect(notFound.tone).toBe("missing");
    expect(unavailable.tone).toBe("missing");
    expect(notFound.title).not.toBe(unavailable.title);
  });

  it("distingue collegato in automatico, da controllare e prezzi manuali", () => {
    expect(describeChoice(create("yahoo", "exact"))).toMatchObject({ tone: "ready", title: "Nuovo, collegato in automatico" });
    expect(describeChoice(create("yahoo", "guess")).tone).toBe("check");
    expect(describeChoice(create("manuale", "exact")).tone).toBe("manual");
  });

  it("per uno strumento già tuo con prezzi manuali dice che proverà a collegare la quotazione", () => {
    const instrument = { name: "ETF", isin: "IE00B4L5Y983", priceMode: "manuale" } as Instrument;
    expect(describeChoice({ kind: "known", instrument }).text).toMatch(/collegare la quotazione/);
    expect(describeChoice({ kind: "known", instrument: { ...instrument, priceMode: "auto" } }).tone).toBe("ready");
  });
});
