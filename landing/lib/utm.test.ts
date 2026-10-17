import { describe, expect, it } from "vitest";
import { pickUtm, withUtm } from "./utm";

describe("utm", () => {
  it("keeps only campaign parameters, trimmed and capped", () => {
    expect(pickUtm("?utm_source=instagram&utm_campaign= lancio &foo=1&utm_medium=")).toEqual({ utm_source: "instagram", utm_campaign: "lancio" });
    expect(pickUtm(`?utm_source=${"a".repeat(200)}`).utm_source).toHaveLength(60);
  });

  it("overrides the landing defaults and keeps the other parameters", () => {
    const href = "https://app.buddybudget.io/login?utm_source=landing&utm_medium=cta&signup=1";
    const out = new URL(withUtm(href, { utm_source: "instagram", utm_campaign: "lancio" }));
    expect(out.searchParams.get("utm_source")).toBe("instagram");
    expect(out.searchParams.get("utm_medium")).toBe("cta");
    expect(out.searchParams.get("utm_campaign")).toBe("lancio");
    expect(out.searchParams.get("signup")).toBe("1");
  });
});
