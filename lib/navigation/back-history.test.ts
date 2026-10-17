import { describe, expect, it } from "vitest";
import { pageName, parentOf, parseStoredStack, recordVisit, resolveBackTarget, screenKey } from "./back-history";

describe("recordVisit", () => {
  it("pushes new screens and replaces the same screen with other filters", () => {
    let stack = recordVisit([], "/liquidita");
    stack = recordVisit(stack, "/liquidita?conto=a");
    stack = recordVisit(stack, "/investimenti");
    expect(stack).toEqual(["/liquidita?conto=a", "/investimenti"]);
  });

  it("keeps Settings groups and loans as separate screens", () => {
    let stack = recordVisit([], "/impostazioni");
    stack = recordVisit(stack, "/impostazioni?sezione=notifiche");
    expect(stack).toEqual(["/impostazioni", "/impostazioni?sezione=notifiche"]);
  });

  it("pops when going back to the screen before the last one", () => {
    const stack = recordVisit(["/panoramica", "/categorizza", "/importazioni"], "/categorizza?vista=auto");
    expect(stack).toEqual(["/panoramica", "/categorizza?vista=auto"]);
  });

  it("keeps at most the limit", () => {
    const stack = ["/a", "/b", "/c"].reduce<string[]>((s, href) => recordVisit(s, href, 2), []);
    expect(stack).toEqual(["/b", "/c"]);
  });
});

describe("resolveBackTarget", () => {
  it("goes back between main sections, before and after the visit is recorded", () => {
    const before = ["/panoramica", "/liquidita?conto=a"];
    const after = recordVisit(before, "/investimenti");
    const expected = { href: "/liquidita?conto=a", label: "Liquidità", source: "previous" };
    expect(resolveBackTarget(before, "/investimenti")).toEqual(expected);
    expect(resolveBackTarget(after, "/investimenti")).toEqual(expected);
  });

  it("goes back from a Settings group to the list", () => {
    const stack = ["/liquidita/conti", "/impostazioni", "/impostazioni?sezione=notifiche"];
    expect(resolveBackTarget(stack, "/impostazioni?sezione=notifiche")).toEqual({ href: "/impostazioni", label: "Impostazioni", source: "previous" });
  });

  it("does not bounce between two pages after going back", () => {
    const stack = ["/panoramica", "/categorizza", "/importazioni"];
    expect(resolveBackTarget(stack, "/categorizza")).toEqual({ href: "/panoramica", label: "Panoramica", source: "previous" });
  });

  it("falls back to the parent of a second-level page, and to nothing on a main section", () => {
    expect(resolveBackTarget([], "/investimenti/titoli/abc")).toEqual({ href: "/investimenti", label: "Portafoglio", source: "parent" });
    expect(resolveBackTarget(["/conti/collega/x"], "/debiti/finanziamenti?id=1")).toEqual({ href: "/debiti", label: "Debiti", source: "parent" });
    expect(resolveBackTarget([], "/liquidita")).toBeNull();
  });
});

describe("parentOf", () => {
  it("uses the page Help was opened from, when known", () => {
    expect(parentOf("/aiuto?da=/liquidita/conti")).toEqual({ href: "/liquidita/conti", label: "Conti" });
    expect(parentOf("/aiuto?da=//evil.example")).toEqual({ href: "/panoramica", label: "Panoramica" });
    expect(parentOf("/impostazioni?sezione=account")).toEqual({ href: "/impostazioni", label: "Impostazioni" });
  });
});

describe("screenKey and pageName", () => {
  it("keeps only the parameters that make a different screen", () => {
    expect(screenKey("/liquidita?conto=a&periodo=3")).toBe("/liquidita");
    expect(screenKey("/debiti/finanziamenti?id=7&x=1")).toBe("/debiti/finanziamenti?id=7");
  });

  it("names tabs and detail pages, not deeper or unknown paths", () => {
    expect(pageName("/liquidita/conti")).toBe("Conti");
    expect(pageName("/analitiche/obiettivi/123")).toBe("Obiettivo");
    expect(pageName("/analitiche/obiettivi/123/altro")).toBeNull();
    expect(pageName("/conti/collega/abc")).toBeNull();
  });
});

describe("parseStoredStack", () => {
  it("keeps only in-app paths", () => {
    expect(parseStoredStack('["/liquidita","//evil.example","https://x.y",3]')).toEqual(["/liquidita"]);
    expect(parseStoredStack("not json")).toEqual([]);
    expect(parseStoredStack(null)).toEqual([]);
  });
});
