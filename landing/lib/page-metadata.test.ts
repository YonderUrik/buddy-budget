import { describe, expect, it } from "vitest";
import { pageMetadata } from "./page-metadata";

const TITLE = "Calcolatori gratuiti: zainetto fiscale, rata e risparmio";
const DESCRIPTION = "Tre calcolatori gratis e senza account: imposta su una plusvalenza con lo zainetto fiscale, rata di un mutuo, tempo per un obiettivo.";

describe("pageMetadata", () => {
  it("gives the page its own Open Graph title and url", () => {
    const meta = pageMetadata("it", { title: TITLE, description: DESCRIPTION, alternates: { canonical: "/strumenti" } });
    expect(meta.openGraph).toMatchObject({ title: TITLE, description: DESCRIPTION, url: "/strumenti", locale: "it_IT" });
    expect(meta.twitter).toMatchObject({ title: TITLE });
  });

  it("uses the English locale and image text on English pages", () => {
    const meta = pageMetadata("en", { title: TITLE, description: DESCRIPTION, alternates: { canonical: "/en/security" } });
    expect(meta.openGraph).toMatchObject({ locale: "en_US", url: "/en/security" });
  });

  it("refuses a page without a canonical address", () => {
    expect(() => pageMetadata("it", { title: TITLE, description: DESCRIPTION })).toThrow();
  });

  it("refuses titles and descriptions that search results would cut or find empty", () => {
    const page = (title: string, description: string) => () => pageMetadata("it", { title, description, alternates: { canonical: "/x" } });
    expect(page("Calcolatori", DESCRIPTION)).toThrow(/Title/);
    expect(page(`${TITLE} con esempi e fonti`, DESCRIPTION)).toThrow(/Title/);
    expect(page(TITLE, "Tre calcolatori gratis.")).toThrow(/Description/);
    expect(page(TITLE, DESCRIPTION.repeat(2))).toThrow(/Description/);
  });
});
