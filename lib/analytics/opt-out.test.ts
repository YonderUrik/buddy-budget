import { describe, expect, it } from "vitest";
import { ANALYTICS_OPT_OUT_KEY, isAnalyticsOptedOut, setAnalyticsOptOut, type OptOutStorage } from "./opt-out";

function memoryStorage(): OptOutStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("opt-out delle statistiche", () => {
  it("di default l'utente è misurato", () => {
    expect(isAnalyticsOptedOut(memoryStorage())).toBe(false);
    expect(isAnalyticsOptedOut(undefined)).toBe(false);
  });

  it("attivando l'opt-out scrive la chiave letta da Umami", () => {
    const storage = memoryStorage();
    expect(setAnalyticsOptOut(storage, true)).toBe(true);
    expect(storage.data.get(ANALYTICS_OPT_OUT_KEY)).toBe("1");
    expect(isAnalyticsOptedOut(storage)).toBe(true);
  });

  it("disattivandolo rimuove la chiave, non scrive \"0\" (che per Umami sarebbe ancora attivo)", () => {
    const storage = memoryStorage();
    setAnalyticsOptOut(storage, true);
    setAnalyticsOptOut(storage, false);
    expect(storage.data.has(ANALYTICS_OPT_OUT_KEY)).toBe(false);
    expect(isAnalyticsOptedOut(storage)).toBe(false);
  });

  it("se lo storage lancia, non rompe e segnala il fallimento", () => {
    const broken: OptOutStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isAnalyticsOptedOut(broken)).toBe(false);
    expect(setAnalyticsOptOut(broken, true)).toBe(false);
    expect(setAnalyticsOptOut(undefined, true)).toBe(false);
  });
});
