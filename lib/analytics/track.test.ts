import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "./track";

describe("track", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("è no-op senza window o senza Umami caricato", () => {
    expect(() => track("pwa_installed")).not.toThrow();
    vi.stubGlobal("window", {});
    expect(() => track("transaction_added", { direction: "uscita" })).not.toThrow();
  });

  it("inoltra nome e props a Umami", () => {
    const umamiTrack = vi.fn();
    vi.stubGlobal("window", { umami: { track: umamiTrack } });
    track("categorization_applied", { groups: 3 });
    track("account_sync_manual");
    expect(umamiTrack).toHaveBeenNthCalledWith(1, "categorization_applied", { groups: 3 });
    expect(umamiTrack).toHaveBeenNthCalledWith(2, "account_sync_manual");
  });

  it("ingoia gli errori del tracker", () => {
    vi.stubGlobal("window", { umami: { track: () => { throw new Error("blocked"); } } });
    expect(() => track("bank_connect_started")).not.toThrow();
  });
});
