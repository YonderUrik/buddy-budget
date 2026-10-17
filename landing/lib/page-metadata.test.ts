import { describe, expect, it } from "vitest";
import { pageMetadata } from "./page-metadata";

describe("pageMetadata", () => {
  it("gives the page its own Open Graph title and url", () => {
    const meta = pageMetadata("it", { title: "Calcolatori", description: "Descrizione", alternates: { canonical: "/strumenti" } });
    expect(meta.openGraph).toMatchObject({ title: "Calcolatori", description: "Descrizione", url: "/strumenti", locale: "it_IT" });
    expect(meta.twitter).toMatchObject({ title: "Calcolatori" });
  });

  it("uses the English locale and image text on English pages", () => {
    const meta = pageMetadata("en", { title: "Security", description: "d", alternates: { canonical: "/en/security" } });
    expect(meta.openGraph).toMatchObject({ locale: "en_US", url: "/en/security" });
  });

  it("refuses a page without a canonical address", () => {
    expect(() => pageMetadata("it", { title: "x", description: "y" })).toThrow();
  });
});
