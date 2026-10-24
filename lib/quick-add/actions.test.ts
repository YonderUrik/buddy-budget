import { describe, expect, it } from "vitest";
import { isQuickAddForm, QUICK_ADD_ACTION_IDS, QUICK_ADD_ACTIONS, QUICK_ADD_PAGE_HREFS, quickAddArea, quickAddGroups, quickAddHref } from "./actions";

const ids = (groups: ReturnType<typeof quickAddGroups>) => groups.flatMap((g) => g.actions.map((a) => a.id));
const sections = (groups: ReturnType<typeof quickAddGroups>) => groups.map((g) => g.section.id);

describe("quickAddGroups", () => {
  it("offers everything in Italy, in the fixed order, from Panoramica", () => {
    const groups = quickAddGroups("IT", "/panoramica");
    expect(sections(groups)).toEqual(["liquidita", "investimenti", "debiti", "pensione", "analitiche"]);
    expect(ids(groups)).toEqual([...QUICK_ADD_ACTION_IDS]);
    expect(groups.some((g) => g.current)).toBe(false);
  });

  it("puts the section of the current page first, also from its sub-pages", () => {
    expect(sections(quickAddGroups("IT", "/investimenti/tasse"))[0]).toBe("investimenti");
    expect(sections(quickAddGroups("IT", "/debiti/finanziamenti/abc"))[0]).toBe("debiti");
    expect(sections(quickAddGroups("IT", "/analitiche/obiettivi"))[0]).toBe("analitiche");
    // The file import page belongs to Liquidità.
    const fromImports = quickAddGroups("IT", "/importazioni");
    expect(fromImports[0]).toMatchObject({ current: true, section: { id: "liquidita" } });
  });

  it("never offers the Italian pension fund outside Italy", () => {
    for (const country of ["DE", "OTHER"]) {
      const groups = quickAddGroups(country, "/panoramica");
      expect(ids(groups)).not.toContain("pensione");
      expect(sections(groups)).not.toContain("pensione");
      expect(ids(groups)).toContain("obiettivo");
    }
  });
});

describe("quick add targets", () => {
  it("builds the links that open a form or the chooser", () => {
    expect(quickAddHref("/debiti", "debito")).toBe("/debiti?aggiungi=debito");
    expect(quickAddHref("/panoramica")).toBe("/panoramica?aggiungi=1");
  });

  it("opens a form or goes to a page for every action, never both", () => {
    for (const action of QUICK_ADD_ACTIONS) {
      expect(isQuickAddForm(action.id) !== action.id in QUICK_ADD_PAGE_HREFS, action.id).toBe(true);
    }
  });
});

describe("quickAddArea", () => {
  it("names the area of the page with a closed set, never the path", () => {
    expect(quickAddArea("/panoramica")).toBe("panoramica");
    expect(quickAddArea("/liquidita/budget")).toBe("liquidita");
    expect(quickAddArea("/importazioni")).toBe("liquidita");
    expect(quickAddArea("/investimenti/titoli/123")).toBe("investimenti");
    expect(quickAddArea("/impostazioni")).toBe("altro");
  });
});
