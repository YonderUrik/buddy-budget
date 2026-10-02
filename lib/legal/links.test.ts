import { describe, expect, it } from "vitest";
import { LEGAL_LINKS, legalHref } from "./links";

describe("legal links", () => {
  it("espone i tre documenti con URL assoluto https", () => {
    expect(LEGAL_LINKS.map((l) => l.id)).toEqual(["privacy", "termini", "cookie"]);
    for (const link of LEGAL_LINKS) expect(link.href).toMatch(/^https:\/\/.+\/(privacy|termini|cookie)$/);
  });

  it("legalHref combina origine e id", () => {
    expect(legalHref("privacy")).toBe(LEGAL_LINKS[0].href);
  });
});
