import { describe, expect, it } from "vitest";
import {
  CATEGORY_TYPE_LABELS,
  CATEGORY_TYPES,
  EXPENSE_GROUP_KEYS,
  EXPENSE_GROUPS,
  GROUP_DISPLAY,
  categoryGroupKey,
  groupCategoriesByType,
  isExpenseGroup,
} from "./groups";

function cat(id: string, type: string, isFallback = false) {
  return { id, type, isFallback };
}

describe("costanti gruppi", () => {
  it("i gruppi di spesa sono i tipi categoria meno 'entrata', nello stesso ordine", () => {
    expect(EXPENSE_GROUP_KEYS).toEqual(["dovuta", "voluta", "futuro", "saltuaria"]);
    expect(CATEGORY_TYPES).toEqual(["dovuta", "voluta", "futuro", "saltuaria", "entrata"]);
  });

  it("ha un'etichetta per ogni tipo categoria", () => {
    expect(CATEGORY_TYPE_LABELS).toEqual({
      dovuta: "Dovute",
      voluta: "Volute",
      futuro: "Te futuro",
      saltuaria: "Saltuarie",
      entrata: "Entrata",
    });
  });

  it("ogni gruppo punta a un token CSS e non a un colore letterale", () => {
    for (const key of EXPENSE_GROUP_KEYS) {
      expect(EXPENSE_GROUPS[key].colorVar).toBe(`var(--group-${key})`);
      expect(EXPENSE_GROUPS[key].shortDescription.length).toBeGreaterThan(0);
    }
    expect(GROUP_DISPLAY.daCategorizzare).toEqual({
      label: "Da categorizzare",
      colorVar: "var(--group-uncategorized)",
      dotClassName: "bg-group-uncategorized",
    });
  });
});

describe("isExpenseGroup / categoryGroupKey", () => {
  it("riconosce solo i quattro gruppi di spesa", () => {
    expect(isExpenseGroup("futuro")).toBe(true);
    expect(isExpenseGroup("entrata")).toBe(false);
    expect(isExpenseGroup("fissa")).toBe(false);
  });

  it("la fallback va in daCategorizzare qualunque sia il suo type", () => {
    expect(categoryGroupKey(cat("f", "voluta", true))).toBe("daCategorizzare");
  });

  it("entrata → null, gruppo → se stesso, tipo sconosciuto → daCategorizzare", () => {
    expect(categoryGroupKey(cat("e", "entrata"))).toBeNull();
    expect(categoryGroupKey(cat("s", "saltuaria"))).toBe("saltuaria");
    expect(categoryGroupKey(cat("x", "boh"))).toBe("daCategorizzare");
  });
});

describe("groupCategoriesByType", () => {
  it("divide in quattro gruppi ordinati, fallback a parte, entrate in fondo, preservando l'ordine di input", () => {
    const sections = groupCategoriesByType([
      cat("stipendio", "entrata"),
      cat("netflix", "voluta"),
      cat("fallback", "voluta", true),
      cat("affitto", "dovuta"),
      cat("cinema", "voluta"),
    ]);
    expect(sections.groups.map((g) => g.key)).toEqual(["dovuta", "voluta", "futuro", "saltuaria"]);
    expect(sections.groups[0].categories.map((c) => c.id)).toEqual(["affitto"]);
    expect(sections.groups[1].categories.map((c) => c.id)).toEqual(["netflix", "cinema"]);
    expect(sections.groups[2].categories).toEqual([]);
    expect(sections.uncategorized.map((c) => c.id)).toEqual(["fallback"]);
    expect(sections.income.map((c) => c.id)).toEqual(["stipendio"]);
  });

  it("con lista vuota restituisce comunque i quattro gruppi vuoti", () => {
    const sections = groupCategoriesByType([]);
    expect(sections.groups).toHaveLength(4);
    expect(sections.uncategorized).toEqual([]);
    expect(sections.income).toEqual([]);
  });
});
