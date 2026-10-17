import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const profile = vi.hoisted(() => ({ language: "en" as "it" | "en" | "de" }));
vi.mock("./server", () => ({ getLocaleProfile: async () => profile }));

const { translateErrorResponse } = await import("./route-errors");

describe("translateErrorResponse", () => {
  beforeEach(() => {
    profile.language = "en";
  });

  it("translates the error of a JSON error response and keeps status and other fields", async () => {
    const response = await translateErrorResponse(Response.json({ error: "Errore interno", reason: "x" }, { status: 500 }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal error", reason: "x" });
  });

  it("leaves Italian users, successful responses and unknown messages untouched", async () => {
    const ok = Response.json({ error: "Errore interno" });
    expect(await translateErrorResponse(ok)).toBe(ok);
    const unknown = Response.json({ error: "country_feature_unavailable" }, { status: 403 });
    expect(await translateErrorResponse(unknown)).toBe(unknown);
    profile.language = "it";
    const italian = Response.json({ error: "Errore interno" }, { status: 500 });
    expect(await translateErrorResponse(italian)).toBe(italian);
  });
});

describe("translateServerMessage", () => {
  it("fills catalog keys with values taken from the message", async () => {
    const { translateServerMessage } = await import("./messages");
    expect(translateServerMessage("en", "Puoi avere al massimo 20 obiettivi")).toBe("You can have at most 20 goals");
    expect(translateServerMessage("de", "Massimo 80 caratteri")).toBe("Höchstens 80 Zeichen");
    expect(translateServerMessage("en", "Messaggio sconosciuto")).toBe("Messaggio sconosciuto");
    expect(translateServerMessage("it", "Massimo 80 caratteri")).toBe("Massimo 80 caratteri");
  });

  it("translates nested import row messages and their interpolated fragments", async () => {
    const { translateServerMessage } = await import("./messages");
    expect(translateServerMessage("en", "Riga 4: data mancante")).toBe("Row 4: date missing");
    expect(translateServerMessage("de", "Riga 3: classe di investimento non supportata: BOND")).toBe("Zeile 3: nicht unterstützte Anlageklasse: BOND");
    expect(translateServerMessage("en", "3 righe su 10 non sono state riconosciute. Puoi importare le altre 7, rianalizzare il file o caricarne uno corretto."))
      .toBe("3 rows out of 10 were not recognised. You can import the other 7, re-analyse the file or upload a corrected one.");
    expect(translateServerMessage("de", "Saltata: Data non valida")).toBe("Übersprungen: Ungültiges Datum");
  });
});

describe("generic keys", () => {
  it("are not used to match messages", async () => {
    const { translateServerMessage } = await import("./messages");
    expect(translateServerMessage("en", "pippo su pluto")).toBe("pippo su pluto");
  });
});
