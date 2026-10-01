import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "./analytics";

describe("track", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("è no-op senza Umami", () => {
    expect(() => track("theme_toggled", { theme: "dark" })).not.toThrow();
    vi.stubGlobal("window", {});
    expect(() => track("section_view", { section: "hero" })).not.toThrow();
  });

  it("inoltra nome e props a Umami", () => {
    const umamiTrack = vi.fn();
    vi.stubGlobal("window", { umami: { track: umamiTrack } });
    track("cta_click", { location: "hero", target: "signup" });
    expect(umamiTrack).toHaveBeenCalledWith("cta_click", { location: "hero", target: "signup" });
  });

  it("ingoia gli errori del tracker", () => {
    vi.stubGlobal("window", {
      umami: {
        track: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(() => track("hide_amounts_toggled", { hidden: true })).not.toThrow();
  });
});
