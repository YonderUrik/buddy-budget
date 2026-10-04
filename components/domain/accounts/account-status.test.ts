import { describe, expect, it } from "vitest";
import { buildAccountStatus, describeSyncAvailability, sumBalances } from "./account-status";

const now = new Date("2026-10-04T12:00:00Z");
const synced = { lastSyncedAt: "2026-10-04T10:00:00Z", eligible: true, nextEligibleAt: null, syncsRemainingToday: 3 };

describe("buildAccountStatus", () => {
  it("dice 'Aggiornato da te' per un conto manuale", () => {
    expect(buildAccountStatus({ isAuto: false, now })).toEqual({ tone: "neutral", label: "Aggiornato da te" });
  });
  it("dà la precedenza alla riconnessione sulla sync in corso", () => {
    expect(buildAccountStatus({ isAuto: true, needsReconnect: true, syncing: true, syncInfo: synced, now }).label).toBe("Da riconnettere");
  });
  it("segnala la sync in corso", () => {
    expect(buildAccountStatus({ isAuto: true, syncing: true, syncInfo: synced, now }).tone).toBe("progress");
  });
  it("mostra l'ultimo aggiornamento relativo", () => {
    expect(buildAccountStatus({ isAuto: true, syncInfo: synced, now })).toEqual({ tone: "ok", label: "Aggiornato 2 h fa" });
  });
  it("segnala un conto mai sincronizzato", () => {
    expect(buildAccountStatus({ isAuto: true, syncInfo: { ...synced, lastSyncedAt: null }, now }).label).toBe("Mai sincronizzato");
  });
});

describe("describeSyncAvailability", () => {
  it("spiega quando si può sincronizzare", () => {
    expect(describeSyncAvailability({ syncInfo: synced })).toBe("Puoi sincronizzare adesso.");
  });
  it("spiega il limite giornaliero raggiunto", () => {
    const text = describeSyncAvailability({ syncInfo: { ...synced, eligible: false, nextEligibleAt: "2026-10-04T14:00:00Z", syncsRemainingToday: 0 } });
    expect(text).toContain("limite di 4");
  });
  it("chiede di riconnettere la banca", () => {
    expect(describeSyncAvailability({ needsReconnect: true, syncInfo: synced })).toContain("Riconnetti");
  });
});

describe("sumBalances", () => {
  it("somma i saldi, anche negativi", () => {
    expect(sumBalances([{ balance: "100.50" }, { balance: "-20.25" }])).toBeCloseTo(80.25);
  });
});
