import { describe, expect, it } from "vitest";
import { isQuickAddForm, isQuickAddHere, QUICK_ADD_ACTION_IDS, QUICK_ADD_ACTIONS, QUICK_ADD_PAGE_HREFS, quickAddArea, quickAddHref, quickAddMenu } from "./actions";

const ids = (actions: { id: string }[]) => actions.map((a) => a.id);

describe("quickAddMenu", () => {
  it("offers everything in Italy, the frequent things first, in a fixed order", () => {
    const menu = quickAddMenu("IT");
    expect(ids(menu.frequent)).toEqual(["movimento", "operazione", "file"]);
    expect(ids(menu.occasional)).toEqual(["conto", "abbonamento", "debito", "pensione", "obiettivo"]);
    expect([...ids(menu.frequent), ...ids(menu.occasional)]).toEqual([...QUICK_ADD_ACTION_IDS]);
  });

  it("never offers the Italian pension fund outside Italy", () => {
    for (const country of ["DE", "OTHER"]) {
      const menu = quickAddMenu(country);
      expect(ids(menu.occasional)).toEqual(["conto", "abbonamento", "debito", "obiettivo"]);
      expect(ids(menu.frequent)).toHaveLength(3);
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

describe("page of the user", () => {
  it("names the area of the page with a closed set, never the path", () => {
    expect(quickAddArea("/panoramica")).toBe("panoramica");
    expect(quickAddArea("/liquidita/budget")).toBe("liquidita");
    expect(quickAddArea("/importazioni")).toBe("liquidita");
    expect(quickAddArea("/investimenti/titoli/123")).toBe("investimenti");
    expect(quickAddArea("/impostazioni")).toBe("altro");
  });

  it("tells whether the action belongs to the section the user is in", () => {
    expect(isQuickAddHere("debito", "/debiti/finanziamenti/abc")).toBe(true);
    expect(isQuickAddHere("file", "/importazioni")).toBe(true);
    expect(isQuickAddHere("operazione", "/liquidita")).toBe(false);
    expect(isQuickAddHere("movimento", "/panoramica")).toBe(false);
  });
});
