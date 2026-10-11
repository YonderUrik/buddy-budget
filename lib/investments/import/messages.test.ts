import { describe, expect, it } from "vitest";
import { explainFileError, explainRowMessage } from "./messages";

describe("explainRowMessage", () => {
  it("traduce il campo tecnico di un parser e dice cosa fare", () => {
    const e = explainRowMessage("Riga 225: amount non valido");
    expect(e.text).toBe("Alla riga 225 il campo «importo» non contiene un valore valido.");
    expect(e.hint).toMatch(/riesporta/i);
  });
  it("spiega una data inesistente", () => {
    expect(explainRowMessage('Data "31/02/2025" non valida').text).toContain("31/02/2025");
  });
  it("spiega una vendita senza acquisti precedenti", () => {
    const e = explainRowMessage("Vende più quote di quelle possedute a quella data");
    expect(e.text).toContain("supera le quote");
    expect(e.hint).toMatch(/storico/);
  });
  it("non inventa nulla per i messaggi sconosciuti", () => {
    expect(explainRowMessage("Qualcosa di nuovo")).toEqual({ text: "Qualcosa di nuovo" });
  });
  it("spiega le righe saltate perché non sono operazioni", () => {
    const e = explainRowMessage('Tipo "Imposta di bollo" ignorato');
    expect(e.text).toContain("Imposta di bollo");
    expect(e.hint).toBeUndefined();
  });
});

describe("explainFileError", () => {
  it("indica il broker giusto quando il file è di un altro", () => {
    const e = explainFileError("Questo file non sembra un export di DEGIRO. Sembra invece un file di Interactive Brokers: scegli quella scheda.");
    expect(e.text).toBe("Questo file non sembra un export di DEGIRO.");
    expect(e.hint).toContain("Interactive Brokers");
  });
  it("rende comprensibile un file illeggibile", () => {
    expect(explainFileError("Il file non sembra un CSV con intestazioni e almeno una riga").hint).toMatch(/PDF/);
  });
});
