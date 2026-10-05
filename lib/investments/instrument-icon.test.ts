import { describe, expect, it } from "vitest";
import { findFundIssuer, nameInitials, normalizeName, resolveInstrumentIcon } from "./instrument-icon";

const SWATCH = "var(--swatch-slate)";

describe("resolveInstrumentIcon", () => {
  it("riconosce l'emittente di un ETF dal nome", () => {
    const icon = resolveInstrumentIcon({ type: "etf", name: "iShares Core MSCI World UCITS ETF USD (Acc)" }, SWATCH);
    expect(icon).toMatchObject({ kind: "initials", text: "iS", label: "iShares (BlackRock)" });
    expect(findFundIssuer("Vanguard FTSE All-World UCITS ETF")?.id).toBe("vanguard");
    expect(findFundIssuer("Lyxor Core STOXX Europe 600")?.id).toBe("amundi");
  });

  it("non confonde un emittente con una parola più lunga", () => {
    expect(findFundIssuer("UBSX Qualcosa")).toBeNull();
    expect(findFundIssuer("ETF Azionario Globale Demo")).toBeNull();
  });

  it("usa l'icona della crypto dal nome", () => {
    expect(resolveInstrumentIcon({ type: "crypto", name: "Bitcoin" }, SWATCH)).toMatchObject({ kind: "image", src: "/instrument-icons/crypto/btc.svg" });
    expect(resolveInstrumentIcon({ type: "crypto", name: "Ethereum" }, SWATCH)).toMatchObject({ kind: "image", src: "/instrument-icons/crypto/eth.svg" });
  });

  it("usa il marchio di un'azienda nota, solo per le azioni", () => {
    expect(resolveInstrumentIcon({ type: "azione", name: "Apple Inc." }, SWATCH)).toMatchObject({ kind: "brand", label: "Apple" });
    expect(resolveInstrumentIcon({ type: "azione", name: "Meta Platforms, Inc. Class A" }, SWATCH)).toMatchObject({ kind: "brand" });
    expect(resolveInstrumentIcon({ type: "etf", name: "Apple Inc." }, SWATCH).kind).toBe("initials");
  });

  it("ricade su una sigla del colore del tipo quando non riconosce niente", () => {
    expect(resolveInstrumentIcon({ type: "azione", name: "Energia Italia S.p.A." }, SWATCH)).toEqual({
      kind: "initials",
      text: "Ei",
      swatch: SWATCH,
      label: "Energia Italia S.p.A.",
    });
    expect(resolveInstrumentIcon({ type: "crypto", name: "Moneta Sconosciuta XYZ" }, SWATCH).kind).toBe("initials");
  });
});

describe("normalizeName e nameInitials", () => {
  it("toglie accenti e punteggiatura", () => {
    expect(normalizeName("  L'Oréal S.A. ")).toBe("l oreal s a");
  });
  it("gestisce nomi vuoti o di una parola", () => {
    expect(nameInitials("")).toBe("?");
    expect(nameInitials("Bitcoin")).toBe("Bi");
  });
});
