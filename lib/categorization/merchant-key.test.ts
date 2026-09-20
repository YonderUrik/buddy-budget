import { describe, expect, it } from "vitest";
import { jaccardSimilarity, merchantKey, merchantKeyTokens } from "./merchant-key";

describe("merchantKey", () => {
  it("rimuove rumore bancario, suffissi societari e codici numerici", () => {
    expect(merchantKey("PAGAMENTO POS ESSELUNGA SPA VIA ROMA COD.4471")).toBe("esselunga via roma");
  });

  it("normalizza accenti e maiuscole", () => {
    expect(merchantKey("Caffè Città S.R.L.")).toBe("caffe citta");
  });

  it("collassa spazi e punteggiatura multipli", () => {
    expect(merchantKey("NETFLIX.COM   --  1234")).toBe("netflix com");
  });

  it("produce la stessa chiave per varianti societarie dello stesso merchant", () => {
    expect(merchantKey("ESSELUNGA SPA")).toBe(merchantKey("Esselunga S.p.A."));
  });

  it("ricade sulla descrizione normalizzata quando resta solo rumore", () => {
    expect(merchantKey("PAGAMENTO POS 4471")).toBe("pagamento pos 4471");
  });

  it("ricade sulla descrizione normalizzata quando la descrizione è solo numerica", () => {
    expect(merchantKey("  00998877  ")).toBe("00998877");
  });

  it("ritorna stringa vuota su descrizione vuota", () => {
    expect(merchantKey("   ")).toBe("");
  });
});

describe("merchantKeyTokens", () => {
  it("spezza la chiave in token", () => {
    expect(merchantKeyTokens("esselunga via roma")).toEqual(new Set(["esselunga", "via", "roma"]));
  });
});

describe("jaccardSimilarity", () => {
  it("è 1 su insiemi identici", () => {
    expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });

  it("è 0 su insiemi disgiunti", () => {
    expect(jaccardSimilarity(new Set(["a"]), new Set(["b"]))).toBe(0);
  });

  it("è intersezione su unione su insiemi parzialmente sovrapposti", () => {
    expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
  });

  it("è 0 quando uno dei due insiemi è vuoto", () => {
    expect(jaccardSimilarity(new Set(), new Set(["a"]))).toBe(0);
  });
});
