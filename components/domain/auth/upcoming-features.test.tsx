import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UpcomingFeatures } from "./upcoming-features";

vi.mock("./upcoming-features.data", () => ({
  UPCOMING_FEATURES: [],
  UPCOMING_FEATURE_INTERVAL_MS: 6000,
}));

vi.mock("motion/react", () => ({
  useReducedMotion: () => false,
}));

describe("UpcomingFeatures", () => {
  it("non mostra il pannello quando non ci sono funzionalità in arrivo", () => {
    expect(renderToStaticMarkup(<UpcomingFeatures />)).toBe("");
  });
});
