import { describe, expect, it } from "vitest";
import { pageName, parseStoredStack, recordVisit, resolveBackTarget } from "./back-history";

const PARENT = { href: "/investimenti", label: "Portafoglio" };

describe("recordVisit", () => {
  it("pushes new pages and replaces the same page with a different query", () => {
    let stack = recordVisit([], "/liquidita");
    stack = recordVisit(stack, "/debiti/finanziamenti?id=a");
    stack = recordVisit(stack, "/debiti/finanziamenti?id=b");
    expect(stack).toEqual(["/liquidita", "/debiti/finanziamenti?id=b"]);
  });

  it("pops when going back to the page before the last one", () => {
    const stack = recordVisit(["/panoramica", "/categorizza", "/importazioni"], "/categorizza?vista=auto");
    expect(stack).toEqual(["/panoramica", "/categorizza?vista=auto"]);
  });

  it("keeps at most the limit", () => {
    const stack = ["/a", "/b", "/c"].reduce<string[]>((s, href) => recordVisit(s, href, 2), []);
    expect(stack).toEqual(["/b", "/c"]);
  });
});

describe("resolveBackTarget", () => {
  it("leads to the previous known page, before and after the current visit is recorded", () => {
    const before = ["/panoramica", "/investimenti/operazioni?tipo=acquisto"];
    const after = recordVisit(before, "/investimenti/titoli/abc");
    const expected = { href: "/investimenti/operazioni?tipo=acquisto", label: "Operazioni", source: "previous" };
    expect(resolveBackTarget(before, "/investimenti/titoli/abc", PARENT)).toEqual(expected);
    expect(resolveBackTarget(after, "/investimenti/titoli/abc", PARENT)).toEqual(expected);
  });

  it("does not bounce between two detail pages after going back", () => {
    const stack = ["/panoramica", "/categorizza", "/importazioni"];
    const target = resolveBackTarget(stack, "/categorizza", { href: "/liquidita", label: "Movimenti" });
    expect(target).toEqual({ href: "/panoramica", label: "Panoramica", source: "previous" });
  });

  it("falls back to the parent on a first visit or after an unknown page", () => {
    expect(resolveBackTarget([], "/investimenti/titoli/abc", PARENT)).toEqual({ ...PARENT, source: "parent" });
    expect(resolveBackTarget(["/conti/collega/x"], "/liquidita/conti", PARENT)).toEqual({ ...PARENT, source: "parent" });
  });
});

describe("pageName", () => {
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
