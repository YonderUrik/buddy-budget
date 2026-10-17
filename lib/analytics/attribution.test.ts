import { describe, expect, it } from "vitest";
import { attributionFromSearch } from "./attribution";

describe("attributionFromSearch", () => {
  it("keeps slugs and drops free text", () => {
    const params = new URLSearchParams("utm_source=Instagram&utm_medium=social&utm_campaign=hello world&utm_content=" + "a".repeat(41));
    expect(attributionFromSearch(params)).toEqual({ source: "instagram", medium: "social" });
  });

  it("is empty without campaign parameters", () => {
    expect(attributionFromSearch(new URLSearchParams("redirect=/panoramica"))).toEqual({});
  });
});
