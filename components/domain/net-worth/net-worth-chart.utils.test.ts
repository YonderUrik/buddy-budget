import { describe, expect, it } from "vitest";
import { countedClasses, toggleHiddenClass, visibleClasses } from "./net-worth-chart.utils";

const ALL = ["liquidita", "investimenti", "previdenza"];

describe("toggleHiddenClass", () => {
  it("nasconde e rimostra una classe", () => {
    const hidden = toggleHiddenClass(new Set(), "investimenti", ALL);
    expect([...hidden]).toEqual(["investimenti"]);
    expect(toggleHiddenClass(hidden, "investimenti", ALL).size).toBe(0);
  });

  it("non nasconde l'ultima classe visibile", () => {
    const hidden = new Set(["liquidita", "investimenti"]);
    expect([...toggleHiddenClass(hidden, "previdenza", ALL)].sort()).toEqual(["investimenti", "liquidita"]);
  });
});

describe("visibleClasses / countedClasses", () => {
  it("filtra i nascosti mantenendo l'ordine", () => {
    expect(visibleClasses(ALL, new Set(["investimenti", "inesistente"]))).toEqual(["liquidita", "previdenza"]);
  });

  it("toglie la previdenza dal totale se esclusa dall'interruttore", () => {
    expect(countedClasses(ALL, false)).toEqual(["liquidita", "investimenti"]);
    expect(countedClasses(ALL, true)).toEqual(ALL);
  });
});
