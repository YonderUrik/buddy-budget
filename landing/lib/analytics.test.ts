import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "./analytics";

describe("track", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is a no-op without Umami", () => {
    expect(() => track("theme_toggled", { theme: "dark" })).not.toThrow();
    vi.stubGlobal("window", {});
    expect(() => track("section_view", { section: "come" })).not.toThrow();
  });

  it("forwards name and props to Umami", () => {
    const umamiTrack = vi.fn();
    vi.stubGlobal("window", { umami: { track: umamiTrack } });
    track("cta_click", { location: "hero", target: "signup", lang: "en" });
    expect(umamiTrack).toHaveBeenCalledWith("cta_click", { location: "hero", target: "signup", lang: "en" });
  });

  it("swallows tracker errors", () => {
    vi.stubGlobal("window", {
      umami: {
        track: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(() => track("showcase_tab_selected", { tab: "tasse" })).not.toThrow();
  });
});
