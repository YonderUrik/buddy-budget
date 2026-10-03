import { describe, expect, it } from "vitest";
import { extractMerchantName } from "./extract";

function name(rawText: string | null, counterpartyName?: string | null) {
  return extractMerchantName({ rawText, counterpartyName });
}

describe("extractMerchantName", () => {
  it("usa la controparte dichiarata dalla banca, invariata, se non è nota al dizionario", () => {
    expect(name("PAGAMENTO POS", "BAR ROSSI SNC")).toEqual({ name: "BAR ROSSI SNC", source: "counterparty" });
  });

  it("normalizza la controparte nota con il nome del dizionario", () => {
    expect(name(null, "AMAZON EU SARL")).toEqual({ name: "Amazon", source: "alias" });
    expect(name("PAGAMENTO POS ESSELUNGA VIA ROMA COD.4471", "ESSELUNGA SPA")).toEqual({ name: "Esselunga", source: "alias" });
  });

  it("ignora una controparte che è l'intermediario e guarda il testo libero", () => {
    expect(name("PAYPAL *SPOTIFYAB 35314369001 LU", "PAYPAL EUROPE S.A.R.L.")).toEqual({ name: "Spotify", source: "alias" });
  });

  it("riconosce gli esercenti noti dentro al testo grezzo", () => {
    expect(name("PAGAMENTO DIGITALE AMZN MKTP IT*2K4XY8Z0 LUXEMBOURG")).toEqual({ name: "Amazon", source: "alias" });
    expect(name("SDD CORE 7YT82 ID.CRED IT12ZZZ0000012345678 FASTWEB SPA")).toEqual({ name: "Fastweb", source: "alias" });
  });

  it("estrae l'esercente dopo l'intermediario quando non è nel dizionario", () => {
    expect(name("PAGAMENTO POS 4532 SUMUP *BAR ROSSI MILANO IT 12/09")).toEqual({ name: "Bar Rossi Milano", source: "pattern" });
  });

  it("estrae la controparte di un bonifico", () => {
    expect(name("BONIFICO SEPA A FAVORE DI MARIO ROSSI CAUSALE CENA CRO 123456")).toEqual({ name: "Mario Rossi", source: "pattern" });
    expect(name("BONIFICO DA LUCIA BIANCHI RIF 99887")).toEqual({ name: "Lucia Bianchi", source: "pattern" });
  });

  it("ripulisce intestazioni, date, codici, via e paese", () => {
    expect(name("PAG. POS CARTASI 05/10 PIZZERIA DA GIGI VIA ROMA 12 MI")).toEqual({ name: "Pizzeria Da Gigi", source: "pattern" });
  });

  it("riconosce le voci bancarie senza esercente", () => {
    expect(name("PRELIEVO BANCOMAT ATM 4532 MILANO")).toEqual({ name: "Prelievo contanti", source: "alias" });
    expect(name("IMPOSTA DI BOLLO CONTO CORRENTE")).toEqual({ name: "Imposta di bollo", source: "alias" });
    expect(name("EMOLUMENTI ACME SRL OTTOBRE")).toEqual({ name: "Stipendio", source: "alias" });
  });

  it("non confonde parole che contengono un alias", () => {
    expect(name("COOPERATIVA SOCIALE ARCOBALENO").source).not.toBe("alias");
  });

  it("ricade sul testo originale o sul nome generico", () => {
    expect(name("12345 67890")).toEqual({ name: "12345 67890", source: "raw" });
    expect(name(null)).toEqual({ name: "Movimento bancario", source: "fallback" });
    expect(name("   ", "  ")).toEqual({ name: "Movimento bancario", source: "fallback" });
  });
});
