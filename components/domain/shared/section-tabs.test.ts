import { describe, expect, it } from "vitest";
import { activeSectionTabIndex, isSectionTabActive, type SectionTab } from "./section-tabs";

const TABS: readonly SectionTab[] = [
  { href: "/investimenti", label: "Portafoglio" },
  { href: "/investimenti/performance", label: "Performance" },
  { href: "/investimenti/tasse", label: "Tasse" },
];

describe("activeSectionTabIndex", () => {
  it("riconosce la radice e le altre viste", () => {
    expect(activeSectionTabIndex(TABS, "/investimenti")).toBe(0);
    expect(activeSectionTabIndex(TABS, "/investimenti/tasse")).toBe(2);
  });

  it("tiene attiva una vista sulle sue sotto-pagine, ma non la radice", () => {
    expect(activeSectionTabIndex(TABS, "/investimenti/performance/dettaglio")).toBe(1);
    expect(isSectionTabActive("/investimenti", "/investimenti/titoli/1", "/investimenti")).toBe(false);
  });

  it("ripiega sulla prima vista se nessuna corrisponde", () => {
    expect(activeSectionTabIndex(TABS, "/altrove")).toBe(0);
  });
});
