import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/client", () => ({ db: {} }));

import type { Instrument } from "@/lib/db/schema/investments";
import type { IsinListingsDeps } from "./isin-listings";
import { autoLinkQuotation, canLinkQuotation, findQuotationCandidates } from "./link-quotation";

const USER = "user-1";
const manual = { id: "i1", isin: "IE00B4L5Y983", currency: "EUR", priceMode: "manuale", createdByUserId: USER, type: "etf" } as Instrument;

function deps(meta: Record<string, string | null>, listings = Object.keys(meta)): IsinListingsDeps {
  return {
    listings: vi.fn(async () => listings.map((yahooSymbol) => ({ yahooSymbol, exchCode: "IM", name: null, securityType: null }))),
    quoteMeta: vi.fn(async (symbol: string) => (symbol in meta ? { currency: meta[symbol], exchange: "Milan" } : null)),
  };
}

describe("canLinkQuotation", () => {
  it("vale solo per gli strumenti manuali dell'utente con un ISIN", () => {
    expect(canLinkQuotation(manual, USER)).toBe(true);
    expect(canLinkQuotation(manual, "altro")).toBe(false);
    expect(canLinkQuotation({ ...manual, priceMode: "auto" }, USER)).toBe(false);
    expect(canLinkQuotation({ ...manual, isin: null }, USER)).toBe(false);
  });
});

describe("findQuotationCandidates", () => {
  it("propone solo le quotazioni confermate nella valuta del rendiconto", async () => {
    const result = await findQuotationCandidates(manual, USER, deps({ "SWDA.MI": "EUR", "SWDA.L": "USD", "IWDA.AS": "EUR" }));
    expect(result).toEqual({
      status: "ok",
      candidates: [
        { symbol: "SWDA.MI", exchange: "Milan", currency: "EUR" },
        { symbol: "IWDA.AS", exchange: "Milan", currency: "EUR" },
      ],
    });
  });

  it("è vuoto se nessuna quotazione ha la valuta giusta o Yahoo non le conosce", async () => {
    expect(await findQuotationCandidates(manual, USER, deps({ "SWDA.L": "USD" }))).toEqual({ status: "empty" });
    expect(await findQuotationCandidates(manual, USER, deps({}, ["XXXX.MI"]))).toEqual({ status: "empty" });
  });

  it("segnala la fonte non raggiungibile invece di dire che non c'è niente", async () => {
    const down = { ...deps({}), listings: vi.fn(async () => { throw new Error("down"); }) };
    expect(await findQuotationCandidates(manual, USER, down)).toEqual({ status: "unavailable" });
    const yahooDown: IsinListingsDeps = { listings: async () => [{ yahooSymbol: "SWDA.MI", exchCode: "IM", name: null, securityType: null }], quoteMeta: async () => { throw new Error("429"); } };
    expect(await findQuotationCandidates(manual, USER, yahooDown)).toEqual({ status: "unavailable" });
  });

  it("non cerca per uno strumento che non si può collegare", async () => {
    const d = deps({ "SWDA.MI": "EUR" });
    expect(await findQuotationCandidates({ ...manual, priceMode: "auto" }, USER, d)).toEqual({ status: "not_eligible" });
    expect(d.listings).not.toHaveBeenCalled();
  });

  it("si ferma a tre proposte", async () => {
    const meta = { "A.MI": "EUR", "B.DE": "EUR", "C.AS": "EUR", "D.L": "EUR" };
    const d = deps(meta);
    const result = await findQuotationCandidates(manual, USER, d);
    expect(result.status === "ok" && result.candidates).toHaveLength(3);
    expect(d.quoteMeta).toHaveBeenCalledTimes(3);
  });
});

describe("autoLinkQuotation", () => {
  it("non fa nulla (e non lancia) se non c'è una quotazione verificata o la fonte non risponde", async () => {
    expect(await autoLinkQuotation(manual, USER, deps({ "SWDA.L": "USD" }))).toBeNull();
    expect(await autoLinkQuotation(manual, USER, { ...deps({}), listings: async () => { throw new Error("down"); } })).toBeNull();
    const d = deps({ "SWDA.MI": "EUR" });
    expect(await autoLinkQuotation({ ...manual, priceMode: "auto" }, USER, d)).toBeNull();
    expect(d.listings).not.toHaveBeenCalled();
  });
});
